// 모바일 뷰포트에서 글쓰기 폼을 강제로 열고 input/textarea 크기 측정 + 스크린샷
const path = require('path');
const puppeteer = require(path.join(process.env.APPDATA, 'npm', 'node_modules', 'puppeteer'));

(async () => {
    const browser = await puppeteer.launch({ headless: 'new' });
    const page = await browser.newPage();

    await page.setViewport({ width: 393, height: 852, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
    await page.setUserAgent('Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1');

    await page.goto('https://wed-night-ai-talk.vercel.app/speakup.html', { waitUntil: 'networkidle2', timeout: 30000 });
    await new Promise(r => setTimeout(r, 2500));

    // 글쓰기 폼 강제로 보이게 (비로그인이라도 측정 가능하게)
    await page.evaluate(() => {
        const wrap = document.getElementById('post-form-wrap');
        if (wrap) wrap.style.display = 'block';
        const loginPrompt = document.getElementById('post-login-prompt');
        if (loginPrompt) loginPrompt.style.display = 'none';
        const writeBtn = document.getElementById('post-write-btn-wrap');
        if (writeBtn) writeBtn.style.display = 'none';
        // 폼이 페이지 상단에 보이게 스크롤
        if (wrap) wrap.scrollIntoView({ block: 'start' });
        window.scrollBy(0, -80);
    });
    await new Promise(r => setTimeout(r, 800));

    const measurements = await page.evaluate(() => {
        const get = (sel) => {
            const el = document.querySelector(sel);
            if (!el) return null;
            const cs = getComputedStyle(el);
            const r = el.getBoundingClientRect();
            return {
                fontSize: cs.fontSize,
                fontWeight: cs.fontWeight,
                lineHeight: cs.lineHeight,
                padding: cs.padding,
                width: Math.round(r.width),
                height: Math.round(r.height),
                left: Math.round(r.left),
                right: Math.round(r.right),
            };
        };
        return {
            viewportWidth: window.innerWidth,
            postFormWrap: get('#post-form-wrap'),
            postForm: get('#post-form'),
            postTitle: get('#post-title'),
            postContent: get('#post-content'),
            postFbUrl: get('#post-fb-url'),
            submitBtn: get('#post-submit-btn'),
        };
    });

    console.log('========== Write Form Measurement ==========');
    console.log('viewport width:', measurements.viewportWidth + 'px');
    for (const [k, v] of Object.entries(measurements)) {
        if (k === 'viewportWidth') continue;
        if (!v) { console.log(`${k}: NOT FOUND`); continue; }
        console.log(`${k.padEnd(15)} | font=${v.fontSize.padStart(6)} wt=${v.fontWeight} | pad=${v.padding} | w=${String(v.width).padStart(4)} h=${String(v.height).padStart(3)} | left=${v.left} right=${v.right}`);
    }

    const outDir = path.join(__dirname, '..', 'tmp');
    require('fs').mkdirSync(outDir, { recursive: true });
    await page.screenshot({ path: path.join(outDir, 'mobile_write_form.png'), fullPage: false });
    console.log('Screenshot:', path.join(outDir, 'mobile_write_form.png'));

    await browser.close();
})().catch(e => { console.error(e); process.exit(1); });
