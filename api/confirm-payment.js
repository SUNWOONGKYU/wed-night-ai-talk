/**
 * POST /api/confirm-payment — 토스페이먼츠 카드 결제 승인 (선택 기능)
 * TOSS_CLIENT_KEY / TOSS_SECRET_KEY 가 있을 때만 화면에 카드 결제가 노출된다.
 * 승인 성공 → 라이선스 키·JWT → Sheets 저장(status PAID) → 메일 발송
 *
 * 출처: 기존 판매 시스템 api/confirm-payment.js (알림톡 제거, 맥스 MACS 문안)
 * body: { paymentKey, orderId, amount, email?, name? }
 */

const { saveOrder, getOrder, saveEmailLog } = require('./lib/sheets.js');
const { generateDownloadToken, expiryHours } = require('./lib/jwt.js');
const { sendPurchaseEmail } = require('./lib/mailer.js');
const m = require('./lib/market.js');

module.exports = async function handler(req, res) {
    if (req.method !== 'POST') {
        return res.status(405).json({ success: false, error: '허용되지 않은 메서드입니다.' });
    }
    if (!process.env.TOSS_SECRET_KEY) {
        return res.status(503).json({ success: false, error: '카드 결제는 아직 준비 중입니다.' });
    }

    const body = req.body || {};
    const { paymentKey, orderId } = body;
    const amount = parseInt(body.amount, 10);

    if (!paymentKey || !orderId || !amount) {
        return res.status(400).json({ success: false, error: '결제 정보가 올바르지 않습니다.' });
    }
    if (amount !== m.PRODUCT.price) {
        return res.status(400).json({ success: false, error: '결제 금액이 상품 가격과 다릅니다.' });
    }

    try {
        const existing = await getOrder(orderId);
        if (existing) {
            return res.status(200).json({ success: true, orderId, email: existing.customerEmail, message: '이미 처리된 주문입니다.' });
        }

        const response = await fetch('https://api.tosspayments.com/v1/payments/confirm', {
            method: 'POST',
            headers: {
                'Authorization': 'Basic ' + Buffer.from(process.env.TOSS_SECRET_KEY + ':').toString('base64'),
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ paymentKey, orderId, amount })
        });
        const payment = await response.json();
        if (!response.ok) {
            throw new Error(payment.message || '결제 승인 실패');
        }

        const email = String(payment.customerEmail || body.email || '').trim();
        const name = String(payment.customerName || body.name || '').trim();
        if (!m.isValidEmail(email)) {
            throw new Error('결제 정보에 이메일이 없습니다. 판매자에게 주문번호와 함께 문의해 주세요.');
        }

        const licenseKey = m.generateLicenseKey();
        const downloadToken = generateDownloadToken({ orderId, customerEmail: email });
        const base = m.baseUrl(req);

        await saveOrder({
            orderId, paymentKey, amount,
            customerEmail: email, customerName: name,
            customerPhone: payment.customerMobilePhone || '',
            status: 'PAID',
            paidAt: payment.approvedAt || new Date().toISOString(),
            downloadToken, paymentMethod: 'card', licenseKey, product: m.PRODUCT.label
        });

        await sendPurchaseEmail({
            name, email, orderId, amount, paymentMethod: 'card', licenseKey,
            downloadLink: `${base}/api/download/${downloadToken}`,
            consoleGuideLink: `${base}/console`,
            renewLink: `${base}/market#renew`,
            expiryHours: expiryHours(),
            maxDownloads: parseInt(process.env.MAX_DOWNLOAD_COUNT, 10) || 5
        });
        await saveEmailLog({ paymentMethod: 'card', email, name, success: true });

        return res.status(200).json({ success: true, orderId, email });
    } catch (error) {
        console.error('confirm-payment 오류:', error && error.message);
        return res.status(500).json({ success: false, error: error.message || '결제 처리 중 오류가 발생했습니다.' });
    }
};
