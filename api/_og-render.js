// 공유 썸네일(OG 이미지) 렌더러 — 1200×630 PNG. satori(JSX→SVG) + resvg(SVG→PNG).
const satori = require('satori').default || require('satori');
const { Resvg } = require('@resvg/resvg-js');

const NAVY = '#1A2238', GOLD = '#C9A961', MUTED = '#AEB4C4';

// Google Fonts 에서 필요한 글자만 서브셋한 TTF 를 받는다 (satori 는 woff2 미지원 → 구형 UA 로 truetype 요청)
async function loadFont(text, weight) {
    const css = await fetch('https://fonts.googleapis.com/css2?family=Noto+Sans+KR:wght@' + weight + '&text=' + encodeURIComponent(text), {
        headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 6.1; WOW64; rv:20.0) Gecko/20100101 Firefox/20.0' }
    }).then(r => r.text());
    const m = /src:\s*url\(([^)]+)\)\s*format\('(?:truetype|opentype|woff)'\)/.exec(css);
    if (!m) throw new Error('font url not found in css: ' + css.slice(0, 200));
    return Buffer.from(await fetch(m[1]).then(r => r.arrayBuffer()));
}

function el(type, style, children, extra) {
    // satori: 자식이 둘 이상인 요소는 display:flex 가 명시돼야 한다 — 기본값으로 깔아둔다
    return { type, props: Object.assign({ style: Object.assign({ display: 'flex' }, style), children }, extra || {}) };
}

async function renderOg(ev) {
    const badge = ev.event_type === 'event' ? '강의' : '모임';
    const header = 'WAAT 행사 안내';
    const title = ev.title || '';
    const when = ev.when || '';
    const where = ev.where || '';
    const who = ev.who || '';
    const allText = header + badge + title + when + where + who + 'WAAT·';
    const [bold, regular] = await Promise.all([loadFont(allText, 700), loadFont(allText, 400)]);

    const tree = el('div', {
        width: 1200, height: 630, display: 'flex', flexDirection: 'column', justifyContent: 'space-between',
        background: 'linear-gradient(135deg, #141B2E 0%, #1A2238 55%, #232C48 100%)', color: '#fff',
        padding: '64px 72px', fontFamily: 'Noto Sans KR'
    }, [
        el('div', { display: 'flex', flexDirection: 'column' }, [
            el('div', { display: 'flex', alignItems: 'center', fontSize: 34, fontWeight: 700, color: GOLD, letterSpacing: 2 }, [
                el('div', { width: 14, height: 14, borderRadius: 7, background: GOLD, marginRight: 16 }, []),
                el('div', {}, header)
            ]),
            el('div', { display: 'flex', alignItems: 'center', marginTop: 44 }, [
                el('div', { fontSize: 30, fontWeight: 700, color: NAVY, background: GOLD, padding: '8px 26px', borderRadius: 999 }, badge)
            ]),
            el('div', { fontSize: title.length > 26 ? 52 : 60, fontWeight: 700, lineHeight: 1.25, marginTop: 24, maxWidth: 1056 }, title)
        ]),
        el('div', { display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end' }, [
            el('div', { display: 'flex', flexDirection: 'column', fontSize: 30, color: MUTED, lineHeight: 1.5 }, [
                el('div', {}, when),
                el('div', {}, [where, who].filter(Boolean).join('  ·  '))
            ]),
            el('div', { fontSize: 44, fontWeight: 700, color: GOLD, letterSpacing: 4 }, 'WAAT')
        ])
    ]);

    const svg = await satori(tree, {
        width: 1200, height: 630,
        fonts: [
            { name: 'Noto Sans KR', data: bold, weight: 700, style: 'normal' },
            { name: 'Noto Sans KR', data: regular, weight: 400, style: 'normal' }
        ]
    });
    return new Resvg(svg, { fitTo: { mode: 'width', value: 1200 } }).render().asPng();
}

module.exports = { renderOg };
