// 히어로 풍선 리뉴얼 검증
const path = require('path');
const puppeteer = require(path.join(process.env.APPDATA, 'npm', 'node_modules', 'puppeteer'));

(async () => {
    const browser = await puppeteer.launch({ headless: 'new' });
    const page = await browser.newPage();

    const URL = 'https://waat.community/?_=' + Date.now();

    // Desktop
    await page.setViewport({ width: 1280, height: 900 });
    console.log('[desktop] navigating');
    await page.goto(URL, { waitUntil: 'networkidle2', timeout: 60000 });
    await new Promise(r => setTimeout(r, 1500));

    const counts = await page.evaluate(() => {
        const svg = document.querySelector('.hero-bubbles');
        if (!svg) return null;
        return {
            balloons: svg.querySelectorAll('use[href="#waat-balloon"]').length,
            bubbles:  svg.querySelectorAll('use[href="#waat-bubble"]').length,
            symbols:  svg.querySelectorAll('symbol').length
        };
    });
    console.log('[count]', counts);

    await page.screenshot({ path: path.join('tmp', 'hero_balloons_desktop.png'), fullPage: false, clip: { x: 0, y: 0, width: 1280, height: 760 } });

    // Mobile
    await page.setViewport({ width: 390, height: 844 });
    await page.goto(URL, { waitUntil: 'networkidle2', timeout: 60000 });
    await new Promise(r => setTimeout(r, 1200));
    await page.screenshot({ path: path.join('tmp', 'hero_balloons_mobile.png'), fullPage: false, clip: { x: 0, y: 0, width: 390, height: 760 } });

    await browser.close();
    console.log('\n=== 스크린샷 ===');
    console.log('tmp/hero_balloons_desktop.png');
    console.log('tmp/hero_balloons_mobile.png');
})().catch(e => { console.error(e); process.exit(1); });
