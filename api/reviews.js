/**
 * /api/reviews — 앱마켓 리뷰 (앱 공통, app_code 기준)
 *   GET  ?app=onemacs&sort=new|stars&page=1     published 리뷰 목록(20개) + 요약(평균·분포) + 댓글 수
 *   GET  ?app=onemacs&summary=1                 요약만 (홈 카드) · 60초 캐시
 *   GET  ?verify=<token>                        확인 링크: 게시 / 수정본 교체 / 삭제 / 내 리뷰 관리 진입 → 302 리뷰 페이지
 *   POST {app, nick, email, stars?, body, website}           새 리뷰(pending) → 확인 메일. 같은 이메일이 이미 있으면 "내 리뷰 고치기" 안내(409)
 *   POST {action:'manage', app, email}                        내 리뷰 고치기·지우기 진입 메일(review_manage 토큰)
 *   POST {action:'edit', manage:<token>, nick?, stars?, body}   수정본을 pending_* 에 저장(게시본 유지) → 확인 메일(review_edit)
 *   POST {action:'delete', manage:<token>}                    삭제 확인 메일(review_delete)
 *
 * 게시 원칙: 이메일 확인 링크(24시간 1회) 클릭 시 게시. 이메일 원문 저장 안 함(해시). 링크·이메일·전화 마스킹. honeypot(website) 채워지면 조용히 200.
 * 레이트리밋: 같은 IP 1분 3건(DB 정본 + 메모리). 구매 확인: 게시 시 Orders 시트의 주문 이메일 해시와 대조(1회).
 */

const db = require('./lib/supabase.js');
const R = require('./lib/reviews.js');
const m = require('./lib/market.js');
const { sendReviewVerifyEmail } = require('./lib/mailer.js');

const PAGE = 20;
const summaryCache = new Map();   // app → {at, data}

function appName(app) { return app === m.PRODUCT.code || app === 'onemacs' ? m.PRODUCT.name : app; }
function reviewsUrl(req, app, extra) { return `${m.baseUrl(req)}/market/${encodeURIComponent(app)}/reviews${extra || ''}`; }
function html(res, status, title, body, link) {
    return res.status(status).send(`<!DOCTYPE html><html lang="ko"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex"><title>${title}</title>
<style>body{font-family:-apple-system,BlinkMacSystemFont,'Segoe UI','Malgun Gothic',sans-serif;background:#0b0f1a;color:#1a2238;display:flex;align-items:center;justify-content:center;min-height:100vh;margin:0;padding:16px}.box{background:#fff;border-radius:20px;padding:34px 26px;max-width:440px;width:100%;text-align:center}h1{font-size:20px;margin:0 0 12px}p{color:#4A5670;line-height:1.7;margin:0 0 14px;font-size:15px}a.btn{display:inline-block;background:#1A2238;color:#fff;padding:12px 26px;border-radius:12px;text-decoration:none;font-weight:700}</style></head>
<body><div class="box"><h1>${title}</h1><p>${body}</p>${link ? `<a class="btn" href="${link}">리뷰 페이지로</a>` : ''}</div></body></html>`);
}

async function summary(app) {
    const c = summaryCache.get(app);
    if (c && Date.now() - c.at < 60 * 1000) return c.data;
    const r = await db.select('market_review_summary', `select=*&app_code=eq.${app}`);
    const row = (r.data || [])[0];
    const data = row ? { count: row.review_count, avg: row.avg_stars == null ? null : Number(row.avg_stars), dist: { 5: row.s5, 4: row.s4, 3: row.s3, 2: row.s2, 1: row.s1 } }
                     : { count: 0, avg: null, dist: { 5: 0, 4: 0, 3: 0, 2: 0, 1: 0 } };
    summaryCache.set(app, { at: Date.now(), data });
    return data;
}

