/**
 * /api/review-admin — 판매자 관리 (헤더 X-Admin-Key = 환경변수 REVIEW_ADMIN_KEY)
 *   GET  ?app=onemacs                         pending·published·hidden 전체 리뷰 + 댓글 (deleted 제외)
 *   POST {action:'hide'|'restore'|'delete', kind:'review'|'comment', id}
 *   POST {action:'seller-reply', review, parent?, body}   판매자 답글 — 닉네임 "파인더월드"(상호) + 판매자 배지, 확인 절차 없이 즉시 게시
 * 관리 키는 브라우저에서 sessionStorage 에만 둔다(URL·localStorage 금지 — PC3).
 */

const db = require('./lib/supabase.js');
const R = require('./lib/reviews.js');
const m = require('./lib/market.js');

const UUID = /^[0-9a-f-]{36}$/i;
const SELLER_NICK = '파인더월드';

module.exports = async function handler(req, res) {
    try {
        if (!R.adminKeyOk(req)) return res.status(401).json({ success: false, error: '관리 키가 맞지 않습니다.' });
        if (req.method === 'GET') {
            const app = String((req.query || {}).app || '').trim();
            if (!R.validApp(app)) return res.status(400).json({ success: false, error: '앱을 지정해 주세요.' });
            const rv = (await db.select('market_reviews', `select=*&app_code=eq.${app}&status=neq.deleted&order=created_at.desc&limit=200`)).data || [];
            let comments = [];
            if (rv.length) comments = (await db.select('market_comments', `select=*&review_id=in.(${rv.map(x => x.id).join(',')})&status=neq.deleted&order=created_at.asc&limit=1000`)).data || [];
            res.setHeader('Cache-Control', 'no-store');
            return res.status(200).json({ success: true,
                items: rv.map(x => Object.assign(R.publicReview(x, comments.filter(c => c.review_id === x.id && c.status === 'published').length), { reportCount: x.report_count, createdAt: x.created_at, pendingBody: x.pending_body, pendingStars: x.pending_stars })),
                comments: comments.map(c => Object.assign(R.publicComment(c), { reviewId: c.review_id, reportCount: c.report_count, createdAt: c.created_at })) });
        }
        if (req.method !== 'POST') return res.status(405).json({ success: false, error: '허용되지 않은 메서드입니다.' });
        const b = req.body || {};
        const action = String(b.action || '');
        if (action === 'seller-reply') {
            const review = String(b.review || ''); const parent = b.parent ? String(b.parent) : null;
            const body = R.cleanText(b.body, 500);
            if (!UUID.test(review) || (parent && !UUID.test(parent))) return res.status(400).json({ success: false, error: '어느 리뷰의 답글인지 알 수 없습니다.' });
            if (R.len(body) < 2) return res.status(400).json({ success: false, error: '내용을 2자 이상 적어 주세요.' });
            if (parent) {
                const pc = (await db.select('market_comments', `select=id,parent_id,review_id&id=eq.${parent}&limit=1`)).data[0];
                if (!pc || pc.review_id !== review) return res.status(404).json({ success: false, error: '답글을 달 댓글을 찾을 수 없습니다.' });
                if (pc.parent_id) return res.status(400).json({ success: false, error: '답글에는 답글을 달 수 없습니다.' });
            }
            const row = await db.insert('market_comments', { review_id: review, parent_id: parent, nick: SELLER_NICK, email_hash: 'seller', is_seller: true, body,
                                                             status: 'published', published_at: new Date().toISOString(), ip_hash: R.ipHash(R.clientIp(req)) });
            return res.status(200).json({ success: true, item: R.publicComment(row) });
        }
        const kind = b.kind === 'comment' ? 'comment' : 'review'; const id = String(b.id || '');
        if (!UUID.test(id)) return res.status(400).json({ success: false, error: '대상을 알 수 없습니다.' });
        const status = { hide: 'hidden', restore: 'published', delete: 'deleted' }[action];
        if (!status) return res.status(400).json({ success: false, error: '알 수 없는 동작입니다.' });
        const table = kind === 'comment' ? 'market_comments' : 'market_reviews';
        const patch = { status };
        if (action === 'restore') patch.report_count = 0;
        const rows = await db.update(table, `id=eq.${id}`, patch);
        if (!rows || !rows.length) return res.status(404).json({ success: false, error: '대상을 찾을 수 없습니다.' });
        if (kind === 'review' && (action === 'hide' || action === 'delete')) await db.update('market_comments', `review_id=eq.${id}&status=eq.published`, { status: 'hidden' });
        return res.status(200).json({ success: true, status });
    } catch (error) {
        console.error('review-admin 오류:', error && error.message);
        return res.status(500).json({ success: false, error: '처리 중 오류가 생겼습니다. 잠시 후 다시 시도해 주세요.' });
    }
};
