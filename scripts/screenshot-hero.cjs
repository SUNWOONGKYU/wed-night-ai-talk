// hero 영역 모바일/데스크톱 스크린샷 — 로컬 file:// 로 즉시 확인
const path = require('path');
const fs = require('fs');
const puppeteer = require(path.join(process.env.APPDATA, 'npm', 'node_modules', 'puppeteer'));

const ROOT = path.join(__dirname, '..');
const fileUrl = 'file:///' + path.join(ROOT, 'index.html').replace(/\\/g, '/');
const outDir = path.join(ROOT, 'tmp');
fs.mkdirSync(outDir, { recursive: true });

async function shot(browser, viewport, isMobile, filename) {
    const page = await browser.newPage();
    await page.setViewport(Object.assign({}, viewport, { deviceScaleFactor: 2, isMobile: !!isMobile, hasTouch: !!isMobile }));
    await page.goto(fileUrl, { waitUntil: 'domcontentloaded' });
    await new Promise(r => setTimeout(r, 1200));
    const info = await page.evaluate(() => {
        const el = document.querySelector('.hero-brand-text');
        if (!el) return null;
        const r = el.getBoundingClientRect();
        return {
            text: el.textContent.replace(/\s+/g, ' ').trim(),
            html: el.innerHTML,
            width: Math.round(r.width),
            height: Math.round(r.height)
        };
    });
    console.log('[' + filename + ' / vw=' + viewport.width + ']');
    console.log(' text :', info.text);
    console.log(' html :', info.html);
    console.log(' rect :', info.width + 'x' + info.height + (info.height > 30 ? '  ← 두 줄 추정' : '  ← 한 줄'));
    await page.screenshot({ path: path.join(outDir, filename), clip: { x: 0, y: 0, width: viewport.width, height: Math.min(500, viewport.height) } });
}

(async () => {
    const browser = await puppeteer.launch({ headless: 'new' });
    await shot(browser, { width: 393, height: 852 }, true, 'hero_mobile.png');
    await shot(browser, { width: 1280, height: 800 }, false, 'hero_desktop.png');
    await browser.close();
    console.log('\nSaved to tmp/');
})().catch(e => { console.error(e); process.exit(1); });
