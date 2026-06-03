// 배경색 변경 미리보기 — 로컬 file://
const path = require('path');
const puppeteer = require(path.join(process.env.APPDATA, 'npm', 'node_modules', 'puppeteer'));

const ROOT = path.join(__dirname, '..');
const fileUrl = 'file:///' + path.join(ROOT, 'index.html').replace(/\\/g, '/');

(async () => {
    const browser = await puppeteer.launch({ headless: 'new' });
    const page = await browser.newPage();
    await page.setViewport({ width: 1280, height: 900, deviceScaleFactor: 2 });
    await page.goto(fileUrl, { waitUntil: 'domcontentloaded' });
    await new Promise(r => setTimeout(r, 1800));
    await page.screenshot({ path: path.join(ROOT, 'tmp', 'bg_desktop.png') });

    const m = await browser.newPage();
    await m.setViewport({ width: 393, height: 852, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
    await m.goto(fileUrl, { waitUntil: 'domcontentloaded' });
    await new Promise(r => setTimeout(r, 1800));
    await m.screenshot({ path: path.join(ROOT, 'tmp', 'bg_mobile.png') });

    await browser.close();
    console.log('Saved bg_desktop.png / bg_mobile.png');
})().catch(e => { console.error(e); process.exit(1); });
