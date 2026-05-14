// =============================================
// WAAT — 이메일 일괄 발송 Edge Function
// =============================================
// 경로: supabase/functions/send-email/index.ts
// 배포: supabase functions deploy send-email
// 필요 secret:
//   - RESEND_API_KEY        (필수)
//   - RESEND_FROM_EMAIL     (선택, 기본: onboarding@resend.dev)
//   - RESEND_FROM_NAME      (선택, 기본: WAAT)
//   - RESEND_REPLY_TO       (선택, 기본: 빈값)
//   - SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY  ← Supabase가 자동 주입
//
// 클라이언트 호출 예:
//   await _supabase.functions.invoke('send-email', {
//     body: { to: ['a@x.com', 'b@x.com'], subject: '제목', html: '<p>본문</p>' }
//   });
//
// 보안:
//   - JWT 검증 활성화 (deploy 시 --no-verify-jwt 옵션 사용 금지)
//   - 호출자가 ADMIN_EMAILS 에 포함되는지 확인
//   - to 배열 최대 200개, subject 200자, html 100KB 제한
// =============================================

import { serve } from 'https://deno.land/std@0.224.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const ADMIN_EMAILS = ['wksun999@gmail.com', 'lsonic.lee@gmail.com'];
const MAX_RECIPIENTS = 200;
const MAX_SUBJECT_LEN = 200;
const MAX_HTML_LEN = 100 * 1024; // 100KB

const CORS = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

interface SendEmailBody {
    to: string[];           // 수신자 이메일 배열
    subject: string;        // 제목
    html: string;           // HTML 본문
    test?: boolean;         // true 면 첫 수신자에게만 발송 (테스트용)
}

interface ResendSendResult {
    email: string;
    success: boolean;
    resend_id?: string;
    error?: string;
}

function jsonResponse(body: unknown, status = 200): Response {
    return new Response(JSON.stringify(body), {
        status,
        headers: { ...CORS, 'Content-Type': 'application/json' },
    });
}

function isValidEmail(s: string): boolean {
    return /^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$/.test(s);
}

async function sendOneEmail(opts: {
    apiKey: string;
    from: string;
    replyTo: string;
    to: string;
    subject: string;
    html: string;
}): Promise<ResendSendResult> {
    try {
        const reqBody: Record<string, unknown> = {
            from: opts.from,
            to: [opts.to],
            subject: opts.subject,
            html: opts.html,
        };
        if (opts.replyTo) reqBody.reply_to = opts.replyTo;

        const res = await fetch('https://api.resend.com/emails', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                Authorization: `Bearer ${opts.apiKey}`,
            },
            body: JSON.stringify(reqBody),
        });
        const data = await res.json();
        if (!res.ok) {
            return { email: opts.to, success: false, error: data?.message || `HTTP ${res.status}` };
        }
        return { email: opts.to, success: true, resend_id: data?.id };
    } catch (e) {
        return { email: opts.to, success: false, error: (e as Error).message };
    }
}

serve(async (req: Request) => {
    if (req.method === 'OPTIONS') {
        return new Response('ok', { headers: CORS });
    }
    if (req.method !== 'POST') {
        return jsonResponse({ success: false, error: 'POST only' }, 405);
    }

    try {
        // 1) 환경변수
        const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY');
        const FROM_EMAIL = Deno.env.get('RESEND_FROM_EMAIL') || 'onboarding@resend.dev';
        const FROM_NAME = Deno.env.get('RESEND_FROM_NAME') || 'WAAT';
        const REPLY_TO = Deno.env.get('RESEND_REPLY_TO') || '';
        const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
        const SERVICE_ROLE = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

        if (!RESEND_API_KEY) {
            return jsonResponse(
                { success: false, error: 'RESEND_API_KEY secret 이 설정되지 않았습니다.' },
                500,
            );
        }

        // 2) 호출자 인증
        const authHeader = req.headers.get('Authorization');
        if (!authHeader) {
            return jsonResponse({ success: false, error: '로그인이 필요합니다.' }, 401);
        }

        const supaUser = createClient(SUPABASE_URL, Deno.env.get('SUPABASE_ANON_KEY')!, {
            global: { headers: { Authorization: authHeader } },
        });
        const { data: { user }, error: userErr } = await supaUser.auth.getUser();
        if (userErr || !user) {
            return jsonResponse({ success: false, error: '인증 실패' }, 401);
        }

        // 3) 관리자 권한 확인
        const callerEmail = (user.email || '').toLowerCase();
        if (!ADMIN_EMAILS.includes(callerEmail)) {
            return jsonResponse({ success: false, error: '관리자만 사용 가능합니다.' }, 403);
        }

        // 4) 입력 파싱
        const body = (await req.json()) as SendEmailBody;
        if (!body || !Array.isArray(body.to) || !body.subject || !body.html) {
            return jsonResponse({ success: false, error: 'to, subject, html 필수' }, 400);
        }

        // 입력 검증
        const cleanTo = Array.from(new Set(
            body.to.map((e) => String(e || '').trim().toLowerCase()).filter(isValidEmail),
        ));
        if (cleanTo.length === 0) {
            return jsonResponse({ success: false, error: '유효한 수신자가 없습니다.' }, 400);
        }
        if (cleanTo.length > MAX_RECIPIENTS) {
            return jsonResponse(
                { success: false, error: `한 번에 최대 ${MAX_RECIPIENTS}명까지 가능합니다.` },
                400,
            );
        }
        const subject = String(body.subject).slice(0, MAX_SUBJECT_LEN);
        const html = String(body.html).slice(0, MAX_HTML_LEN);

        // 테스트 모드: 첫 수신자에게만
        const targets = body.test ? cleanTo.slice(0, 1) : cleanTo;

        // 5) 발송 (개별, 개인정보 보호상 BCC 미사용)
        const from = `${FROM_NAME} <${FROM_EMAIL}>`;
        const results: ResendSendResult[] = [];
        for (const to of targets) {
            const r = await sendOneEmail({
                apiKey: RESEND_API_KEY,
                from,
                replyTo: REPLY_TO,
                to,
                subject,
                html,
            });
            results.push(r);
            // Resend free tier rate-limit (2 req/sec) 회피용 짧은 지연
            await new Promise((res) => setTimeout(res, 600));
        }

        const successCount = results.filter((r) => r.success).length;
        const failCount = results.length - successCount;

        // 6) 발송 이력 저장 (SERVICE_ROLE 로 RLS 우회)
        try {
            const supaAdmin = createClient(SUPABASE_URL, SERVICE_ROLE);
            await supaAdmin.from('email_logs').insert({
                subject,
                body_preview: html.slice(0, 500),
                recipients_count: targets.length,
                success_count: successCount,
                fail_count: failCount,
                recipients: targets,
                details: results,
                sent_by: user.id,
                sent_by_email: callerEmail,
            });
        } catch (e) {
            console.error('email_logs insert 실패:', e);
            // 로그 저장 실패는 무시 (발송 자체는 성공할 수 있음)
        }

        return jsonResponse({
            success: true,
            sent: successCount,
            failed: failCount,
            test_mode: !!body.test,
            details: results,
        });
    } catch (e) {
        console.error('send-email error:', e);
        return jsonResponse({ success: false, error: (e as Error).message }, 500);
    }
});
