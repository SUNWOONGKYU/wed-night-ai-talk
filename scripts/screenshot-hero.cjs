// hero 영역 모바일/데스크톱 스크린샷 — 로컬 file:// 로 즉시 확인
const path = require('path');
const fs = require('fs');
const puppeteer = require(path.join(process.env.APPDATA, 'npm', 'node_modules', 'puppeteer'));

const ROOT = path.join(__dirname, '..');
const fileUrl = 'file:///' + path.join(ROOT, 'index.html').replace(/\\/g, '/');
const outDir = path.join(ROOT, 'tmp');
fs.mkdirSync(outDir, { recursive: true });

(async () => {
    const browser = await puppeteer.launch({ headless: 'new' });

    // 모바일 (iPhone 14 Pro)
    const mPage = await browser.newPage();
    await mPage.setViewport({ width: 393, height: 852, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
    await mPage.goto(fileUrl, { waitUntil: 'domcontentloaded' });
    await new Promise(r => setTimeout(r, 1500));
    const mInfo = await mPage.evaluate(() => {
        const el = document.querySelector('.hero-brand-text');
        if (!el) return null;
        const r = el.getBoundingClientRect();
        return {
            text: el.textContent.replace(/\s+/g, ' ').trim(),
            html: el.innerHTML,
            width: Math.round(r.width),
            height: Math.round(r.height),
            sep: getComputedStyle(el.querySelector('.hbt-sep')).display,
            br: getComputedStyle(el.querySelector('.hbt-mobile-break')).display,
        };
    });
    console.log('[모바일 393px]');
    console.log(' text       :', mInfo.text);
    console.log(' html       :', mInfo.html);
    console.log(' rect       :', mInfo.width + 'x' + mInfo.height);
    console.log(' .hbt-sep   :', mInfo.sep, '(none이면 / 숨김)');
    console.log(' .hbt-break :', mInfo.br,  '(inline이면 줄바꿈)');
    await mPage.screenshot({ path: path.join(outDir, 'hero_mobile.png'), clip: { x: 0, y: 0, width: 393, height: 480 } });

    // 데스크톱
    const dPage = await browser.newPage();
    await dPage.setViewport({ width: 1280, height: 800 });
    await dPage.goto(fileUrl, { waitUntil: 'domcontentloaded' });
    await new Promise(r => setTimeout(r, 1500));
    const dInfo = await dPage.evaluate(() => {
        const el = document.querySelector('.hero-brand-text');
        const r = el.getBoundingClientRect();
        return {
            text: el.textContent.replace(/\s+/g, ' ').trim(),
            width: Math.round(r.width),
            height: Math.round(r.height),
            sep: getComputedStyle(el.querySelector('.hbt-sep')).display,
            br: getComputedStyle(el.querySelector('.hbt-mobile-break')).display,
        };
    });
    console.log('\n[데스크톱 1280px]');
    console.log(' text       :', dInfo.text);
    console.log(' rect       :', dInfo.width + 'x' + dInfo.height);
    console.log(' .hbt-sep   :', dInfo.sep, '(inline이면 / 표시)');
    console.log(' .hbt-break :', dInfo.br,  '(none이면 한 줄)');
    await dPage.screenshot({ path: path.join(outDir, 'hero_desktop.png'), clip: { x: 0, y: 0, width: 1280, height: 500 } });

    console.log('\nSaved: tmp/hero_mobile.png, tmp/hero_desktop.png');
    await browser.close();
})().catch(e => { console.error(e); process.exit(1); });
