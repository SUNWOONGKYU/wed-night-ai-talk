// GET /e/<id> (vercel.json rewrite → /api/share?event=<id>) → index.html 의 OG/Twitter 메타만 행사 내용으로 바꿔 응답.
// (/?event=<id> 는 정적 index.html 이 먼저 잡혀 rewrite 가 안 걸리므로 별도 경로를 쓴다)
// 메신저 봇은 JS 를 안 돌리므로 서버에서 메타를 채워야 미리보기가 행사별로 나온다.
// 사람에게는 평소 index.html 과 같은 페이지 — main.js 의 focusSharedEvent 가 ?event= 를 읽어 카드로 스크롤한다.
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { loadEvent } = require('./_event.js');

const SITE = 'https://waat.community';
const esc = (s) => String(s || '').replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

let _indexCache = null;
function readIndex() {
    if (_indexCache) return _indexCache;
    const candidates = [path.join(process.cwd(), 'index.html'), path.join(__dirname, '..', 'index.html')];
    for (const p of candidates) { if (fs.existsSync(p)) { _indexCache = fs.readFileSync(p, 'utf8'); return _indexCache; } }
    throw new Error('index.html not found');
}

function setMeta(html, attr, key, value) {
    const re = new RegExp('<meta[ \\t]+' + attr + '="' + key + '"[ \\t]+content="[^"]*"[ \\t]*/?>', 'i');
    const tag = '<meta ' + attr + '="' + key + '" content="' + esc(value) + '">';
    return re.test(html) ? html.replace(re, tag) : html.replace('</head>', '    ' + tag + '\n</head>');
}

module.exports = async function (req, res) {
    let html = readIndex();
    let ev = null;
    try { ev = await loadEvent(req.query.event); } catch (e) { ev = null; }
    if (ev) {
        const kind = ev.event_type === 'event' ? '강의' : '모임';
        const pageUrl = SITE + '/e/' + ev.id;
        // 내용(제목·일시·장소·강사)이 바뀌면 이미지 URL 도 바뀌게 — Vercel·메신저 캐시가 옛 썸네일을 붙들지 않도록
        const ver = crypto.createHash('sha1').update(JSON.stringify([ev.title, ev.when, ev.where, ev.who])).digest('hex').slice(0, 8);
        const image = SITE + '/api/og?event=' + ev.id + '&v=' + ver;
        const title = kind + ' · ' + ev.title;
        const desc = [ev.when, ev.where, ev.who].filter(Boolean).join(' · ');
        // /e/<id> 경로에서 index.html 의 상대 경로(css/, js/, 이미지, speakup.html…)가 /e/ 아래로 풀리지 않도록
        html = html.replace(/<head>/i, '<head>\n    <base href="/">');
        html = html.replace(/<title>[^<]*<\/title>/, '<title>' + esc('WAAT 행사 안내 | ' + title) + '</title>');
        html = setMeta(html, 'name', 'description', desc);
        html = setMeta(html, 'property', 'og:site_name', 'WAAT 행사 안내');
        html = setMeta(html, 'property', 'og:title', title);
        html = setMeta(html, 'property', 'og:description', desc);
        html = setMeta(html, 'property', 'og:url', pageUrl);
        html = setMeta(html, 'property', 'og:image', image);
        html = setMeta(html, 'property', 'og:image:width', '1200');
        html = setMeta(html, 'property', 'og:image:height', '630');
        html = setMeta(html, 'name', 'twitter:title', title);
        html = setMeta(html, 'name', 'twitter:description', desc);
        html = setMeta(html, 'name', 'twitter:image', image);
        html = html.replace(/<link rel="canonical" href="[^"]*">/, '<link rel="canonical" href="' + esc(pageUrl) + '">');
    }
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.setHeader('Cache-Control', 'public, max-age=0, s-maxage=60, stale-while-revalidate=600');
    res.end(html);
};
