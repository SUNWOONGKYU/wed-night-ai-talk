/**
 * GET /api/reserve-count → { count }
 * 출시 알림 예약 수 (Reservations 시트의 status RESERVED + NOTIFIED). 마켓 홈 카드의 "지금까지 N명 예약" 표시용.
 * 캐시 60초 (인스턴스 메모리 + Cache-Control). 시트 오류 시 0 (화면은 0이면 숨김).
 */

const { countReservations } = require('./lib/sheets.js');

const TTL_MS = 60 * 1000;
let cache = { at: 0, count: 0 };

module.exports = async function handler(req, res) {
    if (req.method !== 'GET') {
        return res.status(405).json({ error: '허용되지 않은 메서드입니다.' });
    }
    res.setHeader('Cache-Control', 'public, max-age=60, s-maxage=60');
    if (Date.now() - cache.at < TTL_MS) {
        return res.status(200).json({ count: cache.count });
    }
    try {
        const count = await countReservations();
        cache = { at: Date.now(), count };
        return res.status(200).json({ count });
    } catch (error) {
        console.error('reserve-count 오류:', error && error.message);
        return res.status(200).json({ count: cache.count || 0 });
    }
};
