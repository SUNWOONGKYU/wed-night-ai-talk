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
        return Array.from(document.querySelectorAll('.schedule-card')).map(c => ({
            meeting_no: c.querySelector('.schedule-meeting-no')?.textContent.trim(),
            date: c.querySelector('.schedule-date-line')?.textContent.trim().replace(/\s+/g, ' '),
            slots: Array.from(c.querySelectorAll('.waat-slot-card')).map(s => s.querySelector('.waat-slot-name')?.textContent.trim().replace(/\s+/g, ' '))
        }));
    });
    console.log(JSON.stringify(info, null, 2));
})().catch(e => { console.error(e); process.exit(1); });
