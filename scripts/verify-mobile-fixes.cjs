// 모바일 보안/UX 보완 검증 — Vercel 배포본을 iPhone 14 Pro 에뮬레이션으로 직접 테스트
const path = require('path');
const puppeteer = require(path.join(process.env.APPDATA, 'npm', 'node_modules', 'puppeteer'));

const SITE = 'https://wed-night-ai-talk.vercel.app';

const PASS = (msg) => console.log('  ✓ ' + msg);
const FAIL = (msg) => { console.log('  ✗ ' + msg); process.exitCode = 1; };
const SECTION = (msg) => console.log('\n[' + msg + ']');

(async () => {
    const browser = await puppeteer.launch({ headless: 'new' });
    const page = await browser.newPage();
    await page.setViewport({ width: 393, height: 852, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
    await page.setUserAgent('Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1');

    // ===== 1. viewport meta: maximum-scale 제거됐는지 =====
    SECTION('1. viewport meta — maximum-scale 제거');
    for (const p of ['/', '/speakup.html', '/profile.html']) {
        await page.goto(SITE + p, { waitUntil: 'domcontentloaded', timeout: 30000 });
        const v = await page.$eval('meta[name="viewport"]', el => el.content);
        if (/maximum-scale/i.test(v)) FAIL(`${p} 에 maximum-scale 남아있음: "${v}"`);
        else PASS(`${p} — "${v}"`);
    }

    // ===== 2. CSS 버전 =====
    SECTION('2. CSS 캐시 버전 v=20260514j');
    for (const p of ['/', '/speakup.html', '/admin.html', '/profile.html', '/terms.html', '/privacy.html']) {
        await page.goto(SITE + p, { waitUntil: 'domcontentloaded', timeout: 30000 });
        const href = await page.$eval('link[rel="stylesheet"][href*="style.css"]', el => el.getAttribute('href'));
        if (href.includes('v=20260514j')) PASS(`${p} — ${href}`);
        else FAIL(`${p} — ${href}`);
    }

    // ===== 3. speakup 폼 입력 font-size 16px (iOS 자동줌 차단) =====
    SECTION('3. 모바일 폼 입력 font-size ≥ 16px (iOS 자동 줌 차단)');
    await page.goto(SITE + '/speakup.html', { waitUntil: 'networkidle2', timeout: 30000 });
    await new Promise(r => setTimeout(r, 1500));
    // 게시판 입력칸은 로그인 후 노출이라 css 규칙 자체를 검사
    const cssChecks = await page.evaluate(() => {
        // 가상 input 만들어 적용되는 computed style 측정
        function probe(className) {
            const wrap = document.createElement('div');
            wrap.className = 'form-group';
            const inp = document.createElement('input');
            inp.type = 'text';
            wrap.appendChild(inp);
            document.body.appendChild(wrap);
            const fs = parseFloat(getComputedStyle(inp).fontSize);
            wrap.remove();
            return fs;
        }
        return { formGroupInput: probe() };
    });
    if (cssChecks.formGroupInput >= 16) PASS(`.form-group input computed font-size = ${cssChecks.formGroupInput}px`);
    else FAIL(`.form-group input computed font-size = ${cssChecks.formGroupInput}px (< 16px → iOS 자동줌)`);

    // ===== 4. 글로벌 img max-width:100% =====
    SECTION('4. 글로벌 img 반응형');
    const imgCheck = await page.evaluate(() => {
        const probe = document.createElement('img');
        probe.src = '/logo-waat.png';
        document.body.appendChild(probe);
        const cs = getComputedStyle(probe);
        const out = { maxWidth: cs.maxWidth, height: cs.height };
        probe.remove();
        return out;
    });
    if (imgCheck.maxWidth === '100%') PASS(`img max-width = ${imgCheck.maxWidth}`);
    else FAIL(`img max-width = ${imgCheck.maxWidth}`);

    // ===== 5. 터치 타겟 크기 — mobile-menu-btn =====
    SECTION('5. 터치 타겟 ≥ 44x44px');
    await page.goto(SITE + '/', { waitUntil: 'networkidle2', timeout: 30000 });
    await new Promise(r => setTimeout(r, 800));
    const btn = await page.$eval('.mobile-menu-btn', el => {
        const r = el.getBoundingClientRect();
        return { w: Math.round(r.width), h: Math.round(r.height) };
    });
    if (btn.w >= 44 && btn.h >= 44) PASS(`.mobile-menu-btn ${btn.w}x${btn.h}`);
    else FAIL(`.mobile-menu-btn ${btn.w}x${btn.h} (< 44)`);

    // 모달 열어서 close 버튼 크기 (로그인 모달)
    await page.click('a[data-open-modal="login"]').catch(() => {});
    await new Promise(r => setTimeout(r, 500));
    const closeBtn = await page.$eval('#modal-close-btn', el => {
        const r = el.getBoundingClientRect();
        return { w: Math.round(r.width), h: Math.round(r.height) };
    }).catch(() => null);
    if (closeBtn && closeBtn.w >= 44 && closeBtn.h >= 44) PASS(`#modal-close-btn ${closeBtn.w}x${closeBtn.h}`);
    else if (closeBtn) FAIL(`#modal-close-btn ${closeBtn.w}x${closeBtn.h} (< 44)`);
    else FAIL('#modal-close-btn 못 찾음');

    // ===== 6. 모달 max-height + overflow-y =====
    SECTION('6. 모달 max-height + overflow-y');
    const modalStyle = await page.$eval('#auth-modal .modal-content', el => {
        const cs = getComputedStyle(el);
        const r = el.getBoundingClientRect();
        return { maxHeight: cs.maxHeight, overflowY: cs.overflowY, height: Math.round(r.height), viewportH: window.innerHeight };
    });
    if (modalStyle.maxHeight !== 'none' && modalStyle.height <= modalStyle.viewportH) {
        PASS(`max-height=${modalStyle.maxHeight}, overflow-y=${modalStyle.overflowY}, actual ${modalStyle.height}/${modalStyle.viewportH}px`);
    } else {
        FAIL(`max-height=${modalStyle.maxHeight}, overflow-y=${modalStyle.overflowY}, actual ${modalStyle.height}/${modalStyle.viewportH}px`);
    }

    // 모달 닫기 (ESC)
    await page.keyboard.press('Escape');
    await new Promise(r => setTimeout(r, 400));

    // ===== 7. 모바일 메뉴 외부 클릭 / ESC 닫기 =====
    SECTION('7. 모바일 메뉴 외부 클릭 / ESC 닫기');
    // 메뉴 열기
    await page.click('.mobile-menu-btn');
    await new Promise(r => setTimeout(r, 300));
    let opened = await page.$eval('.nav-links', el => el.classList.contains('show'));
    if (opened) PASS('메뉴 토글 열림');
    else FAIL('메뉴 토글 실패');

    // 외부 클릭
    await page.mouse.click(200, 600);
    await new Promise(r => setTimeout(r, 300));
    let closedByOutside = !(await page.$eval('.nav-links', el => el.classList.contains('show')));
    if (closedByOutside) PASS('외부 클릭으로 닫힘');
    else FAIL('외부 클릭으로 닫히지 않음');

    // 다시 열고 ESC
    await page.click('.mobile-menu-btn');
    await new Promise(r => setTimeout(r, 300));
    await page.keyboard.press('Escape');
    await new Promise(r => setTimeout(r, 300));
    let closedByEsc = !(await page.$eval('.nav-links', el => el.classList.contains('show')));
    if (closedByEsc) PASS('ESC 키로 닫힘');
    else FAIL('ESC 키로 닫히지 않음');

    // ===== 8. speakup 모바일 메뉴도 동일하게 =====
    SECTION('8. speakup.html 모바일 메뉴 동작');
    await page.goto(SITE + '/speakup.html', { waitUntil: 'networkidle2', timeout: 30000 });
    await new Promise(r => setTimeout(r, 800));
    await page.click('.mobile-menu-btn');
    await new Promise(r => setTimeout(r, 300));
    opened = await page.$eval('.nav-links', el => el.classList.contains('show'));
    if (opened) PASS('speakup 메뉴 열림');
    else FAIL('speakup 메뉴 열림 실패');
    await page.keyboard.press('Escape');
    await new Promise(r => setTimeout(r, 300));
    closedByEsc = !(await page.$eval('.nav-links', el => el.classList.contains('show')));
    if (closedByEsc) PASS('speakup ESC 닫힘');
    else FAIL('speakup ESC 닫힘 실패');

    // ===== 9. 가로 스크롤 없는지 =====
    SECTION('9. 가로 스크롤 없는지');
    for (const p of ['/', '/speakup.html', '/profile.html', '/terms.html', '/privacy.html']) {
        await page.goto(SITE + p, { waitUntil: 'networkidle2', timeout: 30000 });
        await new Promise(r => setTimeout(r, 800));
        const hasHScroll = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth + 1);
        const widths = await page.evaluate(() => ({ sw: document.documentElement.scrollWidth, vw: window.innerWidth }));
        if (!hasHScroll) PASS(`${p} — scrollWidth ${widths.sw} ≤ viewport ${widths.vw}`);
        else FAIL(`${p} — scrollWidth ${widths.sw} > viewport ${widths.vw} (가로 스크롤!)`);
    }

    // 스크린샷 저장
    const outDir = path.join(__dirname, '..', 'tmp');
    require('fs').mkdirSync(outDir, { recursive: true });
    for (const [name, url] of [['mobile_home', '/'], ['mobile_speakup_verified', '/speakup.html']]) {
        await page.goto(SITE + url, { waitUntil: 'networkidle2', timeout: 30000 });
        await new Promise(r => setTimeout(r, 1500));
        await page.screenshot({ path: path.join(outDir, name + '.png'), fullPage: false });
    }
    console.log('\nScreenshots saved to tmp/');

    await browser.close();
    console.log('\n=== ' + (process.exitCode ? '일부 실패' : '모두 통과') + ' ===');
})().catch(e => { console.error(e); process.exit(1); });
