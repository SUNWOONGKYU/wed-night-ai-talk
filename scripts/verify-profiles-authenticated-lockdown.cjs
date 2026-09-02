// profiles authenticated 잠금(20260902080000) + 클라이언트 재배선 회귀 검증
//
// curl 200 만으로 판정하지 않는다 — 실제 브라우저에서 확인한다:
//   1) 메인 페이지가 JS 에러 없이 뜨는가 (getMyProfile 재배선이 로드를 깨지 않았는가)
//   2) 게시판 글쓴이 이름이 비로그인으로 보이는가 (컬럼 권한 (id,name) 유지 확인)
//   3) 신설 RPC 3종이 실제로 배포되어 있고, 권한 가드가 도는가
//   4) 제거한 죽은 함수가 정말 사라졌는가 (DB 객체 표면 확인)
//   5) 콘솔에 예기치 않은 permission denied 가 없는가
//
// ⚠️ 로그인 경로(본인 프로필 조회·수정, 관리자 회원목록·신청자명단)는 자격증명이
//    필요해 이 스크립트로 검증할 수 없다. PO 가 직접 확인해야 한다.
//
// 사용법:  node scripts/verify-profiles-authenticated-lockdown.cjs [BASE_URL]
const path = require('path');
const puppeteer = require(path.join(process.env.APPDATA, 'npm', 'node_modules', 'puppeteer'));

const BASE = process.argv[2] || 'http://localhost:8765';

const results = [];
function check(name, pass, detail) {
    results.push({ name, pass, detail });
    console.log(`${pass ? '  OK  ' : '  FAIL'} ${name}${detail ? ' — ' + detail : ''}`);
}

(async () => {
    const browser = await puppeteer.launch({ headless: 'new' });
    const page = await browser.newPage();
    await page.setViewport({ width: 1280, height: 1000 });

    const denied = [], pageErrors = [];
    page.on('console', m => { if (/permission denied|42501/i.test(m.text())) denied.push(m.text()); });
    page.on('pageerror', e => pageErrors.push(String(e.message || e)));

    console.log(`\n[대상] ${BASE} (비로그인)`);

    // ---------- 1) 메인 페이지 ----------
    console.log('\n[1] 메인 페이지 로드');
    await page.goto(BASE + '/index.html', { waitUntil: 'networkidle2', timeout: 45000 });
    await new Promise(r => setTimeout(r, 3500));
    const main = await page.evaluate(() => ({
        cards: document.querySelectorAll('.schedule-card, .event-card').length,
        hasDB: typeof DB === 'object' && DB !== null,
        hasGetMy: typeof (DB || {}).getMyProfile === 'function',
        deadGone: ['getProfile', 'createProfile', 'getExistingEmails', 'getExistingMember']
            .filter(k => typeof (DB || {})[k] === 'function')
    }));
    check('모임 카드 렌더', main.cards > 0, `${main.cards}개`);
    check('DB.getMyProfile 존재', main.hasGetMy);
    check('죽은 함수 제거됨', main.deadGone.length === 0,
        main.deadGone.length ? '아직 남음: ' + main.deadGone.join(', ') : 'getProfile/createProfile/getExistingEmails/getExistingMember 모두 없음');

    // ---------- 2) 신설 RPC 존재 + 권한 가드 ----------
    console.log('\n[2] 신설 RPC (비로그인 = anon 으로 호출)');
    const rpc = await page.evaluate(async () => {
        const out = {};
        for (const [k, args] of [['get_my_profile', {}],
                                 ['admin_list_profiles', {}],
                                 ['admin_get_profiles', { p_ids: [] }]]) {
            const { data, error } = await _supabase.rpc(k, args);
            out[k] = error ? { err: error.code + ' ' + error.message } : { data: JSON.stringify(data).slice(0, 60) };
        }
        return out;
    });
    // anon 에게는 EXECUTE 를 주지 않았다 → 배포됐다면 '함수 없음(PGRST202)'이 아니라
    // 권한 거부(42501)가 나와야 한다. PGRST202 면 마이그레이션이 안 올라간 것이다.
    for (const k of Object.keys(rpc)) {
        const e = (rpc[k].err || '');
        const deployed = !/PGRST202/.test(e);
        check(`${k} 배포됨 (anon 은 거부)`, deployed && /42501|permission denied/i.test(e),
            e || rpc[k].data);
    }

    // ---------- 3) 게시판 글쓴이 이름 ----------
    console.log('\n[3] 게시판 글쓴이 이름 (비로그인)');
    await page.goto(BASE + '/speakup.html', { waitUntil: 'networkidle2', timeout: 45000 });
    await page.waitForSelector('.post-card, .admin-loading, .admin-empty', { timeout: 20000 }).catch(() => {});
    await new Promise(r => setTimeout(r, 3000));
    const authors = await page.evaluate(() =>
        Array.from(document.querySelectorAll('.post-card'))
            .map(c => { const el = c.querySelector('.post-author'); return el ? el.textContent.trim() : ''; })
            .filter(Boolean));
    const unknown = authors.filter(a => a === '알 수 없음').length;
    check('글쓴이 이름 렌더', authors.length > 0, authors.length ? `${authors.length}건 (예: ${authors[0]})` : '없음');
    check("'알 수 없음' 폴백 아님", authors.length > 0 && unknown === 0,
        unknown ? `${unknown}/${authors.length}건 폴백 — profiles 조인 실패` : '전부 실명');

    // ---------- 4) 익명이 이메일·전화를 못 읽는가 ----------
    console.log('\n[4] 익명 직접조회 차단 유지');
    const direct = await page.evaluate(async () => {
        const r = {};
        for (const cols of ['*', 'email', 'phone', 'id,name']) {
            const { data, error } = await _supabase.from('profiles').select(cols).limit(1);
            r[cols] = error ? ('BLOCKED ' + error.code) : ('OK ' + JSON.stringify(data).slice(0, 40));
        }
        return r;
    });
    check('profiles.* 차단', /BLOCKED/.test(direct['*']), direct['*']);
    check('profiles.email 차단', /BLOCKED/.test(direct.email), direct.email);
    check('profiles.phone 차단', /BLOCKED/.test(direct.phone), direct.phone);
    check('profiles(id,name) 은 허용', /^OK/.test(direct['id,name']), direct['id,name']);

    // ---------- 5) 에러 로그 ----------
    console.log('\n[5] 콘솔·JS 에러');
    const real = denied.filter(t => !/profiles|admin_list_profiles|admin_get_profiles|get_my_profile/.test(t));
    check('예기치 않은 permission denied 없음', real.length === 0, real[0] || '깨끗함');
    check('페이지 JS 에러 없음', pageErrors.length === 0, pageErrors[0] || '없음');

    await browser.close();
    const failed = results.filter(r => !r.pass);
    console.log(`\n===== 결과: ${results.length - failed.length}/${results.length} 통과 =====`);
    if (failed.length) { console.log('실패 항목:'); failed.forEach(f => console.log('  · ' + f.name + (f.detail ? ' — ' + f.detail : ''))); }
    process.exit(failed.length ? 1 : 0);
})().catch(e => { console.error('검증 스크립트 오류:', e); process.exit(3); });
