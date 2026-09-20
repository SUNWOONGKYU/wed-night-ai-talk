/**
 * JWT 다운로드 토큰 — 보안 다운로드 링크 생성/검증
 * 출처: 기존 판매 시스템 api/lib/jwt.js (ESM → CommonJS 만 변경)
 *
 * 환경변수: JWT_SECRET (32자 이상), DOWNLOAD_TOKEN_EXPIRY_HOURS (기본 24)
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

/** @param {{orderId:string, customerEmail:string}} payload */
function generateDownloadToken(payload) {
    return jwt.sign(
        { orderId: payload.orderId, customerEmail: payload.customerEmail, type: 'download' },
        secret(),
        { expiresIn: `${expiryHours()}h` }
    );
}

/** 유효하지 않으면 throw (메시지는 사용자에게 그대로 보여줄 수 있는 한국어) */
function verifyDownloadToken(token) {
    try {
        const decoded = jwt.verify(String(token || ''), secret());
        if (decoded.type !== 'download') throw new Error('유효하지 않은 토큰 타입입니다.');
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
