/**
 * 앱 마켓 공통 — 상품 정보, 주문번호·라이선스 키 생성, 다운로드 파일 위치, 입력 검증
 *
 * 환경변수 (전부 Vercel Environment Variables 에 PO 가 입력):
 *   PRODUCT_NAME            Orders 시트 P열 product 값 (기본 '콘솔시스템 v1.0')
 *   PRODUCT_PRICE           판매가 (원, 기본 9900)
 *   PRODUCT_VERSION         표시용 버전 (기본 v1.0)
 *   KAKAOPAY_LINK           카카오페이 송금 링크 https://qr.kakaopay.com/...
 *   BANK_NAME / BANK_ACCOUNT / BANK_HOLDER   무통장 입금 정보
 *   APK_DOWNLOAD_URL        APK 실제 위치 (직접 URL — 예: Supabase Storage 무작위 경로)
 *   APK_FILE_ID             또는 Google Drive 파일 ID (기존 시스템의 PDF_FILE_ID 와 같은 방식)
 *   BASE_URL                https://www.waat.community
 *   SUPPORT_EMAIL           문의 안내용 (없으면 GMAIL_USER)
 */

const crypto = require('crypto');

// 환경변수는 BOM·개행이 섞여 들어올 수 있어(Windows 파이프) 항상 정리해서 쓴다
const clean = (v) => (v == null ? '' : String(v).replace(/^﻿/, '').trim());
const PRODUCT = {
    code: 'console_system',
    name: '원맥스 One MACS',
    /** 시트 product 열(P)에 쓰는 값. env PRODUCT_NAME 이 있으면 그 값 그대로, 없으면 '콘솔시스템 v1.0' */
    get label() { return clean(process.env.PRODUCT_NAME) || `${this.name} ${this.version}`; },
    get price() { return parseInt(process.env.PRODUCT_PRICE, 10) || 9900; },
    get version() { return clean(process.env.PRODUCT_VERSION) || 'v1.4.4'; }
};

const DEFAULTS = {
    kakaopayLink: 'https://qr.kakaopay.com/Ej8qUBxLx135601791',
    bank: { name: '하나은행', account: '287-910921-40507', holder: '선웅규' }
};

const ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';   // 0/O · 1/I/L 제외

function randomCode(len) {
    const bytes = crypto.randomBytes(len);
    let out = '';
    for (let i = 0; i < len; i++) out += ALPHABET[bytes[i] % ALPHABET.length];
    return out;
}

/** CS-YYYYMMDD-XXXX (KST 날짜) */
function generateOrderId() {
    const kst = new Date(Date.now() + 9 * 3600 * 1000);
    const ymd = kst.toISOString().slice(0, 10).replace(/-/g, '');
    return `CS-${ymd}-${randomCode(4)}`;
}

/** XXXX-XXXX-XXXX-XXXX */
function generateLicenseKey() {
    const c = randomCode(16);
    return `${c.slice(0, 4)}-${c.slice(4, 8)}-${c.slice(8, 12)}-${c.slice(12, 16)}`;
}

function baseUrl(req) {
    if (clean(process.env.BASE_URL)) return clean(process.env.BASE_URL).replace(/\/$/, '');
    const host = (req && req.headers && (req.headers['x-forwarded-host'] || req.headers.host)) || 'www.waat.community';
    const proto = (req && req.headers && req.headers['x-forwarded-proto']) || 'https';
    return `${proto}://${host}`;
}

/** APK 실제 다운로드 주소. 둘 다 없으면 null */
function apkDownloadUrl() {
    if (clean(process.env.APK_DOWNLOAD_URL)) return clean(process.env.APK_DOWNLOAD_URL);  // BOM·개행 제거(2026-09-21 404 원인)
    if (process.env.APK_FILE_ID) return `https://drive.google.com/uc?export=download&id=${process.env.APK_FILE_ID}`;
    return null;
}

function isValidEmail(email) {
    return /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(String(email || '').trim());
}

const PAYMENT_METHODS = {
    kakaopay: '카카오페이',
    bank: '무통장 입금'
};

function paymentMethodLabel(m) {
    return PAYMENT_METHODS[m] || String(m || '');
}

function supportEmail() {
    return process.env.SUPPORT_EMAIL || process.env.GMAIL_USER || '';
}

/** 브라우저에 내려줘도 되는 설정 (비밀값 없음) */
function publicConfig() {
    return {
        product: { code: PRODUCT.code, name: PRODUCT.name, price: PRODUCT.price, version: PRODUCT.version },
        // 기본값 = PO 확인 완료(2026-09-20): 기존 판매 시스템의 카카오페이 영구 링크·계좌 그대로 재사용.
        // env 가 있으면 env 우선. (링크·QR 은 9,990원용으로 만든 것 — 화면에서 9,900원 입력 안내)
        kakaopayLink: process.env.KAKAOPAY_LINK || DEFAULTS.kakaopayLink,
        bank: {
            name: process.env.BANK_NAME || DEFAULTS.bank.name,
            account: process.env.BANK_ACCOUNT || DEFAULTS.bank.account,
            holder: process.env.BANK_HOLDER || DEFAULTS.bank.holder
        },
        supportEmail: supportEmail(),
        downloadReady: !!apkDownloadUrl(),
        expiryHours: parseInt(process.env.DOWNLOAD_TOKEN_EXPIRY_HOURS, 10) || 24,
        maxDownloads: parseInt(process.env.MAX_DOWNLOAD_COUNT, 10) || 5
    };
}

module.exports = {
    PRODUCT, PAYMENT_METHODS, DEFAULTS,
    generateOrderId, generateLicenseKey, randomCode,
    baseUrl, apkDownloadUrl, isValidEmail, paymentMethodLabel, supportEmail, publicConfig
};
