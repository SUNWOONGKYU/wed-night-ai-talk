/**
 * GET /api/market-stats?app=onemacs|ReportWritingAgent|StockTradeAutoSystem → { downloads, sizeBytes, sizeLabel }
 * 앱 정보 블록(요약 줄·다운로드 크기)용 실제 값. 1시간 캐시.
 *   downloads : 그 상품의 다운로드 횟수 = DownloadLogs 행 중 Orders 의 **그 상품** 주문에 속한 것
 *   sizeBytes : 그 상품의 파일에 HEAD → Content-Length (실패하면 null → 화면에서 숨김)
 * 값이 없으면 null — 화면은 null 이면 항목을 숨긴다(추정값 표기 금지).
 *
 * 2026-09-24: 상품이 둘 이상이 되었는데 이 파일이 app 을 받아만 놓고 쓰지 않아,
 * ARWA 화면에 원맥스의 크기와 다운로드 수가 나오고 있었다. 상품별로 가른다.
 */

const m = require('./lib/market.js');

const TTL_MS = 60 * 60 * 1000;
const cache = new Map();   // app → {at, data}

async function downloads(product) {
    try {
        const { google } = require('googleapis');
        const auth = new google.auth.GoogleAuth({ credentials: JSON.parse(process.env.GOOGLE_SERVICE_ACCOUNT), scopes: ['https://www.googleapis.com/auth/spreadsheets.readonly'] });
        const sheets = google.sheets({ version: 'v4', auth });
        const id = process.env.SPREADSHEET_ID;
        const [orders, logs] = await Promise.all([
            sheets.spreadsheets.values.get({ spreadsheetId: id, range: 'Orders!A:P' }),
            sheets.spreadsheets.values.get({ spreadsheetId: id, range: 'DownloadLogs!A:A' })
        ]);
        // P열(16번째)에 상품 이름표가 들어간다. 버전이 붙어 있어 정확히 같지 않으므로,
        // 상품 이름이 들어 있는지로 가른다(예: 'One MACS · 원맥스 v3.3.0' 안의 'One MACS · 원맥스').
        const want = product ? product.name : null;
        const appOrders = new Set();
        (orders.data.values || []).slice(1).forEach(r => {
            const label = String(r[15] || '').trim();
            if (!r[0] || !label) return;
            if (want && label.indexOf(want) === -1) return;
            appOrders.add(r[0]);
        });
        let n = 0;
        (logs.data.values || []).slice(1).forEach(r => { if (r[0] && appOrders.has(r[0])) n++; });
        return n;
    } catch (e) {
        console.error('market-stats downloads 실패:', e && e.message);
        return null;
    }
}

async function sizeBytes(productId, base) {
    const url = m.productDownloadUrl(productId, base);
    if (!url) return null;
    try {
        const r = await fetch(url, { method: 'HEAD', redirect: 'follow' });
        const len = parseInt(r.headers.get('content-length'), 10);
        return r.ok && len > 0 ? len : null;
    } catch (e) {
        console.error('market-stats HEAD 실패:', e && e.message);
        return null;
    }
}

function sizeLabel(bytes) { return bytes == null ? null : (bytes >= 1024 * 1024 ? (bytes / 1024 / 1024).toFixed(1) + 'MB' : Math.round(bytes / 1024) + 'KB'); }

module.exports = async function handler(req, res) {
    if (req.method !== 'GET') return res.status(405).json({ error: '허용되지 않은 메서드입니다.' });
    const app = String((req.query || {}).app || m.DEFAULT_PRODUCT_ID);
    const product = m.getProduct(app);
    if (!product) return res.status(404).json({ error: '알 수 없는 상품입니다.' });
    res.setHeader('Cache-Control', 'public, max-age=3600, s-maxage=3600');
    const c = cache.get(app);
    if (c && Date.now() - c.at < TTL_MS) return res.status(200).json(c.data);
    const [d, s] = await Promise.all([downloads(product), sizeBytes(app, m.baseUrl(req))]);
    const data = { app, downloads: d, sizeBytes: s, sizeLabel: sizeLabel(s) };
    cache.set(app, { at: Date.now(), data });
    return res.status(200).json(data);
};
