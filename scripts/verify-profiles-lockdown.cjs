// profiles 익명 노출 차단(20260902030000) 이후 UI 회귀 검증
//
// curl 200 만으로 판정하지 않는다 — 실제 브라우저에서 다음을 확인한다:
//   1) 게시판 글쓴이 이름이 비로그인 상태로 보이는가        (컬럼 권한 회수의 부작용 확인)
//   2) 가입 모달에서 예비멤버 이메일 입력 시 안내가 뜨는가   (RPC 전환이 실제로 동작하는가)
//   3) 일반 이메일에는 안내가 뜨지 않는가                    (오탐 없음)
//   4) 콘솔에 permission denied / 42501 이 찍히지 않는가
//
// 사용법:  node scripts/verify-profiles-lockdown.cjs <BASE_URL> <예비멤버이메일>
//   예)    node scripts/verify-profiles-lockdown.cjs http://localhost:8000 someone@example.com
const path = require('path');
const puppeteer = require(path.join(process.env.APPDATA, 'npm', 'node_modules', 'puppeteer'));

const BASE = process.argv[2] || 'http://localhost:8000';
const PROV_EMAIL = process.argv[3];

if (!PROV_EMAIL) {
    console.error('사용법: node scripts/verify-profiles-lockdown.cjs <BASE_URL> <예비멤버이메일>');
    process.exit(2);
}

const results = [];
function check(name, pass, detail) {
    results.push({ name, pass, detail });
    console.log(`${pass ? '  ✅' : '  ❌'} ${name}${detail ? ' — ' + detail : ''}`);
}

(async () => {
    const browser = await puppeteer.launch({ headless: 'new' });
    const page = await browser.newPage();
    await page.setViewport({ width: 1280, height: 1000 });

    const denied = [];
    page.on('console', m => {
        const t = m.text();
        if (/permission denied|42501/i.test(t)) denied.push(t);
    });

    // ---------- 1) 게시판 글쓴이 이름 (비로그인) ----------
    console.log('\n[1] 게시판 글쓴이 이름 — 비로그인');
    await page.goto(BASE + '/speakup.html', { waitUntil: 'networkidle2' });
    await page.waitForSelector('.post-card, .admin-loading, .admin-empty', { timeout: 20000 }).catch(() => {});
    await new Promise(r => setTimeout(r, 3000));

    const authors = await page.evaluate(() =>
        Array.from(document.querySelectorAll('.post-card'))
            .map(c => {
                const el = c.querySelector('.post-author');
                return el ? el.textContent.trim() : '';
            })
            .filter(Boolean)
    );
    // speakup.js 는 profiles 조인이 비면 '알 수 없음' 으로 폴백한다 — 그게 바로
    // 컬럼 권한 회수가 게시판을 깨뜨렸을 때 나타나는 증상이므로 별도로 잡는다.
    const unknown = authors.filter(a => a === '알 수 없음').length;
    check('글쓴이 이름이 렌더링됨', authors.length > 0,
        authors.length ? `${authors.length}건 (예: ${authors[0]})` : '한 건도 안 보임');
    check("'알 수 없음' 폴백이 아님", authors.length > 0 && unknown === 0,
        unknown ? `${unknown}/${authors.length} 건이 '알 수 없음' — profiles 조인 실패` : '전부 실명 표시');

    // ---------- 2) 가입 모달: 예비멤버 안내 ----------
    console.log('\n[2] 가입 모달 — 예비멤버 이메일');
    await page.goto(BASE + '/index.html', { waitUntil: 'networkidle2' });
    await page.waitForSelector('[data-open-modal="signup"]', { timeout: 20000 });
    await page.click('[data-open-modal="signup"]');
    await page.waitForSelector('#s-email', { visible: true, timeout: 10000 });

    await page.click('#s-email');
    await page.type('#s-email', PROV_EMAIL, { delay: 25 });
    await page.evaluate(() => document.getElementById('s-email').blur());
    await new Promise(r => setTimeout(r, 3500));

    const provState = await page.evaluate(() => {
        const el = document.getElementById('provisional-notice');
        const nameEl = document.getElementById('s-name');
        return {
            visible: !!el && el.style.display !== 'none' && el.offsetParent !== null,
            text: el ? el.textContent.trim() : '',
            checking: !!el && el.classList.contains('is-checking'),
            namePrefilled: nameEl ? nameEl.value.trim() : '',
            phonePrefilled: (document.getElementById('s-contact') || {}).value || ''
        };
    });
    check('예비멤버 안내가 표시됨', provState.visible && /예비 멤버로 등록/.test(provState.text),
        provState.text.slice(0, 60) || '(안내 없음)');
    check('"확인 중" 상태로 멈춰있지 않음', !provState.checking);
    check('이름 자동입력 동작', !!provState.namePrefilled, provState.namePrefilled || '(비어있음)');
    check('전화번호는 자동입력되지 않음 (의도된 제거)', provState.phonePrefilled === '',
        provState.phonePrefilled ? '값이 채워짐 — 노출 잔존!' : '비어있음');

    // ---------- 3) 일반 이메일에는 안내 없음 ----------
    console.log('\n[3] 가입 모달 — 예비멤버가 아닌 이메일');
    await page.evaluate(() => {
        const e = document.getElementById('s-email');
        e.value = ''; e.dispatchEvent(new Event('input', { bubbles: true }));
        const n = document.getElementById('s-name'); if (n) n.value = '';
    });
    await page.click('#s-email');
    await page.type('#s-email', 'nobody-xyz-999@example.com', { delay: 25 });
    await page.evaluate(() => document.getElementById('s-email').blur());
    await new Promise(r => setTimeout(r, 3500));

    const negState = await page.evaluate(() => {
        const el = document.getElementById('provisional-notice');
        return { visible: !!el && el.style.display !== 'none' && el.offsetParent !== null,
                 text: el ? el.textContent.trim() : '' };
    });
    check('일반 이메일에는 안내가 뜨지 않음', !negState.visible, negState.text.slice(0, 40));

    // ---------- 4) 권한 오류 로그 ----------
    console.log('\n[4] 콘솔 권한 오류');
    check('permission denied / 42501 없음', denied.length === 0,
        denied.length ? denied[0].slice(0, 120) : '깨끗함');

    await browser.close();

    const failed = results.filter(r => !r.pass);
    console.log(`\n===== 결과: ${results.length - failed.length}/${results.length} 통과 =====`);
    if (failed.length) {
        console.log('실패 항목:');
        failed.forEach(f => console.log('  · ' + f.name + (f.detail ? ' — ' + f.detail : '')));
    }
    process.exit(failed.length ? 1 : 0);
})().catch(e => { console.error('검증 스크립트 오류:', e); process.exit(3); });
