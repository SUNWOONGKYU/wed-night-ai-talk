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
// Resend 유료 플랜 전환 (2026-08-18) — 200명 상한은 무료 플랜 시절의 자체 안전장치였을 뿐
// Resend API 자체 제한이 아니었음. 안전장치로 여유 있게 상향, 완전히 제거하지는 않음.
const MAX_RECIPIENTS = 2000;
const MAX_SUBJECT_LEN = 200;
const MAX_HTML_LEN = 100 * 1024; // 100KB
// Resend 배치 API(`/emails/batch`) 1회 호출 상한 (PO, 2026-08-23). 건별 순차 호출 +
// 300ms 지연으로는 회원 293명만으로도 Supabase Edge Function 실행시간 제한에 걸려
// 200명대에서 함수가 강제 종료되는 사고가 반복됐다(email_logs에 success_count만
// 남고 나머지는 details에 아예 없음 -- 실패가 아니라 시도조차 못 한 것). 100명씩
// 묶어 배치 호출하면 293명이 3번 호출로 끝나 지연이 필요 없어진다.
const BATCH_SIZE = 100;

// Origin 화이트리스트 — 운영/프리뷰/로컬개발만 허용
const ALLOWED_ORIGINS = [
    'https://waat.community',
    'https://www.waat.community',
    'https://wed-night-ai-talk.vercel.app',
    'http://localhost:3000',
    'http://localhost:5173',
    'http://127.0.0.1:5500',
];

function corsHeaders(req: Request): Record<string, string> {
    const origin = req.headers.get('Origin') || '';
    const allowOrigin = ALLOWED_ORIGINS.includes(origin)
        ? origin
        : (origin.endsWith('.vercel.app') ? origin : ALLOWED_ORIGINS[0]);
    return {
        'Access-Control-Allow-Origin': allowOrigin,
        'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
        'Access-Control-Allow-Methods': 'POST, OPTIONS',
        'Vary': 'Origin',
    };
}

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

function jsonResponse(body: unknown, status = 200, req?: Request): Response {
    return new Response(JSON.stringify(body), {
        status,
        headers: { ...(req ? corsHeaders(req) : {}), 'Content-Type': 'application/json' },
    });
}

function isValidEmail(s: string): boolean {
    return /^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$/.test(s);
}

// 개인정보 보호상 BCC는 여전히 쓰지 않는다 -- 배치 호출이어도 각 항목의 `to`는
// 수신자 1명뿐이라, Resend가 한 요청으로 묶어 보낼 뿐 서로의 주소를 볼 일은 없다.
async function sendBatch(opts: {
    apiKey: string;
    from: string;
    replyTo: string;
    to: string[];
    subject: string;
    html: string;
}): Promise<ResendSendResult[]> {
    const payload = opts.to.map((to) => {
        const item: Record<string, unknown> = { from: opts.from, to: [to], subject: opts.subject, html: opts.html };
        if (opts.replyTo) item.reply_to = opts.replyTo;
        return item;
    });
    try {
        const res = await fetch('https://api.resend.com/emails/batch', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                Authorization: `Bearer ${opts.apiKey}`,
            },
            body: JSON.stringify(payload),
        });
        const data = await res.json();
        if (!res.ok) {
            // 배치 호출 자체가 실패하면 (인증 오류, 429 등) 이 묶음 전원을 실패로
            // 기록한다 -- Resend 배치 API는 항목별 부분 실패를 알려주지 않는다.
            const errMsg = data?.message || `HTTP ${res.status}`;
            return opts.to.map((to) => ({ email: to, success: false, error: errMsg }));
        }
        const items: Array<{ id?: string }> = Array.isArray(data?.data) ? data.data : [];
        return opts.to.map((to, i) => ({
            email: to,
            success: Boolean(items[i]?.id),
            resend_id: items[i]?.id,
        }));
    } catch (e) {
        const errMsg = (e as Error).message;
        return opts.to.map((to) => ({ email: to, success: false, error: errMsg }));
    }
}

