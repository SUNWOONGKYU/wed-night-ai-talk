// 페이스북 모바일 페이지에서 input/placeholder 크기 측정
const path = require('path');
const puppeteer = require(path.join(process.env.APPDATA, 'npm', 'node_modules', 'puppeteer'));

(async () => {
    const browser = await puppeteer.launch({ headless: 'new' });
    const page = await browser.newPage();

    await page.setViewport({ width: 393, height: 852, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
    await page.setUserAgent('Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1');

    // m.facebook.com 의 로그인 페이지 (input 측정용)
    await page.goto('https://m.facebook.com/', { waitUntil: 'networkidle2', timeout: 30000 });
    await new Promise(r => setTimeout(r, 2500));

    const fbInputs = await page.evaluate(() => {
        const inputs = Array.from(document.querySelectorAll('input, textarea'));
        return inputs.slice(0, 5).map(el => {
            const cs = getComputedStyle(el);
            const r = el.getBoundingClientRect();
            return {
                type: el.type || el.tagName,
                placeholder: (el.placeholder || el.getAttribute('aria-label') || '').slice(0, 30),
                fontSize: cs.fontSize,
                lineHeight: cs.lineHeight,
                padding: cs.padding,
                width: Math.round(r.width),
                height: Math.round(r.height),
            };
        });
    });

    console.log('========== m.facebook.com inputs ==========');
    fbInputs.forEach((v, i) => {
        console.log(`[${i}] type=${v.type} | font=${v.fontSize} | lh=${v.lineHeight} | pad=${v.padding} | w=${v.width} h=${v.height} | "${v.placeholder}"`);
    });

    const outDir = path.join(__dirname, '..', 'tmp');
    require('fs').mkdirSync(outDir, { recursive: true });
    await page.screenshot({ path: path.join(outDir, 'mobile_fb.png'), fullPage: false });
    console.log('Screenshot:', path.join(outDir, 'mobile_fb.png'));

    await browser.close();
})().catch(e => { console.error(e); process.exit(1); });
