/**
 * JWT 다운로드 토큰 — 보안 다운로드 링크 생성/검증
 * 출처: 기존 판매 시스템 api/lib/jwt.js (ESM → CommonJS 만 변경)
 *
 * 환경변수: JWT_SECRET (32자 이상). 내려받기 토큰에는 기한이 없다(2026-09-25 PO — 5번 제한만).
 *           DOWNLOAD_TOKEN_EXPIRY_HOURS 는 더 이상 토큰에 쓰지 않는다(expiryHours 는 옛 호출 호환용).
 */

const jwt = require('jsonwebtoken');

function secret() {
    const s = process.env.JWT_SECRET;
    if (!s) throw new Error('JWT_SECRET 환경변수가 설정되지 않았습니다.');
    return s;
}

function expiryHours() {
    return parseInt(process.env.DOWNLOAD_TOKEN_EXPIRY_HOURS, 10) || 24;
}

/**
 * @param {{orderId:string, customerEmail:string, product?:string}} payload
 * product — 어느 상품의 파일을 받는 링크인지(2026-09-23 상품이 둘 이상이 되면서 추가).
 *           한 주문이 상품을 둘 받으면 링크도 둘이고, 토큰이 서로 다른 상품을 가리킨다.
 */
function generateDownloadToken(payload) {
    return jwt.sign(
        { orderId: payload.orderId, customerEmail: payload.customerEmail, type: 'download',
          product: payload.product || 'onemacs',
          n: require('crypto').randomBytes(6).toString('hex') },   // 같은 초에 재발급해도 토큰이 달라지게
        secret()
        // 2026-09-25 PO: 24시간 제한을 뺀다. 내려받기는 5번까지만 센다([token].js 의 MAX_DOWNLOAD_COUNT).
        // 옛 토큰(exp 있음)은 그대로 만료 검사를 받는다.
    );
}

/** 유효하지 않으면 throw (메시지는 사용자에게 그대로 보여줄 수 있는 한국어) */
function verifyDownloadToken(token) {
    try {
        const decoded = jwt.verify(String(token || ''), secret());
        if (decoded.type !== 'download') throw new Error('유효하지 않은 토큰 타입입니다.');
        // 상품이 하나뿐이던 때 만든 옛 토큰에는 product 가 없다 — 원맥스로 본다
        if (!decoded.product) decoded.product = 'onemacs';
        return decoded;
    } catch (error) {
        if (error.name === 'TokenExpiredError') {
            throw new Error('다운로드 링크가 만료되었습니다. 링크 재발급을 요청해 주세요.');
        } else if (error.name === 'JsonWebTokenError') {
            throw new Error('유효하지 않은 다운로드 링크입니다.');
        }
        throw error;
    }
}

module.exports = { generateDownloadToken, verifyDownloadToken, expiryHours };
