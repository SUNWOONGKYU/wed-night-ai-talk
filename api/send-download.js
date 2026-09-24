/**
 * POST /api/send-download
 * 송금(카카오페이/계좌이체) 후 구매자가 이메일·이름을 입력하면
 *   주문번호 발급 → 라이선스 키 생성 → JWT 다운로드 토큰 → Google Sheets 저장(status SELF_REPORTED)
 *   → Gmail 로 다운로드 링크 + 라이선스 키 발송 → EmailLogs 기록
 *
 * 출처: 기존 판매 시스템 api/send-download.js (즉시 발송·자기신고 정책 유지)
 *       + confirm-payment.js 의 JWT·Sheets 저장 흐름 결합
 *
 * body: { email, name, phone?, paymentMethod: 'kakaopay' | 'bank', product?: 'onemacs' | 'ReportWritingAgent' | 'StockTradeAutoSystem' }
 *
 * 2026-09-23 상품이 둘 이상이 되었다. 상품마다 파일과 토큰이 따로이고, 한 주문이 산 상품만 받는다.
 * (묶음 상품을 낼 때를 대비해 한 주문에 링크가 여럿 나가는 구조는 남겨 두었다 — market.js 의 includes)
 */

const { saveOrder, saveEmailLog } = require('./lib/sheets.js');
const { generateDownloadToken, expiryHours } = require('./lib/jwt.js');
const { sendPurchaseEmail } = require('./lib/mailer.js');
const m = require('./lib/market.js');

const ISSUER_URL = 'https://onemacs-issuer.consolesystem.workers.dev/v1/market/order';

/** 주소 분양 서버 통지. 실패는 기록만 하고 넘어간다 — 결제 흐름을 막지 않는다 */
async function notifyIssuer({ orderId, licenseKey, productId }) {
    const key = m.clean(process.env.MARKET_KEY);
    if (!key) { console.warn('MARKET_KEY 없음 — 주소 권리 등록을 건너뜁니다:', orderId); return; }
    try {
        const r = await fetch(ISSUER_URL, {
            method: 'POST',
            headers: {
                Authorization: `Bearer ${key}`,
                'Content-Type': 'application/json',
                // 기본 신분으로 부르면 클라우드플레어가 막을 수 있다(1010)
                'User-Agent': 'WAAT-Market/1.0 (+https://www.waat.community)'
            },
            body: JSON.stringify({ order_id: orderId, license: licenseKey, product: productId })
        });
        if (!r.ok) console.error('주소 권리 등록 실패', r.status, (await r.text()).slice(0, 200), orderId);
    } catch (e) {
        console.error('주소 권리 등록 오류:', e && e.message, orderId);
    }
}

module.exports = async function handler(req, res) {
    if (req.method !== 'POST') {
        return res.status(405).json({ success: false, error: '허용되지 않은 메서드입니다.' });
    }

    const body = req.body || {};
    const email = String(body.email || '').trim();
    const name = String(body.name || '').replace(/[\uFFFD\u0000-\u001f]/g, '').trim().slice(0, 50);
    const phone = String(body.phone || '').trim().slice(0, 30);
    const paymentMethod = String(body.paymentMethod || '').trim();
    const productId = String(body.product || m.DEFAULT_PRODUCT_ID).trim();
    const product = m.getProduct(productId);

    if (!m.isValidEmail(email)) {
        return res.status(400).json({ success: false, error: '올바른 이메일 주소를 입력해 주세요.' });
    }
    if (paymentMethod !== 'kakaopay' && paymentMethod !== 'bank') {
        return res.status(400).json({ success: false, error: '결제 방법을 선택해 주세요.' });
    }
    if (!product) {
        return res.status(400).json({ success: false, error: '알 수 없는 상품입니다.' });
    }

    const orderId = m.generateOrderId();
    const licenseKey = m.generateLicenseKey();
    const amount = product.price;
    const base = m.baseUrl(req);

    // 이 주문으로 받게 되는 상품 전부(산 것 + 끼워 주는 것). 파일이 없는 상품은 링크를 만들지 않는다.
    const gets = m.entitlements(productId).filter((id) => m.productDownloadUrl(id, base));
    if (!gets.length) {
        return res.status(503).json({ success: false, error: '다운로드 파일이 아직 준비되지 않았습니다. 판매자에게 문의해 주세요.' });
    }

    try {
        const downloads = gets.map((id) => {
            const p = m.getProduct(id);
            const token = generateDownloadToken({ orderId, customerEmail: email, product: id });
            return { id, label: p.fileLabel, name: p.name, link: `${base}/api/download/${token}`, token };
        });
        const downloadToken = downloads[0].token;   // 시트 호환 — 첫 번째(산 상품) 토큰
        const downloadLink = downloads[0].link;

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
            product: product.label
        });

        // 2. 주소 분양 서버에 주문을 알린다 — 라이선스 키로 고정 주소 권리를 등록한다.
        //    실패해도 결제와 메일을 막지 않는다. 손님이 돈을 내고 아무것도 못 받는 일이 없어야 한다.
        //    (같은 order_id 로 다시 불러도 분양 서버가 한 번만 처리한다)
        await notifyIssuer({ orderId, licenseKey, productId });

        // 3. 메일 발송
        await sendPurchaseEmail({
            name, email, orderId, amount, paymentMethod, licenseKey, downloadLink, downloads,
            productName: product.name,
            consoleGuideLink: `${base}${product.guidePath}`,
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
