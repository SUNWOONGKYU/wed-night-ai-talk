const path = require('path');
const puppeteer = require(path.join(process.env.APPDATA, 'npm', 'node_modules', 'puppeteer'));

(async () => {
    const browser = await puppeteer.launch({ headless: 'new' });
    const page = await browser.newPage();
    await page.setCacheEnabled(false);
    await page.setViewport({ width: 1280, height: 900 });
    await page.goto('https://waat.community/?_=' + Date.now(), { waitUntil: 'networkidle2', timeout: 60000 });
    await new Promise(r => setTimeout(r, 1500));

    const info = await page.evaluate(() => {
        const cards = Array.from(document.querySelectorAll('.schedule-card'));
        const first = cards[0];
        if (!first) return null;
        const date = first.querySelector('.schedule-date-line')?.textContent.trim().replace(/\s+/g, ' ');
        const slots = Array.from(first.querySelectorAll('.waat-slot-card')).map(s => ({
            name: s.querySelector('.waat-slot-name')?.textContent.trim().replace(/\s+/g, ' ')
        }));
        return { date, slots };
    });
    console.log(JSON.stringify(info, null, 2));

    await page.evaluate(() => {
        document.querySelector('.schedule-card').scrollIntoView({ behavior: 'instant', block: 'start' });
    });
    await new Promise(r => setTimeout(r, 400));
    await page.screenshot({ path: path.join('tmp', 'sunshine_cap_15.png'), fullPage: false });
    await browser.close();
})().catch(e => { console.error(e); process.exit(1); });
