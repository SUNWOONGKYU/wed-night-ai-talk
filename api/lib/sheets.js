/**
 * Google Sheets 데이터베이스 헬퍼 — AI 툴 마켓(One MACS · 원맥스) 주문
 *
 * 출처: PO 의 기존 판매 시스템 (Claude설치가이드/v2.0/sales-system/api/lib/sheets.js, 2025-10)
 * 변경: ESM → CommonJS (WAAT api/ 는 module.exports 규약), Orders 시트에 N·O·P 열 추가
 *       (paymentMethod, licenseKey, product). A~M 은 원본과 같은 순서라 기존 스프레드시트를 그대로 써도 되고,
 *       P 열 product 로 옛 가이드 판매 행(빈 값)과 원맥스 행을 필터로 구분한다.
 *
 * 스프레드시트 구조:
 *   Orders       : 주문 정보 (A~P)
 *   DownloadLogs : 다운로드 기록
 *   EmailLogs    : 이메일 발송 기록
 *   Reservations : 출시 알림 예약 (A~H: reserveId, email, name, phone, createdAt, status, notifiedAt, product) — api/reserve.js
 *                  product 는 2026-09-23 상품이 둘 이상이 되면서 늘린 칸이다. 비어 있는 옛 줄은 원맥스로 본다.
 *
 * 환경변수: GOOGLE_SERVICE_ACCOUNT (서비스 계정 JSON 전체를 한 줄로), SPREADSHEET_ID
 */

const { google } = require('googleapis');

const ORDERS_RANGE = 'Orders!A:P';
const ORDER_HEADERS = [
    'orderId', 'paymentKey', 'amount', 'customerEmail', 'customerName',
    'customerPhone', 'status', 'createdAt', 'paidAt', 'refundedAt',
    'downloadToken', 'alimtalkSent', 'alimtalkMessageId',
    'paymentMethod', 'licenseKey', 'product'
];

const RESERVATIONS_RANGE = 'Reservations!A:H';
const RESERVATION_HEADERS = ['reserveId', 'email', 'name', 'phone', 'createdAt', 'status', 'notifiedAt'];

function getGoogleAuth() {
    const raw = process.env.GOOGLE_SERVICE_ACCOUNT;
    if (!raw) throw new Error('GOOGLE_SERVICE_ACCOUNT 환경변수가 설정되지 않았습니다.');
    const serviceAccount = JSON.parse(raw);
    return new google.auth.GoogleAuth({
        credentials: serviceAccount,
        scopes: ['https://www.googleapis.com/auth/spreadsheets']
    });
}

async function getSheetsClient() {
    const auth = getGoogleAuth();
    return google.sheets({ version: 'v4', auth });
}

function spreadsheetId() {
    const id = process.env.SPREADSHEET_ID;
    if (!id) throw new Error('SPREADSHEET_ID 환경변수가 설정되지 않았습니다.');
    return id;
}

function rowToOrder(row, rowIndex) {
    return {
        rowIndex: rowIndex,
        orderId: row[0] || '',
        paymentKey: row[1] || '',
        amount: parseInt(row[2], 10) || 0,
        customerEmail: row[3] || '',
        customerName: row[4] || '',
        customerPhone: row[5] || '',
        status: row[6] || '',
        createdAt: row[7] || '',
        paidAt: row[8] || '',
        refundedAt: row[9] || '',
        downloadToken: row[10] || '',
        alimtalkSent: row[11] === 'true' || row[11] === true,
        alimtalkMessageId: row[12] || '',
        paymentMethod: row[13] || '',
        licenseKey: row[14] || '',
        product: row[15] || ''
    };
}

function orderToRow(o) {
    return [
        o.orderId,
        o.paymentKey || '',
        o.amount,
        o.customerEmail,
        o.customerName || '',
        o.customerPhone || '',
        o.status || 'SELF_REPORTED',
        o.createdAt || new Date().toISOString(),
        o.paidAt || '',
        o.refundedAt || '',
        o.downloadToken || '',
        o.alimtalkSent ? 'true' : 'false',
        o.alimtalkMessageId || '',
        o.paymentMethod || '',
        o.licenseKey || '',
        o.product || ''            // P: 상품 구분 — 옛 'Claude 완벽가이드' 판매 행(빈 값)과 구분
    ];
}

