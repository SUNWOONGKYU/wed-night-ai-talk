// 이메일 수신거부 기능 — 실브라우저 검증
//
// curl 200 으로 판정하지 않는다. 실제로 페이지를 열고 버튼을 눌러 확인한다:
//   1) 유효한 토큰으로 열면 수신거부가 처리되고 마스킹된 주소가 보이는가
//   2) 같은 링크를 또 열면 '이미 수신거부 상태'로 사실대로 표시되는가
//   3) [다시 받을래요] 버튼을 실제로 눌러 재구독이 되는가
//   4) 토큰이 없거나 틀리면 오류 화면이 나오는가 (그리고 이유를 흘리지 않는가)
//   5) 페이지에서 토큰·이메일 원문이 노출되지 않는가
//
// 사용법: node scripts/verify-unsubscribe.cjs <BASE_URL> <테스트토큰>
const path = require('path');
const puppeteer = require(path.join(process.env.APPDATA, 'npm', 'node_modules', 'puppeteer'));

const BASE = process.argv[2] || 'http://localhost:8765';
const TOKEN = process.argv[3];
if (!TOKEN) {
    console.error('사용법: node scripts/verify-unsubscribe.cjs <BASE_URL> <테스트토큰>');
    process.exit(2);
}

const results = [];
function check(name, pass, detail) {
    results.push({ name, pass, detail });
    console.log(`${pass ? '  OK  ' : '  FAIL'} ${name}${detail ? ' — ' + detail : ''}`);
}

async function state(page) {
    return page.evaluate(() => {
        const vis = id => {
            const el = document.getElementById(id);
            return !!el && !el.classList.contains('unsub-hidden');
        };
        return {
            loading: vis('unsub-loading'),
            done: vis('unsub-done'),
            resubbed: vis('unsub-resubbed'),
            error: vis('unsub-error'),
            title: (document.getElementById('unsub-done-title') || {}).textContent || '',
            email: (document.getElementById('unsub-email') || {}).textContent || '',
            resubEmail: (document.getElementById('unsub-resub-email') || {}).textContent || '',
            bodyText: document.body.innerText
        };
    });
}

(async () => {
    const browser = await puppeteer.launch({ headless: 'new' });
    const page = await browser.newPage();
    await page.setViewport({ width: 900, height: 1000 });
    const pageErrors = [];
    page.on('pageerror', e => pageErrors.push(String(e.message || e)));

    const open = async (q) => {
        await page.goto(BASE + '/unsubscribe.html' + q, { waitUntil: 'networkidle2', timeout: 45000 });
        await new Promise(r => setTimeout(r, 2500));
        return state(page);
    };

    // ---------- 1) 유효한 토큰 → 수신거부 ----------
    console.log('\n[1] 유효한 토큰으로 접속');
    let s = await open('?t=' + TOKEN);
    check('수신거부 완료 화면 표시', s.done && !s.error && !s.loading,
        s.error ? '오류 화면' : (s.loading ? '로딩에서 멈춤' : s.title));
    check('마스킹된 주소 표시', /\*/.test(s.email), s.email || '(비어있음)');
    check('주소 원문이 노출되지 않음', !/unsub-test@example\.com/.test(s.bodyText),
        /unsub-test@example\.com/.test(s.bodyText) ? '원문 노출!' : '마스킹됨');

    // ---------- 2) 같은 링크 재접속 → '이미' 표시 ----------
    console.log('\n[2] 같은 링크로 다시 접속');
    s = await open('?t=' + TOKEN);
    check('이미 수신거부 상태로 안내', s.done && /이미/.test(s.title), s.title);

    // ---------- 3) 재구독 버튼 실제 클릭 ----------
    console.log('\n[3] [다시 받을래요] 버튼 클릭');
    await page.click('#unsub-resub-btn');
    await new Promise(r => setTimeout(r, 2500));
    s = await state(page);
    check('재구독 완료 화면으로 전환', s.resubbed && !s.done, s.resubbed ? '전환됨' : '전환 안 됨');
    check('재구독 화면에도 마스킹 주소', /\*/.test(s.resubEmail), s.resubEmail || '(비어있음)');

    // ---------- 4) 잘못된 토큰 / 토큰 없음 ----------
    console.log('\n[4] 잘못된 토큰 · 토큰 없음');
    s = await open('?t=00000000-0000-0000-0000-000000000000');
    check('없는 토큰 → 오류 화면', s.error, s.error ? '오류 화면' : '통과됨(문제!)');
    check('없는 토큰에 이유를 흘리지 않음', !/수신거부 처리/.test(s.bodyText));

    s = await open('');
    check('토큰 없음 → 오류 화면', s.error);

    s = await open('?t=not-a-uuid');
    check('형식이 틀린 토큰 → 오류 화면', s.error);

    // ---------- 5) JS 에러 ----------
    console.log('\n[5] JS 에러');
    check('페이지 JS 에러 없음', pageErrors.length === 0, pageErrors[0] || '없음');

    await browser.close();
    const failed = results.filter(r => !r.pass);
    console.log(`\n===== 결과: ${results.length - failed.length}/${results.length} 통과 =====`);
    if (failed.length) { console.log('실패 항목:'); failed.forEach(f => console.log('  · ' + f.name + (f.detail ? ' — ' + f.detail : ''))); }
    process.exit(failed.length ? 1 : 0);
})().catch(e => { console.error('검증 스크립트 오류:', e); process.exit(3); });