async function verifiedBuy(emailHash) {
    // Orders 시트(구글시트)의 주문 이메일과 대조 — 시트 접근 실패는 무시(배지만 못 붙음)
    try {
        const { getOrdersByEmailHash } = require('./lib/sheets.js');
        if (typeof getOrdersByEmailHash !== 'function') return false;
        return await getOrdersByEmailHash(emailHash, R.emailHash);
    } catch (e) { return false; }
}

// ---------- GET ----------
async function handleGet(req, res) {
    const q = req.query || {};
    if (q.verify) return handleVerify(req, res, String(q.verify));
    const app = String(q.app || '').trim();
    if (!R.validApp(app)) return res.status(400).json({ success: false, error: '어느 앱의 리뷰인지 알 수 없습니다.' });
    if (q.summary) {
        res.setHeader('Cache-Control', 'public, max-age=60, s-maxage=60');
        return res.status(200).json(Object.assign({ success: true }, await summary(app)));
    }
    const sort = q.sort === 'stars' ? 'stars.desc.nullslast,published_at.desc' : 'published_at.desc';
    const page = Math.max(1, parseInt(q.page, 10) || 1);
    const r = await db.select('market_reviews', `select=*&app_code=eq.${app}&status=eq.published&order=${sort}&limit=${PAGE + 1}&offset=${(page - 1) * PAGE}`);
    const rows = r.data || [];
    const hasMore = rows.length > PAGE;
    const items = rows.slice(0, PAGE);
    let counts = {};
    if (items.length) {
        const ids = items.map(x => x.id).join(',');
        const c = await db.select('market_comments', `select=review_id&status=eq.published&review_id=in.(${ids})`);
        (c.data || []).forEach(x => { counts[x.review_id] = (counts[x.review_id] || 0) + 1; });
    }
    res.setHeader('Cache-Control', 'no-store');
    return res.status(200).json({ success: true, summary: await summary(app), items: items.map(x => R.publicReview(x, counts[x.id])), page, hasMore });
}

async function handleVerify(req, res, token) {
    let t;
    try { t = await R.consumeToken(token, ['review', 'review_edit', 'review_delete', 'review_manage']); } catch (e) { t = null; }
    if (!t) return html(res, 400, '이 링크는 사용할 수 없습니다', '만료되었거나 이미 사용한 링크입니다. 리뷰 페이지에서 다시 시도해 주세요.', `${m.baseUrl(req)}/market`);
    const r = await db.select('market_reviews', `select=*&id=eq.${t.target_id}&limit=1`);
    const rv = r.data && r.data[0];
    if (!rv || rv.status === 'deleted') return html(res, 404, '리뷰를 찾을 수 없습니다', '이미 지워진 리뷰입니다.', `${m.baseUrl(req)}/market`);
    const app = rv.app_code;
    const now = new Date().toISOString();
    if (t.kind === 'review') {
        const patch = { status: 'published', published_at: rv.published_at || now, updated_at: now };
        if (!rv.verified_buy) patch.verified_buy = await verifiedBuy(rv.email_hash);
        await db.update('market_reviews', `id=eq.${rv.id}`, patch);
        summaryCache.delete(app);
        return res.redirect(302, reviewsUrl(req, app, `?verified=${rv.id}`));
    }
    if (t.kind === 'review_edit') {
        if (rv.pending_body == null && rv.pending_stars == null && rv.pending_nick == null) return html(res, 400, '바꿀 내용이 없습니다', '수정한 내용이 없거나 이미 반영되었습니다.', reviewsUrl(req, app));
        await db.update('market_reviews', `id=eq.${rv.id}`, {
            body: rv.pending_body != null ? rv.pending_body : rv.body, stars: rv.pending_stars != null ? rv.pending_stars : rv.stars, nick: rv.pending_nick || rv.nick,
            pending_body: null, pending_stars: null, pending_nick: null, edit_count: (rv.edit_count || 0) + 1, updated_at: now,
            status: rv.status === 'pending' ? 'published' : rv.status, published_at: rv.published_at || now
        });
        summaryCache.delete(app);
        return res.redirect(302, reviewsUrl(req, app, `?verified=${rv.id}&edited=1`));
    }
    if (t.kind === 'review_delete') {
        await db.update('market_reviews', `id=eq.${rv.id}`, { status: 'deleted', updated_at: now });
        await db.update('market_comments', `review_id=eq.${rv.id}&status=neq.deleted`, { status: 'hidden' });   // 댓글 함께 숨김
        summaryCache.delete(app);
        return res.redirect(302, reviewsUrl(req, app, `?deleted=1`));
    }
    // review_manage: 내 리뷰 고치기·지우기 — 새 관리 토큰(24h)을 발급해 화면에 넘긴다(위 토큰은 1회용)
    const manage = await R.createToken('review_manage', rv.id);
    return res.redirect(302, reviewsUrl(req, app, `?manage=${manage}#write`));
}

