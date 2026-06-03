// 비회원 셀프 취소 기능 배포 검증
// 1) 메인에서 진입 링크 보이는지
// 2) 클릭 → 모달 뜨는지
// 3) 가짜 데이터로 검색 시 '내역 없음' 메시지 뜨는지
const path = require('path');
const puppeteer = require(path.join(process.env.APPDATA, 'npm', 'node_modules', 'puppeteer'));

(async () => {
    const browser = await puppeteer.launch({ headless: 'new' });
    const page = await browser.newPage();
    await page.setViewport({ width: 1280, height: 900 });

    const URL = 'https://waat.community/?_=' + Date.now();
    console.log('[verify] navigating', URL);
    await page.goto(URL, { waitUntil: 'networkidle2', timeout: 60000 });

    // 모임 일정 섹션 스크롤
    await page.evaluate(() => {
        const el = document.getElementById('schedule');
        if (el) el.scrollIntoView({ behavior: 'instant', block: 'start' });
    });
    await new Promise(r => setTimeout(r, 1500));

    // 진입 링크 존재 확인
    const linkExists = await page.evaluate(() => {
        const a = document.getElementById('guest-cancel-open-btn');
        return a ? { text: a.textContent.trim(), visible: a.offsetParent !== null } : null;
    });
    console.log('[1] 진입 링크:', linkExists);

    await page.screenshot({ path: path.join('tmp', 'guest_cancel_entry.png'), fullPage: false });

    // 링크 클릭 → 모달 열림
    await page.click('#guest-cancel-open-btn');
    await new Promise(r => setTimeout(r, 700));

    const modalOpen = await page.evaluate(() => {
        const m = document.getElementById('guest-cancel-modal');
        return m && m.classList.contains('open');
    });
    console.log('[2] 모달 열림:', modalOpen);

    await page.screenshot({ path: path.join('tmp', 'guest_cancel_modal.png'), fullPage: false });

    // 가짜 데이터로 검색 — 없는 사람
    await page.type('#gc-name', '_테스트유저_xxx', { delay: 30 });
    await page.type('#gc-phone', '[masked-phone]', { delay: 30 });
    await page.click('#gc-search-btn');
    await new Promise(r => setTimeout(r, 2500));

    const result = await page.evaluate(() => {
        const r = document.getElementById('gc-results');
        const status = document.getElementById('gc-status');
        return {
            results_html: r ? r.innerHTML.slice(0, 200) : null,
            results_visible: r && r.style.display !== 'none',
            status_text: status ? status.textContent : null,
            status_class: status ? status.className : null
        };
    });
    console.log('[3] 검색 결과 (가짜 데이터):', result);

    await page.screenshot({ path: path.join('tmp', 'guest_cancel_search.png'), fullPage: false });

    await browser.close();
    console.log('\n=== 스크린샷 ===');
    console.log('tmp/guest_cancel_entry.png');
    console.log('tmp/guest_cancel_modal.png');
    console.log('tmp/guest_cancel_search.png');
})().catch(e => { console.error(e); process.exit(1); });
