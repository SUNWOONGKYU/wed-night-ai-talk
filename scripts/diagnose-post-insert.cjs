// Free Talk 글 등록 hang 진단 — 배포 사이트에서 재현 + 네트워크 추적
const path = require('path');
const puppeteer = require(path.join(process.env.APPDATA, 'npm', 'node_modules', 'puppeteer'));

const BASE = 'https://wed-night-ai-talk.vercel.app';
const ts = Date.now();
const TEST_EMAIL = 'waatdiag' + ts + '@gmail.com';
const TEST_PW = 'waatTest1234';

(async () => {
    const browser = await puppeteer.launch({ headless: 'new' });
    const page = await browser.newPage();
    await page.setViewport({ width: 1280, height: 900 });

    // 네트워크 추적 — supabase 요청
    const reqs = {};
    page.on('request', r => {
        const u = r.url();
        if (u.includes('supabase.co')) reqs[r._requestId || u + Math.random()] = { url: u, method: r.method(), start: Date.now(), status: 'pending' };
    });
    page.on('response', async r => {
        const u = r.url();
        if (u.includes('supabase.co')) {
            console.log('  [resp]', r.status(), r.request().method(), u.replace(/https:\/\/[^/]+/, ''));
        }
    });
    page.on('requestfailed', r => {
        const u = r.url();
        if (u.includes('supabase.co')) console.log('  [FAIL]', r.method(), u.replace(/https:\/\/[^/]+/, ''), '—', r.failure() && r.failure().errorText);
    });
    page.on('console', m => {
        if (m.type() === 'error') console.log('  [console.error]', m.text());
    });

    console.log('=== 1. 회원가입 시도 ===', TEST_EMAIL);
    await page.goto(BASE + '/', { waitUntil: 'networkidle2' });
    await new Promise(r => setTimeout(r, 1500));
    await page.click('[data-open-modal="signup"]');
    await new Promise(r => setTimeout(r, 800));
    await page.type('#s-email', TEST_EMAIL);
    await page.type('#s-password', TEST_PW);
    await page.type('#s-name', '진단테스트');
    await page.type('#s-contact', '[masked-phone]');
    await page.click('#s-privacy-agree');
    await page.click('#signup-form .form-submit');
    await new Promise(r => setTimeout(r, 6000));
    const signupStatus = await page.evaluate(() => {
        const s = document.getElementById('signup-status');
        return s ? s.textContent : '(없음)';
    });
    console.log('가입 결과:', signupStatus);

    // 세션 확인
    const hasSession = await page.evaluate(async () => {
        try { const s = await Auth.getSession(); return !!(s && s.user); } catch (e) { return 'error:' + e.message; }
    });
    console.log('세션 보유:', hasSession);

    if (hasSession !== true) {
        console.log('\n→ 로그인이 안 됨. 글 등록 진단 불가. 가입/이메일확인 정책 확인 필요.');
        await browser.close();
        return;
    }

    console.log('\n=== 2. speakup 글 등록 시도 ===');
    await page.goto(BASE + '/speakup.html', { waitUntil: 'networkidle2' });
    await new Promise(r => setTimeout(r, 2500));
    await page.click('#post-write-open-btn');
    await new Promise(r => setTimeout(r, 800));
    await page.type('#post-title', '진단용 테스트 글 ' + ts);
    await page.type('#post-content', '글 등록 hang 진단을 위한 테스트입니다.');

    console.log('등록 버튼 클릭 → posts 요청 추적:');
    const t0 = Date.now();
    await page.click('#post-submit-btn');
    // 최대 20초 관찰
    await new Promise(r => setTimeout(r, 20000));
    const elapsed = Date.now() - t0;
    const postStatus = await page.evaluate(() => {
        const s = document.getElementById('post-status');
        return s ? s.textContent : '(없음)';
    });
    console.log('등록 후 ' + Math.round(elapsed / 1000) + '초 경과 — 상태 메시지:', postStatus);

    await browser.close();
})().catch(e => { console.error('스크립트 오류:', e); process.exit(1); });
