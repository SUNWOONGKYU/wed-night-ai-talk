const path = require('path');
const puppeteer = require(path.join(process.env.APPDATA, 'npm', 'node_modules', 'puppeteer'));

(async () => {
    const browser = await puppeteer.launch({ headless: 'new', args: ['--disable-cache'] });
    const page = await browser.newPage();
    await page.setCacheEnabled(false);
    await page.setViewport({ width: 1280, height: 900 });

    await page.goto('https://waat.community/?_=' + Date.now(), { waitUntil: 'networkidle2', timeout: 60000 });
    await new Promise(r => setTimeout(r, 1500));

    // 모임 일정 섹션
    await page.evaluate(() => {
        const el = document.getElementById('schedule');
        if (el) el.scrollIntoView({ behavior: 'instant', block: 'start' });
    });
    await new Promise(r => setTimeout(r, 500));

    const info = await page.evaluate(() => {
        const cards = Array.from(document.querySelectorAll('.schedule-card'));
        const dates = cards.map(c => c.querySelector('.schedule-date-line')?.textContent.trim().replace(/\s+/g, ' '));
        const bankLine = document.querySelector('.provision-bank');
        const bankCS = bankLine ? getComputedStyle(bankLine) : null;
        return {
            event_count: cards.length,
            event_dates: dates,
            bank_text: bankLine ? bankLine.textContent.trim() : null,
            bank_font_weight: bankCS ? bankCS.fontWeight : null,
            bank_font_size: bankCS ? bankCS.fontSize : null
        };
    });
    console.log(JSON.stringify(info, null, 2));

    await page.screenshot({ path: path.join('tmp', 'after_deactivate_27.png'), fullPage: false });
    await browser.close();
})().catch(e => { console.error(e); process.exit(1); });