// ---------- POST ----------
async function handlePost(req, res) {
    const b = req.body || {};
    if (String(b.website || '').trim()) return res.status(200).json({ success: true, pending: true });   // honeypot
    const ip = R.clientIp(req);
    const action = String(b.action || 'create');

    if (action === 'edit' || action === 'delete') return handleManage(req, res, b, ip, action);

    const app = String(b.app || '').trim();
    const email = String(b.email || '').trim();
    if (!R.validApp(app)) return res.status(400).json({ success: false, error: '어느 앱의 리뷰인지 알 수 없습니다.' });
    if (!R.isValidEmail(email)) return res.status(400).json({ success: false, error: '이메일 주소를 확인해 주세요.' });
    const eh = R.emailHash(email);
    const existing = (await db.select('market_reviews', `select=*&app_code=eq.${app}&email_hash=eq.${eh}&limit=1`)).data[0];

    if (action === 'manage') {
        if (!existing || existing.status === 'deleted') return res.status(404).json({ success: false, error: '이 이메일로 남긴 리뷰가 없습니다.' });
        if (await R.rateLimited(ip, 'review')) return res.status(429).json({ success: false, error: '요청이 너무 많습니다. 1분 뒤에 다시 시도해 주세요.' });
        const token = await R.createToken('review_manage', existing.id);
        await sendReviewVerifyEmail({ email, nick: existing.nick, appName: appName(app), kind: 'review_manage', link: `${m.baseUrl(req)}/api/reviews?verify=${token}` });
        return res.status(200).json({ success: true, sent: true });
    }

    // create
    const nick = R.cleanText(b.nick, 20);
    const body = R.mask(R.cleanText(b.body, 1000));
    const stars = b.stars == null || b.stars === '' ? null : parseInt(b.stars, 10);
    if (R.len(nick) < 2) return res.status(400).json({ success: false, error: '닉네임을 2자 이상 적어 주세요.' });
    if (stars != null && !(stars >= 1 && stars <= 5)) return res.status(400).json({ success: false, error: '별점은 1~5 사이입니다.' });
    if (R.len(body) < 10) return res.status(400).json({ success: false, error: '내용을 10자 이상 적어 주세요.' });
    if (existing && existing.status !== 'deleted') {
        return res.status(409).json({ success: false, duplicate: true, error: '이 이메일로 이미 남긴 리뷰가 있습니다. "내 리뷰 고치기"에서 고치거나 지울 수 있습니다.' });
    }
    // 레이트리밋은 입력 검증을 통과한 실제 저장 요청에만(오타 재시도로 막히지 않게)
    if (await R.rateLimited(ip, 'review')) return res.status(429).json({ success: false, error: '요청이 너무 많습니다. 1분 뒤에 다시 시도해 주세요.' });
    let row;
    if (existing) {   // 지운 리뷰가 있던 이메일 → 같은 행을 다시 사용
        row = (await db.update('market_reviews', `id=eq.${existing.id}`, { nick, stars, body, status: 'pending', pending_body: null, pending_stars: null, pending_nick: null,
              report_count: 0, published_at: null, ip_hash: R.ipHash(ip), updated_at: new Date().toISOString() }))[0];
    } else {
        row = await db.insert('market_reviews', { app_code: app, nick, email_hash: eh, stars, body, status: 'pending', ip_hash: R.ipHash(ip) });
    }
    const token = await R.createToken('review', row.id);
    await sendReviewVerifyEmail({ email, nick, appName: appName(app), kind: 'review', link: `${m.baseUrl(req)}/api/reviews?verify=${token}`, preview: (stars ? '★'.repeat(stars) + '\n' : '') + body });
    return res.status(200).json({ success: true, pending: true });
}

