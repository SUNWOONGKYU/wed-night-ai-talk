// attendance 익명 직접조회 차단(20260902040000) 이후 UI 회귀 검증
//
// curl 200 만으로 판정하지 않는다 — 실제 브라우저에서 다음을 확인한다:
//   1) 모임 카드·슬롯이 정상 렌더되는가        (get_slot_counts 경로)
//   2) 신청자 명단 영역이 정상 동작하는가       (get_slot_attendees 경로)
//   3) 콘솔에 permission denied / 42501 이 없는가
//   4) 페이지 JS 에러가 없는가
//
// ⚠️ 이 스크립트는 '비로그인' 경로만 검증한다. 로그인 회원의 본인 신청 조회
//    (getMyAttendance)와 관리자 신청자 명단(getEventAttendees)은 자격증명이
//    필요해 여기서 다루지 않는다 — PO가 직접 확인해야 한다.
//
// 사용법:  node scripts/verify-attendance-lockdown.cjs [BASE_URL]
const path = require('path');
const puppeteer = require(path.join(process.env.APPDATA, 'npm', 'node_modules', 'puppeteer'));

const BASE = process.argv[2] || 'https://waat.community';

const results = [];
function check(name, pass, detail) {
    results.push({ name, pass, detail });
    console.log(`${pass ? '  OK  ' : '  FAIL'} ${name}${detail ? ' — ' + detail : ''}`);
}

(async () => {
    const browser = await puppeteer.launch({ headless: 'new' });
    const page = await browser.newPage();
    await page.setViewport({ width: 1280, height: 1200 });

    const denied = [];
    const pageErrors = [];
    page.on('console', m => {
        const t = m.text();
        if (/permission denied|42501/i.test(t)) denied.push(t);
    });
    page.on('pageerror', e => pageErrors.push(String(e.message || e)));

    console.log(`\n[대상] ${BASE} (비로그인)`);
    await page.goto(BASE + '/', { waitUntil: 'networkidle2', timeout: 45000 });
    await new Promise(r => setTimeout(r, 4000));

    // ---------- 1) 모임 카드 / 슬롯 렌더 ----------
    console.log('\n[1] 모임 일정 렌더');
    const sched = await page.evaluate(() => {
        const cards = document.querySelectorAll('.schedule-card, .event-card');
        const slots = document.querySelectorAll('.slot-card, .slot-item, [class*="slot"]');
        const body = document.body.innerText;
        return {
            cards: cards.length,
            slots: slots.length,
            hasLoadFail: /불러오지 못|로드 실패|일정을 불러/.test(body),
            sample: (document.querySelector('.schedule-card, .event-card') || {}).innerText || ''
        };
    });
    check('모임 카드가 렌더됨', sched.cards > 0, `${sched.cards}개`);
    check('슬롯 요소가 렌더됨', sched.slots > 0, `${sched.slots}개`);
    check('일정 로드 실패 문구 없음', !sched.hasLoadFail);

    // ---------- 2) 신청자 명단 경로 ----------
    console.log('\n[2] 신청자 명단 (get_slot_attendees RPC)');
    // 현재 활성 모임은 신청자가 0명일 수 있다. 그 경우 '명단이 비어있음'은 정상이며,
    // 판정은 "RPC 호출이 성공했는가"로 한다 — 페이지에서 직접 호출해 확인.
    const rpc = await page.evaluate(async () => {
        try {
            const { data, error } = await _supabase.rpc('get_slot_attendees', { p_event_id: 19 });
            if (error) return { ok: false, msg: error.message };
            return { ok: true, n: (data || []).length };
        } catch (e) { return { ok: false, msg: String(e) }; }
    });
    check('명단 RPC가 오류 없이 응답', rpc.ok, rpc.ok ? `${rpc.n}명` : rpc.msg);

    // ---------- 3) 테이블 직접조회가 실제로 막혔는가 (페이지 컨텍스트에서) ----------
    console.log('\n[3] attendance 직접조회 차단 확인');
    const direct = await page.evaluate(async () => {
        try {
            const { data, error } = await _supabase.from('attendance').select('*');
            if (error) return { blocked: true, code: error.code, msg: error.message };
            return { blocked: false, n: (data || []).length };
        } catch (e) { return { blocked: true, msg: String(e) }; }
    });
    check('익명 attendance 직접조회가 거부됨', direct.blocked === true,
        direct.blocked ? (direct.code || '') + ' ' + (direct.msg || '') : `${direct.n}행이 읽힘 — 차단 실패!`);

    // ---------- 4) 콘솔 / JS 에러 ----------
    console.log('\n[4] 콘솔·JS 에러');
    // 위 [3] 은 일부러 거부를 유발하므로 그 로그는 제외한다.
    const realDenied = denied.filter(t => !/from\(.attendance.\)/.test(t));
    check('예기치 않은 permission denied 없음', realDenied.length === 0,
        realDenied.length ? realDenied[0].slice(0, 140) : '깨끗함');
    check('페이지 JS 에러 없음', pageErrors.length === 0,
        pageErrors.length ? pageErrors[0].slice(0, 140) : '없음');

    await browser.close();

    const failed = results.filter(r => !r.pass);
    console.log(`\n===== 결과: ${results.length - failed.length}/${results.length} 통과 =====`);
    if (failed.length) {
        console.log('실패 항목:');
        failed.forEach(f => console.log('  · ' + f.name + (f.detail ? ' — ' + f.detail : '')));
    }
    process.exit(failed.length ? 1 : 0);
})().catch(e => { console.error('검증 스크립트 오류:', e); process.exit(3); });
