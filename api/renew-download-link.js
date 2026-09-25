/**
 * POST /api/renew-download-link
 * 링크 만료·횟수 초과 시 구매자가 주문번호 + 이메일로 재발급 요청 → 새 JWT → 시트 갱신 → 이메일 재발송
 *
 * 출처: 기존 판매 시스템 api/renew-download-link.js (알림톡 부분 제거, 이메일 필수로 강화)
 * body: { orderId, email }
 */

const { getOrder, updateOrder, getDownloadCount, saveEmailLog } = require('./lib/sheets.js');
const { generateDownloadToken, expiryHours } = require('./lib/jwt.js');
const { sendPurchaseEmail } = require('./lib/mailer.js');
const m = require('./lib/market.js');

module.exports = async function handler(req, res) {
    if (req.method !== 'POST') {
        return res.status(405).json({ success: false, error: '허용되지 않은 메서드입니다.' });
    }
    const body = req.body || {};
    const orderId = String(body.orderId || '').trim().toUpperCase();
    const email = String(body.email || '').trim();

    if (!orderId || !m.isValidEmail(email)) {
        return res.status(400).json({ success: false, error: '주문번호와 이메일을 모두 입력해 주세요.' });
    }

    try {
        const order = await getOrder(orderId);
        // 존재 여부·이메일 불일치를 구분해 알려주지 않는다 (주문번호 추측 방지)
        if (!order || order.customerEmail.trim().toLowerCase() !== email.toLowerCase()) {
            return res.status(404).json({ success: false, error: '일치하는 주문이 없습니다. 주문번호와 이메일을 확인해 주세요.' });
        }
        if (order.status === 'REFUNDED' || order.status === 'CANCELLED') {
            return res.status(403).json({ success: false, error: '환불 또는 취소된 주문은 재발급할 수 없습니다.' });
        }

        const maxDownloads = parseInt(process.env.MAX_DOWNLOAD_COUNT, 10) || 5;
        const count = await getDownloadCount(orderId);
        if (count >= maxDownloads) {
            return res.status(429).json({ success: false, error: `최대 다운로드 횟수(${maxDownloads}회)를 모두 사용했습니다. ${m.supportEmail() || '판매자'} 로 문의해 주세요.` });
        }

        const downloadToken = generateDownloadToken({ orderId, customerEmail: order.customerEmail });
        await updateOrder(orderId, { downloadToken });

        const base = m.baseUrl(req);
        await sendPurchaseEmail({
            renewal: true,
            name: order.customerName, email: order.customerEmail, orderId,
            amount: order.amount, paymentMethod: order.paymentMethod, licenseKey: order.licenseKey,
            downloadLink: `${base}/api/download/${downloadToken}`,
            consoleGuideLink: `${base}/market/onemacs/install`,
            renewLink: `${base}/market/onemacs#renew`,
            expiryHours: expiryHours(),
            maxDownloads
        });
        await saveEmailLog({ paymentMethod: 'renew', email: order.customerEmail, name: order.customerName, success: true });

        return res.status(200).json({ success: true, email: order.customerEmail, remaining: maxDownloads - count });
    } catch (error) {
        console.error('renew-download-link 오류:', error && error.message);
        return res.status(500).json({ success: false, error: '재발급 처리 중 오류가 발생했습니다. 잠시 후 다시 시도해 주세요.' });
    }
};