/** 주문 저장 (append) */
async function saveOrder(orderData) {
    const sheets = await getSheetsClient();
    const values = [orderToRow(Object.assign({ createdAt: new Date().toISOString() }, orderData))];
    try {
        const response = await sheets.spreadsheets.values.append({
            spreadsheetId: spreadsheetId(),
            range: ORDERS_RANGE,
            valueInputOption: 'USER_ENTERED',
            resource: { values }
        });
        return { success: true, data: response.data };
    } catch (error) {
        console.error('주문 저장 실패:', error);
        throw new Error('주문 정보를 저장하는데 실패했습니다.');
    }
}

/** 주문 조회 (orderId) */
async function getOrder(orderId) {
    const sheets = await getSheetsClient();
    try {
        const response = await sheets.spreadsheets.values.get({ spreadsheetId: spreadsheetId(), range: ORDERS_RANGE });
        const rows = response.data.values;
        if (!rows || rows.length <= 1) return null;
        for (let i = 1; i < rows.length; i++) {
            if (rows[i][0] === orderId) return rowToOrder(rows[i], i + 1);
        }
        return null;
    } catch (error) {
        console.error('주문 조회 실패:', error);
        throw new Error('주문 정보를 조회하는데 실패했습니다.');
    }
}

/** 이메일로 주문 목록 조회 (재발급 등) */
async function getOrdersByEmail(email) {
    const sheets = await getSheetsClient();
    const key = String(email || '').trim().toLowerCase();
    try {
        const response = await sheets.spreadsheets.values.get({ spreadsheetId: spreadsheetId(), range: ORDERS_RANGE });
        const rows = response.data.values;
        if (!rows || rows.length <= 1) return [];
        const out = [];
        for (let i = 1; i < rows.length; i++) {
            if (String(rows[i][3] || '').trim().toLowerCase() === key) out.push(rowToOrder(rows[i], i + 1));
        }
        return out;
    } catch (error) {
        console.error('주문 조회 실패:', error);
        throw new Error('주문 정보를 조회하는데 실패했습니다.');
    }
}

/** 리뷰 "구매 확인" 배지용 — 주문 이메일 해시와 일치하는 유효 주문이 있는지 (이메일 원문은 리뷰 쪽에 없다) */
async function getOrdersByEmailHash(hash, hashFn) {
    const sheets = await getSheetsClient();
    try {
        const response = await sheets.spreadsheets.values.get({ spreadsheetId: spreadsheetId(), range: ORDERS_RANGE });
        const rows = response.data.values;
        if (!rows || rows.length <= 1) return false;
        for (let i = 1; i < rows.length; i++) {
            const o = rowToOrder(rows[i], i + 1);
            if (!o.customerEmail || o.status === 'REFUNDED' || o.status === 'CANCELLED') continue;
            if (hashFn(o.customerEmail) === hash) return true;
        }
        return false;
    } catch (error) {
        console.error('주문 대조 실패:', error);
        return false;
    }
}

/** 주문 갱신 (부분) */
async function updateOrder(orderId, updates) {
    const sheets = await getSheetsClient();
    const order = await getOrder(orderId);
    if (!order) throw new Error('주문을 찾을 수 없습니다.');
    const merged = Object.assign({}, order, updates, { orderId: order.orderId, createdAt: order.createdAt });
    try {
        await sheets.spreadsheets.values.update({
            spreadsheetId: spreadsheetId(),
            range: `Orders!A${order.rowIndex}:P${order.rowIndex}`,
            valueInputOption: 'USER_ENTERED',
            resource: { values: [orderToRow(merged)] }
        });
        return { success: true };
    } catch (error) {
        console.error('주문 업데이트 실패:', error);
        throw new Error('주문 정보를 업데이트하는데 실패했습니다.');
    }
}

/** 다운로드 로그 (DownloadLogs: orderId, downloadedAt, ipAddress, userAgent) */
async function logDownload(downloadData) {
    try {
        const sheets = await getSheetsClient();
        await sheets.spreadsheets.values.append({
            spreadsheetId: spreadsheetId(),
            range: 'DownloadLogs!A:D',
            valueInputOption: 'USER_ENTERED',
            resource: { values: [[
                downloadData.orderId,
                new Date().toISOString(),
                downloadData.ipAddress || '',
                downloadData.userAgent || ''
            ]] }
        });
        return { success: true };
    } catch (error) {
        console.error('다운로드 로그 저장 실패:', error);
        return { success: false };   // 로그 실패는 치명적이지 않다
    }
}

