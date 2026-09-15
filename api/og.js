// GET /api/og?event=<id> → 행사별 공유 썸네일 PNG (카카오·텔레그램 등 링크 미리보기용)
const { loadEvent } = require('./_event.js');
const { renderOg } = require('./_og-render.js');

module.exports = async function (req, res) {
    try {
        const ev = await loadEvent(req.query.event);
        if (!ev) { res.statusCode = 404; res.setHeader('Content-Type', 'text/plain; charset=utf-8'); res.end('not found'); return; }
        const png = await renderOg(ev);
        res.setHeader('Content-Type', 'image/png');
        res.setHeader('Cache-Control', 'public, max-age=600, s-maxage=3600, stale-while-revalidate=86400');
        res.end(png);
    } catch (e) {
        res.statusCode = 500;
        res.setHeader('Content-Type', 'text/plain; charset=utf-8');
        res.end('og error: ' + (e && e.message));
    }
};
