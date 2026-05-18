// Free Talk 글 등록 — Edge 브라우저로 재현 진단
const path = require('path');
const puppeteer = require(path.join(process.env.APPDATA, 'npm', 'node_modules', 'puppeteer'));

const EDGE_PATH = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';
const BASE = 'https://wed-night-ai-talk.vercel.app';
const ts = Date.now();
const TEST_EMAIL = 'waatdiag' + ts + '@gmail.com';
const TEST_PW = 'waatTest1234';

(async () => {
    const browser = await puppeteer.launch({ headless: 'new', executablePath: EDGE_PATH });
    const page = await browser.newPage();
    await page.setViewport({ width: 1280, height: 900 });

    page.on('response', r => {
        const u = r.url();
        if (u.includes('supabase.co')) console.log('  [resp]', r.status(), r.request().method(), u.replace(/https:\/\/[^/]+/, ''));
    });
    page.on('requestfailed', r => {
        const u = r.url();
        if (u.includes('supabase.co')) console.log('  [FAIL]', r.method(), u.replace(/https:\/\/[^/]+/, ''), '—', r.failure() && r.failure().errorText);
    });
    page.on('console', m => {
        if (m.type() === 'error') console.log('  [console.error]', m.text());
    });

    console.log('=== Edge — 1. 회원가입 ===', TEST_EMAIL);
    await page.goto(BASE + '/', { waitUntil: 'networkidle2' });
    await new Promise(r => setTimeout(r, 1500));
    await page.click('[data-open-modal="signup"]');
    await new Promise(r => setTimeout(r, 800));
    await page.type('#s-email', TEST_EMAIL);
    await page.type('#s-password', TEST_PW);
    await page.type('#s-name', '엣지진단');
    await page.type('#s-contact', '[masked-phone]');
    await page.click('#s-privacy-agree');
    await page.click('#signup-form .form-submit');
    await new Promise(r => setTimeout(r, 6000));

    const hasSession = await page.evaluate(async () => {
        try { const s = await Auth.getSession(); return !!(s && s.user); } catch (e) { return 'error:' + e.message; }
    });
    console.log('세션 보유:', hasSession);
    if (hasSession !== true) { await browser.close(); return; }

    console.log('\n=== Edge — 2. speakup 글 등록 ===');
    await page.goto(BASE + '/speakup.html', { waitUntil: 'networkidle2' });
    await new Promise(r => setTimeout(r, 2500));
    await page.click('#post-write-open-btn');
    await new Promise(r => setTimeout(r, 800));
    await page.type('#post-title', '진단용 테스트 글 EDGE ' + ts);
    await page.type('#post-content', 'Edge 글 등록 진단.');

    console.log('등록 클릭 → posts 요청 추적:');
    const t0 = Date.now();
    await page.click('#post-submit-btn');
    await new Promise(r => setTimeout(r, 35000));
    const postStatus = await page.evaluate(() => {
        const s = document.getElementById('post-status');
        return s ? s.textContent : '(없음)';
    });
    console.log('등록 후 ' + Math.round((Date.now() - t0) / 1000) + '초 — 상태:', postStatus);

    await browser.close();
})().catch(e => { console.error('스크립트 오류:', e); process.exit(1); });