serve(async (req: Request) => {
    if (req.method === 'OPTIONS') {
        return new Response('ok', { headers: corsHeaders(req) });
    }
    if (req.method !== 'POST') {
        return jsonResponse({ success: false, error: 'POST only' }, 405, req);
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
                req,
            );
        }

        // 2) 호출자 인증
        const authHeader = req.headers.get('Authorization');
        if (!authHeader) {
            return jsonResponse({ success: false, error: '로그인이 필요합니다.' }, 401, req);
        }

        const supaUser = createClient(SUPABASE_URL, Deno.env.get('SUPABASE_ANON_KEY')!, {
            global: { headers: { Authorization: authHeader } },
        });
        const { data: { user }, error: userErr } = await supaUser.auth.getUser();
        if (userErr || !user) {
            return jsonResponse({ success: false, error: '인증 실패' }, 401, req);
        }

        // 3) 관리자 권한 확인
        const callerEmail = (user.email || '').toLowerCase();
        if (!ADMIN_EMAILS.includes(callerEmail)) {
            return jsonResponse({ success: false, error: '관리자만 사용 가능합니다.' }, 403, req);
        }

        // 4) 입력 파싱
        const body = (await req.json()) as SendEmailBody;
        if (!body || !Array.isArray(body.to) || !body.subject || !body.html) {
            return jsonResponse({ success: false, error: 'to, subject, html 필수' }, 400, req);
        }

        // 입력 검증
        const cleanTo = Array.from(new Set(
            body.to.map((e) => String(e || '').trim().toLowerCase()).filter(isValidEmail),
        ));
        if (cleanTo.length === 0) {
            return jsonResponse({ success: false, error: '유효한 수신자가 없습니다.' }, 400, req);
        }
        if (cleanTo.length > MAX_RECIPIENTS) {
            return jsonResponse(
                { success: false, error: `한 번에 최대 ${MAX_RECIPIENTS}명까지 가능합니다.` },
                400,
                req,
            );
        }
        const subject = String(body.subject).slice(0, MAX_SUBJECT_LEN);
        const html = String(body.html).slice(0, MAX_HTML_LEN);

        // 테스트 모드: 첫 수신자에게만
        const targets = body.test ? cleanTo.slice(0, 1) : cleanTo;

        // 5) 발송 이력 행을 루프 시작 전에 먼저 써 둔다 (PO, 2026-08-18).
        // 예전엔 루프가 다 끝난 뒤에야 INSERT 했는데, Supabase Edge Function 실행시간
        // 제한에 걸려 루프 도중 함수가 통째로 죽으면 그 INSERT 자체가 실행되지 않아
        // 발송 이력이 아예 안 남았다 - Resend 쪽엔 283명 전부 실제로 발송됐는데
        // email_logs 는 빈 채로 남은 사고로 확인됨. 매 건 발송 직후 이 행을 갱신하므로,
        // 도중에 죽어도 이 테이블만 보면 몇 명까지 나갔는지 안다.
        const supaAdmin = createClient(SUPABASE_URL, SERVICE_ROLE);
        const { data: logRow, error: logInsertErr } = await supaAdmin
            .from('email_logs')
            .insert({
                subject,
                body_preview: html.slice(0, 500),
                recipients_count: targets.length,
                success_count: 0,
                fail_count: 0,
                recipients: targets,
                details: [],
                sent_by: user.id,
                sent_by_email: callerEmail,
                status: 'in_progress',
            })
            .select('id')
            .single();
        if (logInsertErr || !logRow?.id) {
            // 감사로그를 만들지 못한 상태로 발송을 시작하면, 메일은 실제로 나가도
            // WAAT에는 아무 기록이 남지 않는다. 발송 전에 fail-closed 한다.
            console.error('email_logs 시작 행 insert 실패:', logInsertErr || 'missing log id');
            return jsonResponse(
                {
                    success: false,
                    error: '발송 기록을 시작할 수 없어 발송을 중단했습니다.',
                    code: 'EMAIL_LOG_INIT_FAILED',
                },
                503,
                req,
            );
        }
        const logId = logRow.id;
        let logUpdateFailed = false;

        // 6) 발송 (100명씩 배치 호출 -- 293명이 293번이 아니라 3번의 요청으로 끝난다)
        const from = `${FROM_NAME} <${FROM_EMAIL}>`;
        const results: ResendSendResult[] = [];
        for (let i = 0; i < targets.length; i += BATCH_SIZE) {
            const chunk = targets.slice(i, i + BATCH_SIZE);
            const chunkResults = await sendBatch({
                apiKey: RESEND_API_KEY,
                from,
                replyTo: REPLY_TO,
                to: chunk,
                subject,
                html,
            });
            results.push(...chunkResults);
            const successSoFar = results.filter((x) => x.success).length;
            const { error: progressErr } = await supaAdmin
                .from('email_logs')
                .update({
                    success_count: successSoFar,
                    fail_count: results.length - successSoFar,
                    details: results,
                    updated_at: new Date().toISOString(),
                })
                .eq('id', logId);
            if (progressErr) {
                logUpdateFailed = true;
                console.error('email_logs 진행 갱신 실패:', progressErr);
            }
        }

        const successCount = results.filter((r) => r.success).length;
        const failCount = results.length - successCount;

        // 7) 발송 이력 완료 처리 (SERVICE_ROLE 로 RLS 우회)
        const { error: completionErr } = await supaAdmin
            .from('email_logs')
            .update({
                success_count: successCount,
                fail_count: failCount,
                details: results,
                status: 'completed',
                updated_at: new Date().toISOString(),
            })
            .eq('id', logId);
        if (completionErr) {
            logUpdateFailed = true;
            console.error('email_logs 완료 갱신 실패:', completionErr);
        }

        return jsonResponse({
            success: true,
            sent: successCount,
            failed: failCount,
            log_status: logUpdateFailed ? 'degraded' : 'completed',
            test_mode: !!body.test,
            details: results,
        }, 200, req);
    } catch (e) {
        console.error('send-email error:', e);
        return jsonResponse({ success: false, error: (e as Error).message }, 500, req);
    }
});
