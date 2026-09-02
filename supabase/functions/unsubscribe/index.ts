// =============================================
// WAAT — 수신거부 엔드포인트 (메일 클라이언트 원클릭 + 링크 클릭)
// =============================================
// 경로: supabase/functions/unsubscribe/index.ts
// 배포: supabase functions deploy unsubscribe --no-verify-jwt
//
// ⚠️ 이 함수만 JWT 검증을 끈다. Gmail·Outlook 서버가 사용자를 대신해 호출하므로
//    Authorization 헤더를 붙일 수 없다. 인증은 URL 의 토큰이 대신한다
//    (토큰은 회원마다 다르고 클라이언트에 노출되지 않는다).
//    send-email 은 반대로 반드시 JWT 검증을 켠 채로 둬야 한다.
//
// 왜 만들었나
//   본문 하단에 수신거부 링크를 넣었지만 "받는 사람 입장에서 안 보인다"는 지적이 있었다
//   (PO, 2026-09-02). 작은 회색 글씨 한 줄이라 메일 앱이 접으면 사실상 없는 것과 같다.
//   List-Unsubscribe 헤더를 붙이면 메일 앱이 발신자 이름 옆에 자체 '수신거부' 버튼을
//   띄운다 — 본문을 어떻게 렌더링하든 보인다. 그 버튼이 부르는 곳이 여기다.
//
// 동작
//   POST (RFC 8058 원클릭)  → 즉시 수신거부, 200 텍스트 응답
//   GET  ?t=토큰            → 즉시 수신거부 후 결과 페이지로 리다이렉트
//   토큰이 틀리면 이유를 알려주지 않는다 (열거 방지).
// =============================================

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const SITE_ORIGIN = 'https://waat.community';

const UUID_RE = /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/;

function extractToken(req: Request, bodyText: string): string | null {
    // 1) 쿼리스트링
    const q = new URL(req.url).searchParams.get('t');
    if (q && UUID_RE.test(q.trim())) return q.trim();

    // 2) 본문 (일부 클라이언트가 폼 인코딩으로 토큰을 되돌려 보내는 경우)
    if (bodyText) {
        const m = bodyText.match(UUID_RE);
        if (m) return m[0];
    }
    return null;
}

Deno.serve(async (req: Request) => {
    const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
    const SERVICE_ROLE = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

    let bodyText = '';
    if (req.method === 'POST') {
        try { bodyText = await req.text(); } catch { /* 본문 없어도 된다 */ }
    }

    const token = extractToken(req, bodyText);

    // 토큰이 없으면 안내 페이지로 넘긴다 (POST 는 그냥 200 — 메일 앱에 오류를 보여줄 필요 없다)
    if (!token) {
        if (req.method === 'POST') {
            return new Response('ok', { status: 200 });
        }
        return Response.redirect(`${SITE_ORIGIN}/unsubscribe.html`, 302);
    }

    let ok = false;
    try {
        const supa = createClient(SUPABASE_URL, SERVICE_ROLE);
        const { data, error } = await supa.rpc('unsubscribe_by_token', { p_token: token });
        if (error) throw error;
        ok = !!(data && data.ok);
    } catch (e) {
        console.error('unsubscribe error:', e);
        // 실패해도 메일 앱에는 200 을 준다. 사용자에게는 페이지에서 다시 시도할 길이 있다.
    }

    if (req.method === 'POST') {
        // RFC 8058 원클릭 — 본문 내용은 클라이언트가 보여주지 않는다
        return new Response(ok ? 'unsubscribed' : 'ok', {
            status: 200,
            headers: { 'Content-Type': 'text/plain; charset=utf-8' },
        });
    }

    // 링크 클릭(GET) — 결과 페이지로 보낸다. 페이지가 토큰으로 상태를 다시 확인해
    // 마스킹된 주소와 '다시 받을래요' 버튼을 보여준다.
    //
    // done=1 을 붙이는 이유: 여기서 이미 수신거부를 끝냈으므로, 페이지가 다시 물으면
    // 무조건 '이미 수신거부 상태'가 된다. 처음 누른 사람에게 그렇게 보이면 어색하다.
    // 이 표시가 있으면 페이지가 '처리되었습니다'로 안내한다.
    // (JS 가 꺼져 있어도 수신거부는 이미 처리됐다 — 페이지는 안내일 뿐이다)
    return Response.redirect(`${SITE_ORIGIN}/unsubscribe.html?t=${token}&done=1`, 302);
});
