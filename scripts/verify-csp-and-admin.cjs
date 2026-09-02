// CSP 강화(script-src 'unsafe-inline' 제거) + 관리자 판별 단일화 회귀 검증
//
// 확인 항목
//   1) 각 페이지가 CSP 위반 없이 뜨는가 — 인라인 스크립트를 하나라도 놓쳤으면
//      콘솔에 "Refused to execute inline script" 가 찍힌다
//   2) 외부로 분리한 스크립트가 실제로 로드되고 동작하는가
//   3) 인라인 이벤트 핸들러(onclick 등)가 HTML 에 남아 있지 않은가
//   4) 관리자 판별이 profiles.role 기준으로 바뀐 뒤에도 비로그인 화면이 정상인가
//   5) is_admin() RPC 가 비로그인에게 false 를 주는가
//
// ⚠️ 로그인/관리자 화면은 자격증명이 없어 검증할 수 없다. PO 확인 필요.
//
// 사용법: node scripts/verify-csp-and-admin.cjs [BASE_URL]
const path = require('path');
const puppeteer = require(path.join(process.env.APPDATA, 'npm', 'node_modules', 'puppeteer'));

const BASE = process.argv[2] || 'http://localhost:8765';
const PAGES = ['/index.html', '/speakup.html', '/privacy.html', '/terms.html',
               '/unsubscribe.html', '/profile.html', '/admin.html',
               '/ai-study-circle.html', '/v0/index.html'];

const results = [];
function check(name, pass, detail) {
    results.push({ name, pass, detail });
    console.log(`${pass ? '  OK  ' : '  FAIL'} ${name}${detail ? ' — ' + detail : ''}`);
}

(async () => {
    const browser = await puppeteer.launch({ headless: 'new' });

    // ---------- 1) 페이지별 CSP 위반 / JS 에러 ----------
    console.log('\n[1] 페이지별 CSP 위반·JS 에러 (비로그인)');
    for (const p of PAGES) {
        const page = await browser.newPage();
        const csp = [], errs = [];
        page.on('console', m => {
            const t = m.text();
            if (/Refused to (execute|load|apply)|Content Security Policy/i.test(t)) csp.push(t);
        });
        page.on('pageerror', e => errs.push(String(e.message || e)));
        try {
            await page.goto(BASE + p, { waitUntil: 'networkidle2', timeout: 45000 });
            await new Promise(r => setTimeout(r, 2000));
        } catch (e) {
            check(`${p} 로드`, false, String(e.message || e).slice(0, 80));
            await page.close();
            continue;
        }
        // 인라인 스크립트를 놓쳤으면 여기서 잡힌다
        const cspScript = csp.filter(t => /inline script|script-src/i.test(t));
        check(`${p} — CSP 위반 없음`, cspScript.length === 0, cspScript[0] ? cspScript[0].slice(0, 110) : '');
        check(`${p} — JS 에러 없음`, errs.length === 0, errs[0] ? errs[0].slice(0, 110) : '');
        await page.close();
    }

    // ---------- 2) 분리한 스크립트가 실제로 붙었는가 ----------
    console.log('\n[2] 외부로 분리한 스크립트 동작');
    const page = await browser.newPage();

    await page.goto(BASE + '/speakup.html', { waitUntil: 'networkidle2', timeout: 45000 });
    await new Promise(r => setTimeout(r, 2500));
    const inqLoaded = await page.evaluate(() =>
        Array.from(document.scripts).some(s => /speakup-inquiry\.js/.test(s.src)));
    check('speakup — 문의 모달 스크립트 로드됨', inqLoaded);
    // 분리한 스크립트가 실제로 '실행'되어 핸들러를 붙였는지 확인한다.
    //
    // ⚠️ 이 스크립트가 참조하는 `nav-inquiry-link` 는 speakup.html 을 포함해 어느
    //    페이지에도 없다(원래부터 없던 죽은 참조 — 2026-09-02 확인). speakup 푸터의
    //    '문의하기'는 index.html#footer-inquiry-link 로 이동하므로, 이 페이지의
    //    문의 모달은 여는 경로가 없다. 이번 CSP 작업과 무관한 기존 상태다.
    //    → 열리는지 대신 '닫기 핸들러가 붙었는지'로 스크립트 실행을 확인한다.
    const closeWorks = await page.evaluate(() => {
        const modal = document.getElementById('inquiry-modal');
        const btn = document.getElementById('inquiry-close-btn');
        if (!modal || !btn) return 'element-missing';
        modal.classList.add('open');
        btn.click();
        return modal.classList.contains('open') ? 'handler-not-bound' : 'handler-bound';
    });
    check('speakup — 문의 모달 닫기 핸들러가 붙음 (스크립트 실행 확인)',
        closeWorks === 'handler-bound', closeWorks);

    await page.goto(BASE + '/privacy.html', { waitUntil: 'networkidle2', timeout: 45000 });
    await new Promise(r => setTimeout(r, 1500));
    const navToggles = await page.evaluate(() => {
        const btn = document.querySelector('.mobile-menu-btn');
        const links = document.querySelector('.nav-links');
        if (!btn || !links) return 'element-missing';
        const before = links.classList.contains('show');
        btn.click();
        return links.classList.contains('show') !== before ? 'toggled' : 'no-change';
    });
    check('privacy — 모바일 메뉴 토글 동작', navToggles === 'toggled', navToggles);

    // ---------- 3) 인라인 핸들러가 HTML 에 남아 있지 않은가 ----------
    console.log('\n[3] 인라인 이벤트 핸들러 잔존 검사');
    let leftover = [];
    for (const p of PAGES) {
        await page.goto(BASE + p, { waitUntil: 'domcontentloaded', timeout: 45000 });
        const n = await page.evaluate(() =>
            document.querySelectorAll('[onclick],[onchange],[oninput],[onsubmit],[onload]').length);
        if (n > 0) leftover.push(`${p}:${n}`);
    }
    check('인라인 핸들러 0건', leftover.length === 0, leftover.join(', ') || '전 페이지 0건');

    // ---------- 4) 관리자 판별 ----------
    console.log('\n[4] 관리자 판별 (profiles.role 단일 출처)');
    await page.goto(BASE + '/index.html', { waitUntil: 'networkidle2', timeout: 45000 });
    await new Promise(r => setTimeout(r, 2000));
    const adminState = await page.evaluate(async () => {
        const out = { adminEmailsGone: typeof ADMIN_EMAILS === 'undefined' };
        const { data, error } = await _supabase.rpc('is_admin');
        out.isAdmin = error ? ('ERR ' + error.message) : data;
        return out;
    });
    check('클라이언트 ADMIN_EMAILS 상수 제거됨', adminState.adminEmailsGone === true,
        adminState.adminEmailsGone ? '없음' : '아직 남아 있음');
    check('비로그인 is_admin() = false', adminState.isAdmin === false, String(adminState.isAdmin));

    await browser.close();
    const failed = results.filter(r => !r.pass);
    console.log(`\n===== 결과: ${results.length - failed.length}/${results.length} 통과 =====`);
    if (failed.length) { console.log('실패 항목:'); failed.forEach(f => console.log('  · ' + f.name + (f.detail ? ' — ' + f.detail : ''))); }
    process.exit(failed.length ? 1 : 0);
})().catch(e => { console.error('검증 스크립트 오류:', e); process.exit(3); });
