/**
 * POST /api/review-report {kind:'review'|'comment', id, reason}
 * 같은 IP 는 같은 대상에 1회. report_count 3 이상이면 자동 숨김(status hidden) + 판매자 알림 메일. 복구는 관리 모드(/api/review-admin).
 */

const db = require('./lib/supabase.js');
const R = require('./lib/reviews.js');
const m = require('./lib/market.js');
const { sendReportAlertEmail } = require('./lib/mailer.js');

const UUID = /^[0-9a-f-]{36}$/i;
const AUTO_HIDE = 3;

module.exports = async function handler(req, res) {
    if (req.method !== 'POST') return res.status(405).json({ success: false, error: '허용되지 않은 메서드입니다.' });
    try {
        const b = req.body || {};
        const kind = b.kind === 'comment' ? 'comment' : b.kind === 'review' ? 'review' : '';
        const id = String(b.id || ''); const reason = String(b.reason || '');
        if (!kind || !UUID.test(id)) return res.status(400).json({ success: false, error: '신고할 대상을 알 수 없습니다.' });
        if (!R.REASONS[reason]) return res.status(400).json({ success: false, error: '신고 사유를 골라 주세요.' });
        const ip = R.clientIp(req);
        if (await R.rateLimited(ip, 'report')) return res.status(429).json({ success: false, error: '요청이 너무 많습니다. 1분 뒤에 다시 시도해 주세요.' });
        const table = kind === 'comment' ? 'market_comments' : 'market_reviews';
        const row = (await db.select(table, `select=*&id=eq.${id}&limit=1`)).data[0];
        if (!row || row.status !== 'published') return res.status(404).json({ success: false, error: '신고할 대상을 찾을 수 없습니다.' });
        try {
            await db.insert('market_reports', { kind, target_id: id, reason, ip_hash: R.ipHash(ip) });
        } catch (e) {
            if (e.status === 409) return res.status(200).json({ success: true, already: true });   // 같은 IP 중복 신고
            throw e;
        }
        const count = (row.report_count || 0) + 1;
        const patch = { report_count: count };
        if (count >= AUTO_HIDE) patch.status = 'hidden';
        await db.update(table, `id=eq.${id}`, patch);
        if (count >= AUTO_HIDE) {
            try {
                const app = kind === 'comment' ? ((await db.select('market_reviews', `select=app_code&id=eq.${row.review_id}&limit=1`)).data[0] || {}).app_code : row.app_code;
                const reasons = (await db.select('market_reports', `select=reason&kind=eq.${kind}&target_id=eq.${id}`)).data.map(x => R.REASONS[x.reason] || x.reason).join(', ');
                await sendReportAlertEmail({ to: R.sellerNotifyEmail(), kind, appName: app === 'onemacs' ? m.PRODUCT.name : app, nick: row.nick, body: row.body, reasons,
                                             adminLink: `${m.baseUrl(req)}/market/${encodeURIComponent(app || 'onemacs')}/reviews?admin=1` });
            } catch (e) { console.error('신고 알림 메일 실패:', e && e.message); }
        }
        return res.status(200).json({ success: true, hidden: count >= AUTO_HIDE });
    } catch (error) {
        console.error('review-report 오류:', error && error.message);
        return res.status(500).json({ success: false, error: '처리 중 오류가 생겼습니다. 잠시 후 다시 시도해 주세요.' });
    }
};
