const path = require('path');
const puppeteer = require(path.join(process.env.APPDATA, 'npm', 'node_modules', 'puppeteer'));

(async () => {
    const browser = await puppeteer.launch({ headless: 'new' });
    const page = await browser.newPage();
    await page.setCacheEnabled(false);
    await page.setViewport({ width: 1280, height: 900 });
    await page.goto('https://waat.community/?_=' + Date.now(), { waitUntil: 'networkidle2', timeout: 60000 });
    await new Promise(r => setTimeout(r, 1200));
    await page.evaluate(() => {
        document.querySelector('footer').scrollIntoView({ behavior: 'instant', block: 'end' });
    });
    await new Promise(r => setTimeout(r, 400));
    const info = await page.evaluate(() => {
        const links = Array.from(document.querySelectorAll('.footer-related a')).map(a => ({
            href: a.href, name: a.querySelector('.related-name')?.textContent.trim(),
            desc: a.querySelector('.related-desc')?.innerHTML.trim()
        }));
        return links;
    });
    console.log(JSON.stringify(info, null, 2));
    await page.screenshot({ path: path.join('tmp', 'footer_related_desktop.png'), fullPage: false });

    await page.setViewport({ width: 390, height: 844 });
    await page.goto('https://waat.community/?_=' + Date.now(), { waitUntil: 'networkidle2', timeout: 60000 });
    await page.evaluate(() => {
        document.querySelector('footer').scrollIntoView({ behavior: 'instant', block: 'end' });
    });
    await new Promise(r => setTimeout(r, 400));
    await page.screenshot({ path: path.join('tmp', 'footer_related_mobile.png'), fullPage: false });

    await browser.close();
})().catch(e => { console.error(e); process.exit(1); });
