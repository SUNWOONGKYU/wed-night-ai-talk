/**
 * AI 툴 마켓 공통 — 상품 정보, 주문번호·라이선스 키 생성, 다운로드 파일 위치, 입력 검증
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
 *   PRODUCT_MODE            'reserve'(출시 전 — 출시 알림 예약만 받음, 기본) | 'sale'(판매 — 결제 UI)
 *   PRODUCT_UPDATED         툴 정보 '업데이트 날짜' YYYY-MM-DD (파일 교체 시 함께 갱신)
 *   REPORT_WRITING_AGENT_PRICE      보고서 작성 에이전트 단독 판매가 (원, 기본 5500)
 *   REPORT_WRITING_AGENT_VERSION / REPORT_WRITING_AGENT_UPDATED / REPORT_WRITING_AGENT_NAME
 *   REPORT_WRITING_AGENT_DOWNLOAD_URL  없으면 우리 사이트의 /console/report-agent_v1.0.zip
 *   REPORT_WRITING_AGENT_MODE       보고서 에이전트만 따로 'sale'/'reserve' (없으면 PRODUCT_MODE 를 따름)
 *   MARKET_KEY              주소 분양 서버에 주문을 알릴 때 쓰는 비밀값 (send-download.js)
 */

const crypto = require('crypto');

// 환경변수는 BOM·개행이 섞여 들어올 수 있어(Windows 파이프) 항상 정리해서 쓴다
const clean = (v) => (v == null ? '' : String(v).replace(/^﻿/, '').trim());
/**
 * 상품 표 — 2026-09-23 두 번째 상품(보고서 작성 AI 에이전트) 추가.
 * 그전까지 이 파일은 상품 하나만 다뤘고 주문·토큰·다운로드가 전부 그 하나를 보고 있었다.
 * 상품이 둘 이상이 되었으므로 여기가 정본이다. PRODUCT 는 One MACS를 가리키는 옛 이름으로 남겨 둔다.
 *
 * downloadUrl 이 '/' 로 시작하면 우리 사이트의 파일이다(productDownloadUrl 이 사이트 주소를 붙인다).
 */
const PRODUCTS = {
    onemacs: {
        id: 'onemacs',
        code: 'console_system',
        name: 'One MACS · 원맥스',
        category: 'AI 협업 시스템',
        fileLabel: 'One MACS 패키지 (PC 설치본)',
        guidePath: '/market/onemacs#install',
        /** 시트 product 열(P)에 쓰는 값. env PRODUCT_NAME 이 있으면 그 값 그대로 */
        get label() { return clean(process.env.PRODUCT_NAME) || `${this.name} ${this.version}`; },
        get price() { return parseInt(process.env.PRODUCT_PRICE, 10) || 9900; },
        get version() { return clean(process.env.PRODUCT_VERSION) || 'v1.4.9'; },
        /** 업데이트 날짜(툴 정보) — env PRODUCT_UPDATED(YYYY-MM-DD, 파일 교체 시 함께 갱신), 없으면 이 배포의 콜드스타트 날짜(KST) */
        get updated() { return clean(process.env.PRODUCT_UPDATED) || DEPLOY_DATE; },
        get downloadUrl() { return apkDownloadUrl() || '/console/onemacs_v3.0.3.zip'; },
        /** 끼워 주는 상품 없음. 보고서 작성 에이전트(보고서 작성 에이전트)는 **따로 파는 상품**이다(PO 2026-09-23 정정).
         *  구조는 남겨 둔다 — 나중에 묶음 상품을 낼 때 여기에 id 를 넣으면 그대로 동작한다. */
        includes: []
    },
    'StockTradeAutoSystem': {
        id: 'StockTradeAutoSystem',
        code: 'stock_trade_auto_system',
        name: '주식 매매 자동화 시스템 (STAS)',
        fullname: 'Stock Trading Auto System',
        category: '트레이딩',
        fileLabel: '주식 매매 자동화 시스템',
        guidePath: '/market/StockTradeAutoSystem#install',
        get label() { return clean(process.env.STOCK_TRADE_AUTO_SYSTEM_NAME) || `${this.name} ${this.version}`; },
        get price() { return parseInt(process.env.STOCK_TRADE_AUTO_SYSTEM_PRICE, 10) || 5500; },
        get version() { return clean(process.env.STOCK_TRADE_AUTO_SYSTEM_VERSION) || 'v1.3'; },
        get updated() { return clean(process.env.STOCK_TRADE_AUTO_SYSTEM_UPDATED) || DEPLOY_DATE; },
        get downloadUrl() { return clean(process.env.STOCK_TRADE_AUTO_SYSTEM_DOWNLOAD_URL) || '/console/StockTradeAutoSystem_v1.3.zip'; },
        includes: []
    },
    'ReportWritingAgent': {
        id: 'ReportWritingAgent',
        code: 'report_writing_agent',
        name: '보고서 작성 에이전트 (ARWA)',
        fullname: 'Automated Report Writing Agent',
        category: 'AI 에이전트',
        fileLabel: '보고서 작성 에이전트 (ARWA) (보고서 작성 에이전트)',
        guidePath: '/market/ReportWritingAgent#install',
        get label() { return clean(process.env.REPORT_WRITING_AGENT_NAME) || `${this.name} ${this.version}`; },
        get price() { return parseInt(process.env.REPORT_WRITING_AGENT_PRICE, 10) || 5500; },
        get version() { return clean(process.env.REPORT_WRITING_AGENT_VERSION) || 'v1.0'; },
        get updated() { return clean(process.env.REPORT_WRITING_AGENT_UPDATED) || DEPLOY_DATE; },
        get downloadUrl() { return clean(process.env.REPORT_WRITING_AGENT_DOWNLOAD_URL) || '/console/report-agent_v1.0.zip'; },
        includes: []
    }
};