/** 다운로드 횟수 */
async function getDownloadCount(orderId) {
    try {
        const sheets = await getSheetsClient();
        const response = await sheets.spreadsheets.values.get({ spreadsheetId: spreadsheetId(), range: 'DownloadLogs!A:D' });
        const rows = response.data.values;
        if (!rows || rows.length <= 1) return 0;
        let count = 0;
        for (let i = 1; i < rows.length; i++) if (rows[i][0] === orderId) count++;
        return count;
    } catch (error) {
        console.error('다운로드 횟수 조회 실패:', error);
        return 0;
    }
}

/** 이메일 발송 로그 (EmailLogs: paymentMethod, email, name, sentAt, success, errorMessage) */
async function saveEmailLog(emailData) {
    try {
        const sheets = await getSheetsClient();
        await sheets.spreadsheets.values.append({
            spreadsheetId: spreadsheetId(),
            range: 'EmailLogs!A:F',
            valueInputOption: 'USER_ENTERED',
            resource: { values: [[
                emailData.paymentMethod || '',
                emailData.email,
                emailData.name || '',
                new Date().toISOString(),
                emailData.success ? 'SUCCESS' : 'FAILED',
                emailData.errorMessage || ''
            ]] }
        });
        return { success: true };
    } catch (error) {
        console.error('이메일 로그 저장 실패:', error);
        return { success: false };
    }
}

// ---------- 출시 알림 예약 (Reservations) ----------

function rowToReservation(row, rowIndex) {
    return {
        rowIndex: rowIndex,
        reserveId: row[0] || '',
        email: row[1] || '',
        name: row[2] || '',
        phone: row[3] || '',
        createdAt: row[4] || '',
        status: row[5] || '',
        notifiedAt: row[6] || '',
        product: row[7] || 'onemacs'
    };
}

function reservationToRow(r) {
    return [
        r.reserveId,
        r.email,
        r.name || '',
        r.phone || '',
        r.createdAt || new Date().toISOString(),
        r.status || 'RESERVED',
        r.notifiedAt || '',
        r.product || 'onemacs'
    ];
}

let reservationsSheetReady = null;   // 웜 인스턴스 안에서는 시트 존재 확인을 1번만

/** Reservations 시트가 없으면 만들고 헤더를 쓴다 (있으면 아무것도 안 함) */
async function ensureReservationsSheet() {
    if (reservationsSheetReady) return reservationsSheetReady;
    reservationsSheetReady = (async function () {
        const sheets = await getSheetsClient();
        const id = spreadsheetId();
        const meta = await sheets.spreadsheets.get({ spreadsheetId: id });
        const existing = (meta.data.sheets || []).map(s => s.properties.title);
        if (existing.indexOf('Reservations') !== -1) return false;
        await sheets.spreadsheets.batchUpdate({
            spreadsheetId: id,
            resource: { requests: [{ addSheet: { properties: { title: 'Reservations' } } }] }
        });
        await sheets.spreadsheets.values.update({
            spreadsheetId: id, range: 'Reservations!A1:H1', valueInputOption: 'USER_ENTERED',
            resource: { values: [RESERVATION_HEADERS] }
        });
        return true;
    })().catch(function (e) { reservationsSheetReady = null; throw e; });
    return reservationsSheetReady;
}

/** 예약 전체 목록 (헤더 제외) */
async function getReservations() {
    await ensureReservationsSheet();
    const sheets = await getSheetsClient();
    try {
        const response = await sheets.spreadsheets.values.get({ spreadsheetId: spreadsheetId(), range: RESERVATIONS_RANGE });
        const rows = response.data.values;
        if (!rows || rows.length <= 1) return [];
        const out = [];
        for (let i = 1; i < rows.length; i++) if (rows[i][0]) out.push(rowToReservation(rows[i], i + 1));
        return out;
    } catch (error) {
        console.error('예약 조회 실패:', error);
        throw new Error('예약 정보를 조회하는데 실패했습니다.');
    }
}

/** 이메일로 예약 1건 조회 (대소문자 무시) — 없으면 null */
/**
 * 같은 사람이 원맥스와 보고서 작성 AI 에이전트를 따로 예약할 수 있으므로
 * 중복은 **이메일 + 상품**으로 본다(2026-09-23). product 를 안 넘기면 이메일만 본다(옛 동작).
 */
