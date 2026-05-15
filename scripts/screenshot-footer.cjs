// footer 모바일 스크린샷
const path = require('path');
const fs = require('fs');
const puppeteer = require(path.join(process.env.APPDATA, 'npm', 'node_modules', 'puppeteer'));

const ROOT = path.join(__dirname, '..');
const fileUrl = 'file:///' + path.join(ROOT, 'index.html').replace(/\\/g, '/');
const outDir = path.join(ROOT, 'tmp');
fs.mkdirSync(outDir, { recursive: true });

(async () => {
    const browser = await puppeteer.launch({ headless: 'new' });
    const page = await browser.newPage();
    await page.setViewport({ width: 393, height: 852, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
    await page.goto(fileUrl, { waitUntil: 'domcontentloaded' });
    await new Promise(r => setTimeout(r, 1500));
    await page.evaluate(() => {
        const f = document.querySelector('footer .footer-brand');
        if (f) f.scrollIntoView({ block: 'center' });
    });
    await new Promise(r => setTimeout(r, 500));
    const info = await page.evaluate(() => {
        const el = document.querySelector('footer .footer-brand');
        if (!el) return null;
        const r = el.getBoundingClientRect();
        return { html: el.innerHTML, text: el.textContent.trim(), width: Math.round(r.width), height: Math.round(r.height) };
    });
    console.log('[footer-brand 모바일 393px]');
    console.log(' html :', info.html);
    console.log(' rect :', info.width + 'x' + info.height);

    const fEl = await page.$('footer');
    await fEl.screenshot({ path: path.join(outDir, 'footer_mobile.png') });
    console.log('Saved: tmp/footer_mobile.png');
    await browser.close();
})().catch(e => { console.error(e); process.exit(1); });
