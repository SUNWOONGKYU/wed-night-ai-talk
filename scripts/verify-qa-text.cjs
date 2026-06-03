// 배포 사이트에서 모임 description 텍스트 검증
const path = require('path');
const puppeteer = require(path.join(process.env.APPDATA, 'npm', 'node_modules', 'puppeteer'));

const URL = 'https://wed-night-ai-talk.vercel.app/';

(async () => {
    const browser = await puppeteer.launch({ headless: 'new' });
    const page = await browser.newPage();
    await page.setViewport({ width: 1280, height: 900, deviceScaleFactor: 2 });
    await page.goto(URL, { waitUntil: 'networkidle2' });
    // 이벤트 카드가 DB에서 로드될 때까지 대기
    await page.waitForSelector('.description-value', { timeout: 15000 }).catch(() => {});
    await new Promise(r => setTimeout(r, 2000));

    const descs = await page.evaluate(() => {
        return Array.from(document.querySelectorAll('.description-value'))
            .map(el => el.textContent.replace(/\s+/g, ' ').trim());
    });
    console.log('=== description-value 텍스트 ===');
    descs.forEach((d, i) => console.log((i + 1) + ') ' + d));

    const intro = descs.filter(d => d.includes('소개'));
    const qa = descs.filter(d => d.includes('문답'));
    console.log('\n"소개" 포함:', intro.length, '건');
    console.log('"문답" 포함:', qa.length, '건');

    await page.screenshot({ path: path.join(__dirname, '..', 'tmp', 'schedule_verify.png'), fullPage: false });
    await browser.close();
})().catch(e => { console.error(e); process.exit(1); });
