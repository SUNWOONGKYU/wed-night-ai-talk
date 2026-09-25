/**
 * /api/review-comments — 리뷰 댓글·답글 (답글은 1단계까지)
 *   GET  ?review=<id>                          published 댓글·답글 (시간순, 부모→자식은 화면에서 묶음)
 *   GET  ?verify=<token>                       확인 링크 → 게시 → 302 리뷰 페이지 #c-<id>
 *   POST {review, parent?, nick, email, body, website}   댓글(pending) → 확인 이메일
 */

const db = require('./lib/supabase.js');
const R = require('./lib/reviews.js');
const m = require('./lib/market.js');
const { sendReviewVerifyEmail } = require('./lib/mailer.js');

const UUID = /^[0-9a-f-]{36}$/i;
function appName(app) { return app === 'onemacs' ? m.PRODUCT.name : app; }

module.exports = async function handler(req, res) {
    try {
        if (req.method === 'GET') {
            const q = req.query || {};
            if (q.verify) {
                const t = await R.consumeToken(String(q.verify), ['comment']);
                const c = t && (await db.select('market_comments', `select=*&id=eq.${t.target_id}&limit=1`)).data[0];
                if (!c || c.status === 'deleted') {
                    return res.status(400).send('<!DOCTYPE html><html lang="ko"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>이 링크는 사용할 수 없습니다</title></head><body style="font-family:sans-serif;padding:32px;text-align:center"><h1 style="font-size:20px">이 링크는 사용할 수 없습니다</h1><p>만료되었거나 이미 사용한 링크입니다. 리뷰 페이지에서 다시 시도해 주세요.</p></body></html>');
                }
                if (c.status === 'pending') await db.update('market_comments', `id=eq.${c.id}`, { status: 'published', published_at: new Date().toISOString() });
                const rv = (await db.select('market_reviews', `select=app_code&id=eq.${c.review_id}&limit=1`)).data[0];
                return res.redirect(302, `${m.baseUrl(req)}/market/${encodeURIComponent(rv ? rv.app_code : 'onemacs')}/reviews?verified=${c.review_id}#c-${c.id}`);
            }
            const review = String(q.review || '');
            if (!UUID.test(review)) return res.status(400).json({ success: false, error: '어느 리뷰의 댓글인지 알 수 없습니다.' });
            const r = await db.select('market_comments', `select=*&review_id=eq.${review}&status=eq.published&order=created_at.asc&limit=200`);
            res.setHeader('Cache-Control', 'no-store');
            return res.status(200).json({ success: true, items: (r.data || []).map(R.publicComment) });
        }
        if (req.method !== 'POST') return res.status(405).json({ success: false, error: '허용되지 않은 메서드입니다.' });

        const b = req.body || {};
        if (String(b.website || '').trim()) return res.status(200).json({ success: true, pending: true });   // honeypot
        const ip = R.clientIp(req);
        const review = String(b.review || ''); const parent = b.parent ? String(b.parent) : null;
        const nick = R.cleanText(b.nick, 20); const email = String(b.email || '').trim(); const body = R.mask(R.cleanText(b.body, 500));
        if (!UUID.test(review) || (parent && !UUID.test(parent))) return res.status(400).json({ success: false, error: '어느 리뷰의 댓글인지 알 수 없습니다.' });
        if (R.len(nick) < 2) return res.status(400).json({ success: false, error: '닉네임을 2자 이상 적어 주세요.' });
        if (!R.isValidEmail(email)) return res.status(400).json({ success: false, error: '이메일 주소를 확인해 주세요.' });
        if (R.len(body) < 2) return res.status(400).json({ success: false, error: '내용을 2자 이상 적어 주세요.' });
        if (await R.rateLimited(ip, 'comment')) return res.status(429).json({ success: false, error: '요청이 너무 많습니다. 1분 뒤에 다시 시도해 주세요.' });

        const rv = (await db.select('market_reviews', `select=id,app_code,status&id=eq.${review}&limit=1`)).data[0];
        if (!rv || rv.status !== 'published') return res.status(404).json({ success: false, error: '댓글을 달 리뷰를 찾을 수 없습니다.' });
        if (parent) {
            const pc = (await db.select('market_comments', `select=id,parent_id,status,review_id&id=eq.${parent}&limit=1`)).data[0];
            if (!pc || pc.review_id !== review || pc.status !== 'published') return res.status(404).json({ success: false, error: '답글을 달 댓글을 찾을 수 없습니다.' });
            if (pc.parent_id) return res.status(400).json({ success: false, error: '답글에는 답글을 달 수 없습니다. 댓글에 답글을 달아 주세요.' });
        }
        const row = await db.insert('market_comments', { review_id: review, parent_id: parent, nick, email_hash: R.emailHash(email), body, status: 'pending', ip_hash: R.ipHash(ip) });
        const token = await R.createToken('comment', row.id);
        await sendReviewVerifyEmail({ email, nick, appName: appName(rv.app_code), kind: 'comment', link: `${m.baseUrl(req)}/api/review-comments?verify=${token}`, preview: body });
        return res.status(200).json({ success: true, pending: true });
    } catch (error) {
        console.error('review-comments 오류:', error && error.message);
        return res.status(500).json({ success: false, error: '처리 중 오류가 생겼습니다. 잠시 후 다시 시도해 주세요.' });
    }
};
