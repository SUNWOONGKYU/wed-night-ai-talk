/**
 * GET /api/market-stats?app=onemacs → { downloads, sizeBytes, sizeLabel }
 * 앱 정보 블록(요약 줄·다운로드 크기)용 실제 값. 1시간 캐시.
 *   downloads : 실제 다운로드 토큰 사용 횟수 = DownloadLogs 시트 행 중 Orders 시트의 앱 주문(product 열이 비어 있지 않은 행)에 속한 것
 *   sizeBytes : APK_DOWNLOAD_URL 에 HEAD → Content-Length (실패하면 null → 화면에서 숨김)
 * 값이 없으면 null — 화면은 null 이면 항목을 숨긴다(추정값 표기 금지).
 */

const m = require('./lib/market.js');

const TTL_MS = 60 * 60 * 1000;
const cache = new Map();   // app → {at, data}

async function downloads() {
    try {
        const { google } = require('googleapis');
        const auth = new google.auth.GoogleAuth({ credentials: JSON.parse(process.env.GOOGLE_SERVICE_ACCOUNT), scopes: ['https://www.googleapis.com/auth/spreadsheets.readonly'] });
        const sheets = google.sheets({ version: 'v4', auth });
        const id = process.env.SPREADSHEET_ID;
        const [orders, logs] = await Promise.all([
            sheets.spreadsheets.values.get({ spreadsheetId: id, range: 'Orders!A:P' }),
            sheets.spreadsheets.values.get({ spreadsheetId: id, range: 'DownloadLogs!A:A' })
        ]);
        const appOrders = new Set();
        (orders.data.values || []).slice(1).forEach(r => { if (r[0] && String(r[15] || '').trim()) appOrders.add(r[0]); });
        let n = 0;
        (logs.data.values || []).slice(1).forEach(r => { if (r[0] && appOrders.has(r[0])) n++; });
        return n;
    } catch (e) {
        console.error('market-stats downloads 실패:', e && e.message);
        return null;
    }
}

async function sizeBytes() {
    const url = m.apkDownloadUrl();
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
    const app = String((req.query || {}).app || 'onemacs');
    res.setHeader('Cache-Control', 'public, max-age=3600, s-maxage=3600');
    const c = cache.get(app);
    if (c && Date.now() - c.at < TTL_MS) return res.status(200).json(c.data);
    const [d, s] = await Promise.all([downloads(), sizeBytes()]);
    const data = { app, downloads: d, sizeBytes: s, sizeLabel: sizeLabel(s) };
    cache.set(app, { at: Date.now(), data });
    return res.status(200).json(data);
};