const DEFAULT_PRODUCT_ID = 'onemacs';

/** 상품 하나를 꺼낸다. 모르는 이름이면 null */
function getProduct(id) {
    return PRODUCTS[String(id || DEFAULT_PRODUCT_ID)] || null;
}

/** 이 상품을 사면 받게 되는 상품 전부 — 자기 자신 + 끼워 주는 것(지금은 끼워 주는 것이 없다) */
function entitlements(id) {
    const p = getProduct(id);
    if (!p) return [];
    return [p.id].concat(p.includes.filter((x) => PRODUCTS[x]));
}

/** 상품의 실제 파일 주소. 우리 사이트 파일이면 사이트 주소를 앞에 붙인다 */
function productDownloadUrl(id, base) {
    const p = getProduct(id);
    if (!p || !p.downloadUrl) return null;
    const u = p.downloadUrl;
    return /^https?:\/\//i.test(u) ? u : `${String(base || '').replace(/\/$/, '')}${u}`;
}

/** 옛 이름 — One MACS를 가리킨다. 기존 코드(confirm-payment 등)가 이것을 그대로 쓴다 */
const PRODUCT = PRODUCTS.onemacs;

/** 출시 모드 — 'reserve'(기본) | 'sale'. 프런트(js/onemacs.js·js/market-home.js)가 /api/market-config 의 mode 로 화면을 전환한다 */
function launchMode() {
    const v = clean(process.env.PRODUCT_MODE).toLowerCase();
    return v === 'sale' ? 'sale' : 'reserve';
}

/**
 * 상품 하나의 출시 모드(2026-09-23). 상품마다 따로 열 수 있어야 한다 —
 * 보고서 작성 AI 에이전트는 One MACS와 별개로, 시험을 통과한 뒤에 연다.
 * 상품별 환경변수가 없으면 전체 모드(PRODUCT_MODE)를 따른다.
 *   One MACS        : PRODUCT_MODE
 *   보고서 에이전트 : REPORT_WRITING_AGENT_MODE (없으면 PRODUCT_MODE)
 */
function modeFor(id) {
    const p = getProduct(id);
    if (!p) return launchMode();
    if (p.id === 'ReportWritingAgent') {
        const v = clean(process.env.REPORT_WRITING_AGENT_MODE).toLowerCase();
        if (v === 'sale' || v === 'reserve') return v;
    }
    return launchMode();
}

const DEPLOY_DATE = new Date(Date.now() + 9 * 3600 * 1000).toISOString().slice(0, 10);

const DEFAULTS = {
    kakaopayLink: 'https://qr.kakaopay.com/Ej8qUBxLx135601791',
    bank: { name: '하나은행', account: '287-910921-40507', holder: '선웅규(파인더월드)' }
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

/** RS-YYYYMMDD-XXXX (KST 날짜) — 출시 알림 예약번호 */
function generateReserveId() {
    const kst = new Date(Date.now() + 9 * 3600 * 1000);
    const ymd = kst.toISOString().slice(0, 10).replace(/-/g, '');
    return `RS-${ymd}-${randomCode(4)}`;
}

/**
 * One MACS 연결 코드 — 영문 대문자 2자 + 숫자 6자 (예: KM482913). PO 확정 2026-09-25.
 * 손님이 다루는 코드는 이것과 PIN 번호 둘뿐이다. 이 코드 하나로 고정 주소(분양 서버)와
 * 모바일 앱의 PC 찾기(허브)를 모두 한다. 영문은 I·O 를 뺀다(숫자 1·0 과 헷갈림). 약 5.8억 가지.
 * 옛 이름(generateLicenseKey)은 호출하는 곳이 많아 그대로 둔다. 옛 주문의 16자리 키는 분양 서버가 계속 받는다.
 */
const CODE_LETTERS = 'ABCDEFGHJKLMNPQRSTUVWXYZ';   // I · O 제외 (24자)
function generateLicenseKey() {
    const b = crypto.randomBytes(8);
    let out = CODE_LETTERS[b[0] % CODE_LETTERS.length] + CODE_LETTERS[b[1] % CODE_LETTERS.length];
    for (let i = 2; i < 8; i++) out += String(b[i] % 10);
    return out;
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
        mode: launchMode(),
        product: { code: PRODUCT.code, name: PRODUCT.name, price: PRODUCT.price, version: PRODUCT.version, updated: PRODUCT.updated },
        // 상품이 둘 이상이 되었으므로 목록도 함께 내려준다(화면이 상품별 값을 그리는 데 쓴다)
        products: Object.keys(PRODUCTS).map((k) => {
            const p = PRODUCTS[k];
            return { id: p.id, name: p.name, category: p.category, price: p.price, version: p.version, updated: p.updated, includes: p.includes, mode: modeFor(p.id) };
        }),
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
    PRODUCT, PRODUCTS, DEFAULT_PRODUCT_ID, getProduct, entitlements, productDownloadUrl,
    PAYMENT_METHODS, DEFAULTS, clean, launchMode, modeFor,
    generateOrderId, generateReserveId, generateLicenseKey, randomCode,
    baseUrl, apkDownloadUrl, isValidEmail, paymentMethodLabel, supportEmail, publicConfig
};
