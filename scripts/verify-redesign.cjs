// hero 재설계 배포 검증 — 색 회귀 + 말풍선 + 배경색
const path = require('path');
const puppeteer = require(path.join(process.env.APPDATA, 'npm', 'node_modules', 'puppeteer'));

const BASE = 'https://wed-night-ai-talk.vercel.app';

(async () => {
    const browser = await puppeteer.launch({ headless: 'new' });

    // --- index 데스크톱 ---
    const p = await browser.newPage();
    await p.setViewport({ width: 1280, height: 900, deviceScaleFactor: 1 });
    await p.goto(BASE + '/', { waitUntil: 'networkidle2' });
    await new Promise(r => setTimeout(r, 2500));

    const checks = await p.evaluate(() => {
        const css = document.querySelector('link[href*="style.css"]');
        const bodyBg = getComputedStyle(document.body).backgroundColor;
        const bubbles = document.querySelectorAll('.hero-bubbles use').length;
        const canvas = document.getElementById('hero-canvas');
        // 잔존 cyan/purple 검출 — 모든 요소의 주요 색상 속성 스캔
        let cyanPurple = 0;
        document.querySelectorAll('*').forEach(el => {
            const s = getComputedStyle(el);
            [s.color, s.backgroundColor, s.borderColor, s.boxShadow].forEach(v => {
                if (/\b(0,\s*229,\s*255|168,\s*85,\s*247|77,\s*124,\s*255)\b/.test(v)) cyanPurple++;
            });
        });
        return {
            cssVer: css ? css.getAttribute('href') : null,
            bodyBg, bubbles,
            canvasExists: !!canvas,
            cyanPurpleHits: cyanPurple
        };
    });
    console.log('=== index.html 배포 검증 ===');
    console.log('CSS 버전      :', checks.cssVer);
    console.log('body 배경색   :', checks.bodyBg, '(기대: rgb(253, 252, 250))');
    console.log('말풍선 use 수 :', checks.bubbles, '(기대: 8)');
    console.log('hero-canvas   :', checks.canvasExists ? '잔존(문제)' : '없음(정상)');
    console.log('cyan/purple 잔재:', checks.cyanPurpleHits, '곳 (기대: 0)');

    await p.screenshot({ path: path.join(__dirname, '..', 'tmp', 'redesign_index.png'), fullPage: true });

    // --- speakup ---
    const sp = await browser.newPage();
    await sp.setViewport({ width: 1280, height: 900, deviceScaleFactor: 1 });
    await sp.goto(BASE + '/speakup.html', { waitUntil: 'networkidle2' });
    await new Promise(r => setTimeout(r, 2000));
    await sp.screenshot({ path: path.join(__dirname, '..', 'tmp', 'redesign_speakup.png'), fullPage: true });
    console.log('\nspeakup.html 스크린샷 저장');

    await browser.close();
})().catch(e => { console.error(e); process.exit(1); });
