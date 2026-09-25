/**
 * POST /api/reserve — 출시 알림 예약 (정식 출시 전, 해당 상품이 reserve 모드일 때 상세 페이지 #reserve 폼이 호출)
 *
 * body 의 product 로 어느 상품의 예약인지 받는다(2026-09-23). 같은 사람이 원맥스와
 * 보고서 작성 AI 에이전트를 따로 예약할 수 있으므로, 중복 판정도 이메일+상품으로 본다.
 *   이메일 형식·수신 동의 검증 → 같은 이메일이 Reservations 시트에 있으면 기존 예약번호 반환(duplicate: true)
 *   → 없으면 예약번호 RS-YYYYMMDD-XXXX 발급 → Reservations 시트 기록(status RESERVED)
 *   → 예약 완료 이메일(Gmail) → EmailLogs 기록(paymentMethod 'reserve')
 *
 * 출시 첫날 발송은 scripts/notify-reservations.js (PO 지시 때만 실행).
 * 레이트리밋: 같은 IP 분당 5회 (인스턴스 메모리 — 서버리스라 완전하진 않지만 단순 남용은 막는다)
 *
 * body: { email, name?, phone?, agree: true }
 */

const { getReservationByEmail, saveReservation, saveEmailLog } = require('./lib/sheets.js');
const { sendReservationEmail } = require('./lib/mailer.js');
const m = require('./lib/market.js');

const RATE_LIMIT = 5;                 // 회 / 분 / IP
const RATE_WINDOW_MS = 60 * 1000;
const hits = new Map();               // ip → [timestamp...]

function clientIp(req) {
    const xf = req.headers && (req.headers['x-forwarded-for'] || req.headers['x-real-ip']);
    if (xf) return String(xf).split(',')[0].trim();
    return (req.socket && req.socket.remoteAddress) || 'unknown';
}

function rateLimited(ip) {
    const now = Date.now();
    const list = (hits.get(ip) || []).filter(t => now - t < RATE_WINDOW_MS);
    if (list.length >= RATE_LIMIT) { hits.set(ip, list); return true; }
    list.push(now);
    hits.set(ip, list);
    if (hits.size > 5000) hits.clear();   // 메모리 상한
    return false;
}

module.exports = async function handler(req, res) {
    if (req.method !== 'POST') {
        return res.status(405).json({ success: false, error: '허용되지 않은 메서드입니다.' });
    }
    if (rateLimited(clientIp(req))) {
        return res.status(429).json({ success: false, error: '요청이 너무 많습니다. 1분 뒤에 다시 시도해 주세요.' });
    }

    const body = req.body || {};
    const email = String(body.email || '').trim();
    const name = String(body.name || '').replace(/[\uFFFD\u0000-\u001f]/g, '').trim().slice(0, 50);
    const phone = String(body.phone || '').trim().slice(0, 30);
    const agree = body.agree === true || body.agree === 'true' || body.agree === 1 || body.agree === 'on';
    const productId = String(body.product || m.DEFAULT_PRODUCT_ID).trim();
    const product = m.getProduct(productId);

    if (!m.isValidEmail(email)) {
        return res.status(400).json({ success: false, error: '올바른 이메일 주소를 입력해 주세요.' });
    }
    if (!agree) {
        return res.status(400).json({ success: false, error: '출시 안내 이메일 수신에 동의해 주세요.' });
    }
    if (!product) {
        return res.status(400).json({ success: false, error: '알 수 없는 상품입니다.' });
    }

    try {
        const existing = await getReservationByEmail(email, productId);
        if (existing) {
            return res.status(200).json({ success: true, duplicate: true, reserveId: existing.reserveId, email: existing.email });
        }

        const reserveId = m.generateReserveId();
        await saveReservation({ reserveId, email, name, phone, status: 'RESERVED', product: productId });

        try {
            await sendReservationEmail({ name, email, reserveId, productName: product.name, consoleGuideLink: `${m.baseUrl(req)}${product.guidePath}` });
            await saveEmailLog({ paymentMethod: 'reserve', email, name, success: true });
        } catch (mailErr) {
            // 시트에는 이미 기록됨 — 이메일 실패는 로그만 남기고 예약은 성공으로 처리(출시 첫날 발송은 시트 기준)
            console.error('reserve 이메일 실패:', mailErr && mailErr.message);
            try { await saveEmailLog({ paymentMethod: 'reserve', email, name, success: false, errorMessage: mailErr && mailErr.message }); } catch (e) { /* ignore */ }
        }

        return res.status(200).json({ success: true, reserveId, email, product: productId });
    } catch (error) {
        console.error('reserve 오류:', error && error.message);
        return res.status(500).json({
            success: false,
            error: '처리 중 오류가 발생했습니다. 잠시 후 다시 시도하시거나 ' + (m.supportEmail() || '판매자') + ' 로 문의해 주세요.'
        });
    }
};
