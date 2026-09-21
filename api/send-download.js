/**
 * POST /api/send-download
 * 송금(카카오페이/계좌이체) 후 구매자가 이메일·이름을 입력하면
 *   주문번호 발급 → 라이선스 키 생성 → JWT 다운로드 토큰 → Google Sheets 저장(status SELF_REPORTED)
 *   → Gmail 로 다운로드 링크 + 라이선스 키 발송 → EmailLogs 기록
 *
 * 출처: 기존 판매 시스템 api/send-download.js (즉시 발송·자기신고 정책 유지)
 *       + confirm-payment.js 의 JWT·Sheets 저장 흐름 결합
 *
 * body: { email, name, phone?, paymentMethod: 'kakaopay' | 'bank' }
 */

const { saveOrder, saveEmailLog } = require('./lib/sheets.js');
const { generateDownloadToken, expiryHours } = require('./lib/jwt.js');
const { sendPurchaseEmail } = require('./lib/mailer.js');
const m = require('./lib/market.js');

module.exports = async function handler(req, res) {
    if (req.method !== 'POST') {
        return res.status(405).json({ success: false, error: '허용되지 않은 메서드입니다.' });
    }

    const body = req.body || {};
    const email = String(body.email || '').trim();
    const name = String(body.name || '').replace(/[\uFFFD\u0000-\u001f]/g, '').trim().slice(0, 50);
    const phone = String(body.phone || '').trim().slice(0, 30);
    const paymentMethod = String(body.paymentMethod || '').trim();

    if (!m.isValidEmail(email)) {
        return res.status(400).json({ success: false, error: '올바른 이메일 주소를 입력해 주세요.' });
    }
    if (paymentMethod !== 'kakaopay' && paymentMethod !== 'bank') {
        return res.status(400).json({ success: false, error: '결제 방법을 선택해 주세요.' });
    }
    if (!m.apkDownloadUrl()) {
        return res.status(503).json({ success: false, error: '다운로드 파일이 아직 준비되지 않았습니다. 판매자에게 문의해 주세요.' });
    }

    const orderId = m.generateOrderId();
    const licenseKey = m.generateLicenseKey();
    const amount = m.PRODUCT.price;
    const base = m.baseUrl(req);

    try {
        const downloadToken = generateDownloadToken({ orderId, customerEmail: email });
        const downloadLink = `${base}/api/download/${downloadToken}`;

        // 1. 시트에 주문 기록 (자기 신고 — 나중에 통장·카카오페이 내역과 대조)
        await saveOrder({
            orderId,
            paymentKey: '',
            amount,
            customerEmail: email,
            customerName: name,
            customerPhone: phone,
            status: 'SELF_REPORTED',
            paidAt: '',
            downloadToken,
            paymentMethod,
            licenseKey,
            product: m.PRODUCT.label
        });

        // 2. 메일 발송
        await sendPurchaseEmail({
            name, email, orderId, amount, paymentMethod, licenseKey, downloadLink,
            consoleGuideLink: `${base}/market/onemacs/install`,
            renewLink: `${base}/market/onemacs#renew`,
            expiryHours: expiryHours(),
            maxDownloads: parseInt(process.env.MAX_DOWNLOAD_COUNT, 10) || 5
        });

        await saveEmailLog({ paymentMethod, email, name, success: true });

        return res.status(200).json({ success: true, orderId, email });
    } catch (error) {
        console.error('send-download 오류:', error && error.message);
        try { await saveEmailLog({ paymentMethod, email, name, success: false, errorMessage: error && error.message }); } catch (e) { /* ignore */ }
        return res.status(500).json({
            success: false,
            error: '처리 중 오류가 발생했습니다. 잠시 후 다시 시도하시거나 ' + (m.supportEmail() || '판매자') + ' 로 문의해 주세요.'
        });
    }
};