async function getReservationByEmail(email, product) {
    const key = String(email || '').trim().toLowerCase();
    const want = product == null ? null : String(product);
    const all = await getReservations();
    for (let i = 0; i < all.length; i++) {
        if (all[i].email.trim().toLowerCase() !== key) continue;
        if (want === null || String(all[i].product || 'onemacs') === want) return all[i];
    }
    return null;
}

/** 예약 저장 (append) */
async function saveReservation(r) {
    await ensureReservationsSheet();
    const sheets = await getSheetsClient();
    try {
        await sheets.spreadsheets.values.append({
            spreadsheetId: spreadsheetId(),
            range: RESERVATIONS_RANGE,
            valueInputOption: 'USER_ENTERED',
            resource: { values: [reservationToRow(Object.assign({ createdAt: new Date().toISOString() }, r))] }
        });
        return { success: true };
    } catch (error) {
        console.error('예약 저장 실패:', error);
        throw new Error('예약 정보를 저장하는데 실패했습니다.');
    }
}

/** 예약 갱신 (부분 — rowIndex 를 아는 객체를 넘긴다: getReservations() 결과) */
async function updateReservation(reservation, updates) {
    const sheets = await getSheetsClient();
    const merged = Object.assign({}, reservation, updates, { reserveId: reservation.reserveId, createdAt: reservation.createdAt });
    try {
        await sheets.spreadsheets.values.update({
            spreadsheetId: spreadsheetId(),
            range: `Reservations!A${reservation.rowIndex}:G${reservation.rowIndex}`,
            valueInputOption: 'USER_ENTERED',
            resource: { values: [reservationToRow(merged)] }
        });
        return { success: true };
    } catch (error) {
        console.error('예약 업데이트 실패:', error);
        throw new Error('예약 정보를 업데이트하는데 실패했습니다.');
    }
}

/** 예약 수 (status RESERVED + NOTIFIED) */
async function countReservations() {
    const all = await getReservations();
    return all.filter(r => r.status === 'RESERVED' || r.status === 'NOTIFIED').length;
}

/**
 * 스프레드시트 초기화 (최초 1회, scripts/init-sheets.js)
 * 시트(Orders / DownloadLogs / EmailLogs / Reservations)가 없으면 만들고 헤더를 쓴다.
 */
async function initializeSpreadsheet() {
    const sheets = await getSheetsClient();
    const id = spreadsheetId();
    const meta = await sheets.spreadsheets.get({ spreadsheetId: id });
    const existing = (meta.data.sheets || []).map(s => s.properties.title);
    const need = ['Orders', 'DownloadLogs', 'EmailLogs', 'Reservations'].filter(t => existing.indexOf(t) === -1);
    if (need.length) {
        await sheets.spreadsheets.batchUpdate({
            spreadsheetId: id,
            resource: { requests: need.map(title => ({ addSheet: { properties: { title } } })) }
        });
    }
    await sheets.spreadsheets.values.update({
        spreadsheetId: id, range: 'Orders!A1:P1', valueInputOption: 'USER_ENTERED',
        resource: { values: [ORDER_HEADERS] }
    });
    await sheets.spreadsheets.values.update({
        spreadsheetId: id, range: 'DownloadLogs!A1:D1', valueInputOption: 'USER_ENTERED',
        resource: { values: [['orderId', 'downloadedAt', 'ipAddress', 'userAgent']] }
    });
    await sheets.spreadsheets.values.update({
        spreadsheetId: id, range: 'EmailLogs!A1:F1', valueInputOption: 'USER_ENTERED',
        resource: { values: [['paymentMethod', 'email', 'name', 'sentAt', 'success', 'errorMessage']] }
    });
    await sheets.spreadsheets.values.update({
        spreadsheetId: id, range: 'Reservations!A1:G1', valueInputOption: 'USER_ENTERED',
        resource: { values: [RESERVATION_HEADERS] }
    });
    return { success: true, created: need };
}

module.exports = {
    ORDER_HEADERS,
    saveOrder,
    getOrder,
    getOrdersByEmail,
    getOrdersByEmailHash,
    updateOrder,
    logDownload,
    getDownloadCount,
    saveEmailLog,
    RESERVATION_HEADERS,
    ensureReservationsSheet,
    getReservations,
    getReservationByEmail,
    saveReservation,
    updateReservation,
    countReservations,
    initializeSpreadsheet
};
