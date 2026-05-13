// 모바일 뷰포트에서 Free Talk 페이지의 글씨 크기 측정 + 스크린샷
const path = require('path');
const puppeteer = require(path.join(process.env.APPDATA, 'npm', 'node_modules', 'puppeteer'));

(async () => {
    const browser = await puppeteer.launch({ headless: 'new' });
    const page = await browser.newPage();

    // iPhone 14 Pro 사이즈 (FB 모바일 기준)
    await page.setViewport({ width: 393, height: 852, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
    await page.setUserAgent('Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1');

    await page.goto('https://wed-night-ai-talk.vercel.app/speakup.html', { waitUntil: 'networkidle2', timeout: 30000 });
    await new Promise(r => setTimeout(r, 3000)); // 게시글 로딩 대기

    // 측정할 요소들
    const measurements = await page.evaluate(() => {
        const get = sel => {
            const el = document.querySelector(sel);
            if (!el) return null;
            const cs = getComputedStyle(el);
            const r = el.getBoundingClientRect();
            return {
                selector: sel,
                fontSize: cs.fontSize,
                fontWeight: cs.fontWeight,
                lineHeight: cs.lineHeight,
                width: Math.round(r.width),
                height: Math.round(r.height),
                text: (el.textContent || '').trim().slice(0, 30)
            };
        };
        return {
            sectionTitle: get('.speakup-page .section-title'),
            sectionDesc: get('.speakup-page .section-desc'),
            postAuthor: get('.post-card .post-author'),
            postTime: get('.post-card .post-time'),
            postAvatar: get('.post-card .post-avatar'),
            postTitle: get('.post-card .post-title'),
            postContent: get('.post-card .post-content'),
            reactionBtn: get('.post-card .reaction-btn'),
            commentToggleBtn: get('.post-card .comment-toggle-btn'),
            shareBtn: get('.post-card .post-share-btn'),
            commentAuthor: get('.comment-item .comment-author'),
            commentTime: get('.comment-item .comment-time'),
            commentBody: get('.comment-item .comment-body'),
            commentInput: get('.comment-input'),
        };
    });

    console.log('========== Measurement ==========');
    for (const [k, v] of Object.entries(measurements)) {
        if (!v) { console.log(`${k}: NOT FOUND`); continue; }
        console.log(`${k.padEnd(20)} | ${v.fontSize.padStart(7)} | w=${String(v.width).padStart(4)} h=${String(v.height).padStart(3)} | ${v.text}`);
    }

    // 스크린샷
    const outDir = path.join(__dirname, '..', 'tmp');
    require('fs').mkdirSync(outDir, { recursive: true });
    await page.screenshot({ path: path.join(outDir, 'mobile_speakup.png'), fullPage: false });
    console.log('Screenshot:', path.join(outDir, 'mobile_speakup.png'));

    await browser.close();
})().catch(e => { console.error(e); process.exit(1); });
