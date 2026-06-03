const path = require('path');
const puppeteer = require(path.join(process.env.APPDATA, 'npm', 'node_modules', 'puppeteer'));

(async () => {
    const browser = await puppeteer.launch({ headless: 'new', args: ['--disable-cache'] });
    const page = await browser.newPage();
    await page.setCacheEnabled(false);
    await page.setViewport({ width: 1280, height: 900 });

    const URL = 'https://waat.community/?_=' + Date.now();
    await page.goto(URL, { waitUntil: 'networkidle2', timeout: 60000 });

    // 모임 일정 섹션 끝으로 스크롤
    await page.evaluate(() => {
        const el = document.querySelector('.guest-cancel-entry');
        if (el) el.scrollIntoView({ behavior: 'instant', block: 'center' });
    });
    await new Promise(r => setTimeout(r, 800));

    const info = await page.evaluate(() => {
        const btn = document.getElementById('guest-cancel-open-btn');
        if (!btn) return null;
        const cs = getComputedStyle(btn);
        return {
            tag: btn.tagName,
            text: btn.textContent.trim(),
            font_weight: cs.fontWeight,
            font_size: cs.fontSize,
            background: cs.backgroundColor,
            color: cs.color,
            border: cs.border,
            padding: cs.padding
        };
    });
    console.log('[btn]', info);

    await page.screenshot({ path: path.join('tmp', 'cancel_btn_desktop.png'), fullPage: false });

    // 모바일
    await page.setViewport({ width: 390, height: 844 });
    await page.goto(URL, { waitUntil: 'networkidle2', timeout: 60000 });
    await page.evaluate(() => {
        const el = document.querySelector('.guest-cancel-entry');
        if (el) el.scrollIntoView({ behavior: 'instant', block: 'center' });
    });
    await new Promise(r => setTimeout(r, 800));
    await page.screenshot({ path: path.join('tmp', 'cancel_btn_mobile.png'), fullPage: false });

    await browser.close();
})().catch(e => { console.error(e); process.exit(1); });
