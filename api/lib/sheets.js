/**
 * Google Sheets 데이터베이스 헬퍼 — 앱 마켓(원맥스 / One MACS) 주문
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

/**
 * 스프레드시트 초기화 (최초 1회, scripts/init-sheets.js)
 * 시트(Orders / DownloadLogs / EmailLogs)가 없으면 만들고 헤더를 쓴다.
 */
async function initializeSpreadsheet() {
    const sheets = await getSheetsClient();
    const id = spreadsheetId();
    const meta = await sheets.spreadsheets.get({ spreadsheetId: id });
    const existing = (meta.data.sheets || []).map(s => s.properties.title);
    const need = ['Orders', 'DownloadLogs', 'EmailLogs'].filter(t => existing.indexOf(t) === -1);
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
    return { success: true, created: need };
}

module.exports = {
    ORDER_HEADERS,
    saveOrder,
    getOrder,
    getOrdersByEmail,
    updateOrder,
    logDownload,
    getDownloadCount,
    saveEmailLog,
    initializeSpreadsheet
};