async function handleManage(req, res, b, ip, action) {
    const manage = String(b.manage || '');
    const t = await R.consumeToken(manage, ['review_manage']);
    if (!t) return res.status(400).json({ success: false, error: '이 링크는 사용할 수 없습니다. "내 리뷰 고치기"에서 다시 요청해 주세요.' });
    const rv = (await db.select('market_reviews', `select=*&id=eq.${t.target_id}&limit=1`)).data[0];
    if (!rv || rv.status === 'deleted') return res.status(404).json({ success: false, error: '이미 지워진 리뷰입니다.' });
    const email = String(b.email || '').trim();
    if (!R.isValidEmail(email) || R.emailHash(email) !== rv.email_hash) return res.status(400).json({ success: false, error: '리뷰를 남길 때 사용한 이메일 주소를 적어 주세요.' });
    if (await R.rateLimited(ip, 'review')) return res.status(429).json({ success: false, error: '요청이 너무 많습니다. 1분 뒤에 다시 시도해 주세요.' });
    const app = rv.app_code;
    if (action === 'delete') {
        const token = await R.createToken('review_delete', rv.id);
        await sendReviewVerifyEmail({ email, nick: rv.nick, appName: appName(app), kind: 'review_delete', link: `${m.baseUrl(req)}/api/reviews?verify=${token}`, preview: rv.body });
        return res.status(200).json({ success: true, sent: true });
    }
    const nick = b.nick == null || b.nick === '' ? null : R.cleanText(b.nick, 20);
    const body = b.body == null || b.body === '' ? null : R.mask(R.cleanText(b.body, 1000));
    const stars = b.stars == null || b.stars === '' ? null : parseInt(b.stars, 10);
    if (nick != null && R.len(nick) < 2) return res.status(400).json({ success: false, error: '닉네임을 2자 이상 적어 주세요.' });
    if (body != null && R.len(body) < 10) return res.status(400).json({ success: false, error: '내용을 10자 이상 적어 주세요.' });
    if (stars != null && !(stars >= 1 && stars <= 5)) return res.status(400).json({ success: false, error: '별점은 1~5 사이입니다.' });
    if (nick == null && body == null && stars == null) return res.status(400).json({ success: false, error: '바꿀 내용을 적어 주세요.' });
    // 게시본은 그대로 두고 수정본만 pending_* 에 (PC3 수정 3)
    await db.update('market_reviews', `id=eq.${rv.id}`, { pending_nick: nick, pending_body: body, pending_stars: stars, updated_at: new Date().toISOString() });
    const token = await R.createToken('review_edit', rv.id);
    await sendReviewVerifyEmail({ email, nick: nick || rv.nick, appName: appName(app), kind: 'review_edit', link: `${m.baseUrl(req)}/api/reviews?verify=${token}`, preview: (stars ? '★'.repeat(stars) + '\n' : '') + (body || rv.body) });
    return res.status(200).json({ success: true, sent: true });
}

module.exports = async function handler(req, res) {
    try {
        if (req.method === 'GET') return await handleGet(req, res);
        if (req.method === 'POST') return await handlePost(req, res);
        return res.status(405).json({ success: false, error: '허용되지 않은 메서드입니다.' });
    } catch (error) {
        console.error('reviews 오류:', error && error.message);
        return res.status(500).json({ success: false, error: '처리 중 오류가 생겼습니다. 잠시 후 다시 시도해 주세요.' });
    }
};
