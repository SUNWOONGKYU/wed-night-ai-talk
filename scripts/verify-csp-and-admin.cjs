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

    // speakup.html 에 있던 문의 모달은 여는 경로가 없는 죽은 마크업이어서
    // 2026-09-02 에 통째로 삭제했다(PO 결정). 문의는 index.html 에서만 받는다.
    // → 잔재가 남지 않았는지, 그리고 게시판이 멀쩡한지 확인한다.
    await page.goto(BASE + '/speakup.html', { waitUntil: 'networkidle2', timeout: 45000 });
    await new Promise(r => setTimeout(r, 3000));
    const sp = await page.evaluate(() => ({
        deadModal: !!document.getElementById('inquiry-modal'),
        deadScript: Array.from(document.scripts).some(s => /speakup-inquiry\.js/.test(s.src)),
        posts: document.querySelectorAll('.post-card').length,
        footerInquiry: !!document.querySelector('a[href*="footer-inquiry-link"]')
    }));
    check('speakup — 죽은 문의 모달 제거됨', !sp.deadModal, sp.deadModal ? '아직 남아 있음' : '없음');
    check('speakup — 죽은 스크립트 참조 제거됨', !sp.deadScript);
    check('speakup — 게시글 목록 정상', sp.posts > 0, `${sp.posts}건`);
    check('speakup — 푸터 문의하기 링크 유지', sp.footerInquiry);

    // index.html 의 진짜 문의 모달은 계속 동작해야 한다
    await page.goto(BASE + '/index.html', { waitUntil: 'networkidle2', timeout: 45000 });
    await new Promise(r => setTimeout(r, 2500));
    const idxInquiry = await page.evaluate(() => {
        const link = document.getElementById('footer-inquiry-link');
        const modal = document.getElementById('inquiry-modal');
        if (!link || !modal) return 'element-missing';
        link.click();
        return modal.classList.contains('open') ? 'opened' : 'not-opened';
    });
    check('index — 문의하기 클릭 시 모달 열림', idxInquiry === 'opened', idxInquiry);

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
