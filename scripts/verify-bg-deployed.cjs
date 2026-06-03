// 배포 사이트 검증 — 배경색 + 파티클 반짝임
const path = require('path');
const puppeteer = require(path.join(process.env.APPDATA, 'npm', 'node_modules', 'puppeteer'));

const URL = 'https://wed-night-ai-talk.vercel.app/';

(async () => {
    const browser = await puppeteer.launch({ headless: 'new' });
    const page = await browser.newPage();
    await page.setViewport({ width: 1280, height: 900, deviceScaleFactor: 2 });
    await page.goto(URL, { waitUntil: 'networkidle2' });

    // 로드된 CSS 버전 확인
    const cssHref = await page.evaluate(() => {
        const l = document.querySelector('link[href*="style.css"]');
        return l ? l.getAttribute('href') : null;
    });
    // body 배경색
    const bg = await page.evaluate(() => getComputedStyle(document.body).backgroundColor);
    // animations.js 버전
    const animSrc = await page.evaluate(() => {
        const s = document.querySelector('script[src*="animations.js"]');
        return s ? s.getAttribute('src') : null;
    });

    console.log('CSS        :', cssHref);
    console.log('animations :', animSrc);
    console.log('body bg    :', bg);

    // twinkle 확인 — hero canvas 픽셀을 0.6초 간격으로 2번 캡처해 차이 측정
    await new Promise(r => setTimeout(r, 1500));
    const sample = async () => page.evaluate(() => {
        const c = document.getElementById('hero-canvas');
        if (!c) return null;
        const ctx = c.getContext('2d');
        const d = ctx.getImageData(0, 0, c.width, Math.min(400, c.height)).data;
        let sum = 0;
        for (let i = 0; i < d.length; i += 4) sum += d[i] + d[i + 1] + d[i + 2];
        return sum;
    });
    const s1 = await sample();
    await new Promise(r => setTimeout(r, 700));
    const s2 = await sample();
    console.log('canvas frame1:', s1, 'frame2:', s2, '→ 변화:', s1 !== null && s1 !== s2 ? '있음 (애니메이션 작동)' : '없음');

    await page.screenshot({ path: path.join(__dirname, '..', 'tmp', 'deployed_bg.png') });
    await browser.close();
})().catch(e => { console.error(e); process.exit(1); });
