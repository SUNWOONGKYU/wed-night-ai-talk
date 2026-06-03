// hero 영역 클로즈업 — 배포 사이트
const path = require('path');
const puppeteer = require(path.join(process.env.APPDATA, 'npm', 'node_modules', 'puppeteer'));

const URL = 'https://wed-night-ai-talk.vercel.app/';

(async () => {
    const browser = await puppeteer.launch({ headless: 'new' });
    const page = await browser.newPage();
    await page.setViewport({ width: 1280, height: 800, deviceScaleFactor: 2 });
    await page.goto(URL, { waitUntil: 'networkidle2' });
    await new Promise(r => setTimeout(r, 2000));

    // hero 영역 내 떠다니는 요소 점검
    const info = await page.evaluate(() => {
        const kw = Array.from(document.querySelectorAll('.float-keyword')).map(el => ({
            text: el.textContent,
            opacity: getComputedStyle(el).opacity
        }));
        const canvas = document.getElementById('hero-canvas');
        return {
            floatKeywords: kw,
            canvasSize: canvas ? canvas.width + 'x' + canvas.height : null
        };
    });
    console.log('float-keyword 개수:', info.floatKeywords.length);
    info.floatKeywords.forEach(k => console.log('  ', k.text, 'opacity=', k.opacity));
    console.log('hero canvas:', info.canvasSize);

    const hero = await page.$('.hero');
    if (hero) await hero.screenshot({ path: path.join(__dirname, '..', 'tmp', 'hero_closeup.png') });
    await browser.close();
    console.log('Saved hero_closeup.png');
})().catch(e => { console.error(e); process.exit(1); });
