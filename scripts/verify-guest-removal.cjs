// 게스트 신청 제거 작업 검증 — 5개 시나리오
// S1: 비로그인 슬롯 클릭 → signup 모달
// S2: HTML/JS 잔재 0건 정적 검증
// S3: 기존 게스트 데이터 보존
// S4: 게스트 셀프 취소 진입
// S5: 슬롯 카드 시각 정상

const path = require('path');
const fs = require('fs');
const https = require('https');
const puppeteer = require(path.join(process.env.APPDATA, 'npm', 'node_modules', 'puppeteer'));

const TMP = 'G:/내 드라이브/WAAT/tmp';
const ORIGIN = 'https://waat.community';

function fetchText(url) {
    return new Promise((resolve, reject) => {
        https.get(url, (res) => {
            let data = '';
            res.on('data', (c) => data += c);
            res.on('end', () => resolve({ status: res.statusCode, body: data }));
        }).on('error', reject);
    });
}

function countOccurrences(haystack, needle) {
    if (!haystack) return 0;
    return haystack.split(needle).length - 1;
}

(async () => {
    const results = {
        S1: { name: '비로그인 슬롯 클릭 → signup 모달', pass: null, detail: {} },
        S2: { name: 'HTML/JS 잔재 0건', pass: null, detail: {} },
        S3: { name: '기존 게스트 데이터 보존', pass: null, detail: {} },
        S4: { name: '게스트 셀프 취소 진입', pass: null, detail: {} },
        S5: { name: '슬롯 카드 시각 정상', pass: null, detail: {} },
    };

    // ─────────────────────────────────────────────────────
    // S2: 정적 검증 (먼저 실행 — 빠르게 끝남)
    // ─────────────────────────────────────────────────────
    console.log('\n=== S2: 정적 검증 (HTML/JS 잔재) ===');
    try {
        const cacheBust = '?_=' + Date.now();
        const home = await fetchText(`${ORIGIN}/${cacheBust}`);
        const mainJs = await fetchText(`${ORIGIN}/js/main.js?v=20260604a&_=${Date.now()}`);
        const supJs = await fetchText(`${ORIGIN}/js/supabase-config.js?v=20260604a&_=${Date.now()}`);

        const homeChecks = {
            'identity-choice-modal in HTML': countOccurrences(home.body, 'identity-choice-modal'),
            'guest-attend-modal in HTML': countOccurrences(home.body, 'guest-attend-modal'),
        };
        const mainChecks = {
            'showIdentityChoiceModal in main.js': countOccurrences(mainJs.body, 'showIdentityChoiceModal'),
            'createGuestAttendance in main.js': countOccurrences(mainJs.body, 'createGuestAttendance'),
            'guest-attend-modal in main.js': countOccurrences(mainJs.body, 'guest-attend-modal'),
        };
        const supChecks = {
            'createGuestAttendance in supabase-config.js': countOccurrences(supJs.body, 'createGuestAttendance'),
            // 유지돼야 하는 것들 (참고로 표시)
            'deleteGuestAttendance (should stay)': countOccurrences(supJs.body, 'deleteGuestAttendance'),
            'findGuestAttendances (should stay)': countOccurrences(supJs.body, 'findGuestAttendances'),
            'cancelGuestAttendanceByOwner (should stay)': countOccurrences(supJs.body, 'cancelGuestAttendanceByOwner'),
        };

        console.log('HTML checks:', homeChecks);
        console.log('main.js checks:', mainChecks);
        console.log('supabase-config.js checks:', supChecks);

        const mustBeZero = [
            homeChecks['identity-choice-modal in HTML'],
            homeChecks['guest-attend-modal in HTML'],
            mainChecks['showIdentityChoiceModal in main.js'],
            mainChecks['createGuestAttendance in main.js'],
            mainChecks['guest-attend-modal in main.js'],
            supChecks['createGuestAttendance in supabase-config.js'],
        ];
        const mustStayNonZero = [
            supChecks['deleteGuestAttendance (should stay)'],
            supChecks['findGuestAttendances (should stay)'],
            supChecks['cancelGuestAttendanceByOwner (should stay)'],
        ];

        const allZero = mustBeZero.every(n => n === 0);
        const allKept = mustStayNonZero.every(n => n > 0);
        results.S2.pass = allZero && allKept;
        results.S2.detail = { homeChecks, mainChecks, supChecks, allZero, allKept };
    } catch (e) {
        results.S2.pass = false;
        results.S2.detail.error = String(e);
    }

    // ─────────────────────────────────────────────────────
    // Puppeteer 세션 시작
    // ─────────────────────────────────────────────────────
    const browser = await puppeteer.launch({ headless: 'new' });
    const page = await browser.newPage();
    await page.setCacheEnabled(false);
    await page.setViewport({ width: 1280, height: 900 });

    const consoleErrors = [];
    page.on('pageerror', e => consoleErrors.push(String(e)));
    page.on('console', msg => {
        if (msg.type() === 'error') consoleErrors.push(msg.text());
    });

    const URL = `${ORIGIN}/?_=` + Date.now();
    console.log('\n=== Puppeteer navigate ===', URL);
    await page.goto(URL, { waitUntil: 'networkidle2', timeout: 60000 });
    await new Promise(r => setTimeout(r, 1500));

    // ─────────────────────────────────────────────────────
    // S5: 슬롯 카드 시각 정상 (S1 클릭 전에 캡처)
    // ─────────────────────────────────────────────────────
    console.log('\n=== S5: 슬롯 카드 시각 정상 ===');
    try {
        await page.evaluate(() => {
            const el = document.getElementById('schedule');
            if (el) el.scrollIntoView({ behavior: 'instant', block: 'start' });
        });
        await new Promise(r => setTimeout(r, 1000));

        const slotInfo = await page.evaluate(() => {
            const cards = Array.from(document.querySelectorAll('.slot-card, .schedule-slot, [data-slot-id]'));
            const buttons = Array.from(document.querySelectorAll('button')).filter(b => /신청하기/.test(b.textContent));
            return {
                slotCardCount: cards.length,
                applyButtonCount: buttons.length,
                applyButtonTexts: buttons.slice(0, 4).map(b => b.textContent.trim()),
                scheduleSectionExists: !!document.getElementById('schedule'),
            };
        });
        console.log('slotInfo:', slotInfo);
        await page.screenshot({ path: path.join(TMP, 'guest_removal_S5_slots.png'), fullPage: false });
        results.S5.pass = slotInfo.scheduleSectionExists && slotInfo.applyButtonCount >= 1;
        results.S5.detail = slotInfo;
    } catch (e) {
        results.S5.pass = false;
        results.S5.detail.error = String(e);
    }

    // ─────────────────────────────────────────────────────
    // S3: 기존 게스트 데이터 보존
    // ─────────────────────────────────────────────────────
    console.log('\n=== S3: 기존 게스트 데이터 보존 ===');
    try {
        const guestData = await page.evaluate(() => {
            // 페이지 전체 텍스트에서 게스트 이름 검색
            const body = document.body.innerText;
            // 카운트 패턴 (N/15명 등)
            const counts = (body.match(/\d+\/\d+\s*명/g) || []).slice(0, 10);
            // 게스트 이름 후보
            const sangYeong = /Sang\s*yeong/i.test(body);
            const dochi = /도치60|도치/i.test(body);
            // 모임5/달빛 부근 텍스트
            const has5th = /제5회|5회/.test(body);
            const hasMoonlight = /달빛/.test(body);
            return { counts, sangYeong, dochi, has5th, hasMoonlight, bodyLength: body.length };
        });
        console.log('guestData:', guestData);
        await page.screenshot({ path: path.join(TMP, 'guest_removal_S3_data.png'), fullPage: true });

        // 최소 조건: 슬롯 카운트 한 개라도 보이고 + 게스트 이름 중 하나는 보여야 함
        results.S3.pass = guestData.counts.length > 0 && (guestData.sangYeong || guestData.dochi);
        results.S3.detail = guestData;
    } catch (e) {
        results.S3.pass = false;
        results.S3.detail.error = String(e);
    }

    // ─────────────────────────────────────────────────────
    // S1: 비로그인 슬롯 클릭 → signup 모달
    // ─────────────────────────────────────────────────────
    console.log('\n=== S1: 비로그인 슬롯 클릭 → signup 모달 ===');
    try {
        // schedule 영역으로 다시 스크롤
        await page.evaluate(() => {
            const el = document.getElementById('schedule');
            if (el) el.scrollIntoView({ behavior: 'instant', block: 'start' });
        });
        await new Promise(r => setTimeout(r, 800));

        // 첫 "신청하기" 버튼 찾기 (data-action="apply" 또는 텍스트 매칭)
        const clickResult = await page.evaluate(() => {
            const buttons = Array.from(document.querySelectorAll('button, a')).filter(b => /신청하기/.test(b.textContent) && !/취소/.test(b.textContent));
            if (buttons.length === 0) return { clicked: false, reason: 'no_apply_button' };
            const btn = buttons[0];
            btn.scrollIntoView({ behavior: 'instant', block: 'center' });
            btn.click();
            return { clicked: true, text: btn.textContent.trim(), tag: btn.tagName };
        });
        console.log('apply button click:', clickResult);
        await new Promise(r => setTimeout(r, 1500));

        const modalState = await page.evaluate(() => {
            const auth = document.getElementById('auth-modal');
            const identity = document.getElementById('identity-choice-modal');
            const guestAttend = document.getElementById('guest-attend-modal');
            const signupForm = document.getElementById('signup-form');

            // 모달 'open' 클래스 또는 display 확인
            const isOpen = (el) => {
                if (!el) return false;
                const style = window.getComputedStyle(el);
                return el.classList.contains('open') || (style.display !== 'none' && style.visibility !== 'hidden');
            };
            const signupVisible = signupForm && window.getComputedStyle(signupForm).display !== 'none';

            // 현재 활성 탭 확인
            const activeTab = document.querySelector('.auth-tab.active, [data-tab].active');

            return {
                authModalExists: !!auth,
                authModalOpen: isOpen(auth),
                identityModalExists: !!identity,
                identityModalOpen: isOpen(identity),
                guestAttendModalExists: !!guestAttend,
                guestAttendModalOpen: isOpen(guestAttend),
                signupFormExists: !!signupForm,
                signupFormVisible: !!signupVisible,
                activeTabText: activeTab ? activeTab.textContent.trim() : null,
                activeTabData: activeTab ? activeTab.getAttribute('data-tab') : null,
            };
        });
        console.log('modalState:', modalState);
        await page.screenshot({ path: path.join(TMP, 'guest_removal_S1_modal.png'), fullPage: false });

        // PASS 조건:
        // - auth-modal 열림 + signup-form 보임
        // - identity-choice-modal NOT open
        // - guest-attend-modal NOT open
        const pass = modalState.authModalOpen
            && modalState.signupFormVisible
            && !modalState.identityModalOpen
            && !modalState.guestAttendModalOpen;
        results.S1.pass = pass;
        results.S1.detail = { ...clickResult, ...modalState };

        // 모달 닫기 (다음 시나리오를 위해)
        await page.evaluate(() => {
            const m = document.getElementById('auth-modal');
            if (m) m.classList.remove('open');
            document.querySelectorAll('.modal-overlay, .modal').forEach(el => {
                el.classList.remove('open', 'show', 'active');
            });
        });
        await new Promise(r => setTimeout(r, 500));
    } catch (e) {
        results.S1.pass = false;
        results.S1.detail.error = String(e);
    }

    // ─────────────────────────────────────────────────────
    // S4: 게스트 셀프 취소 진입
    // ─────────────────────────────────────────────────────
    console.log('\n=== S4: 게스트 셀프 취소 진입 ===');
    try {
        // 페이지 새로고침으로 상태 클리어
        await page.goto(`${ORIGIN}/?_=` + Date.now(), { waitUntil: 'networkidle2', timeout: 60000 });
        await new Promise(r => setTimeout(r, 1500));

        await page.evaluate(() => {
            const el = document.getElementById('schedule');
            if (el) el.scrollIntoView({ behavior: 'instant', block: 'start' });
        });
        await new Promise(r => setTimeout(r, 1000));

        // 취소 진입 링크 찾기
        const cancelBtn = await page.evaluate(() => {
            const a = document.getElementById('guest-cancel-open-btn');
            if (a) {
                a.scrollIntoView({ behavior: 'instant', block: 'center' });
                return { found: true, id: 'guest-cancel-open-btn', text: a.textContent.trim() };
            }
            // 텍스트로 찾기
            const els = Array.from(document.querySelectorAll('button, a')).filter(b => /비회원.*취소|취소하기/.test(b.textContent));
            if (els.length > 0) {
                els[0].scrollIntoView({ behavior: 'instant', block: 'center' });
                return { found: true, id: els[0].id || null, text: els[0].textContent.trim() };
            }
            return { found: false };
        });
        console.log('cancelBtn:', cancelBtn);

        if (cancelBtn.found) {
            await page.click('#guest-cancel-open-btn').catch(async () => {
                await page.evaluate(() => {
                    const els = Array.from(document.querySelectorAll('button, a')).filter(b => /비회원.*취소|취소하기/.test(b.textContent));
                    if (els[0]) els[0].click();
                });
            });
            await new Promise(r => setTimeout(r, 800));

            const modalOpen = await page.evaluate(() => {
                const m = document.getElementById('guest-cancel-modal');
                if (!m) return { exists: false };
                return {
                    exists: true,
                    open: m.classList.contains('open'),
                    nameInput: !!document.getElementById('gc-name'),
                    phoneInput: !!document.getElementById('gc-phone'),
                    searchBtn: !!document.getElementById('gc-search-btn'),
                };
            });
            console.log('modalOpen:', modalOpen);
            await page.screenshot({ path: path.join(TMP, 'guest_removal_S4_modal.png'), fullPage: false });

            // 가짜 데이터 검색
            if (modalOpen.nameInput && modalOpen.phoneInput) {
                await page.type('#gc-name', '_없는유저_xxx', { delay: 30 });
                await page.type('#gc-phone', '[masked-phone]', { delay: 30 });
                await page.click('#gc-search-btn');
                await new Promise(r => setTimeout(r, 3000));

                const searchResult = await page.evaluate(() => {
                    const status = document.getElementById('gc-status');
                    const results = document.getElementById('gc-results');
                    return {
                        status_text: status ? status.textContent.trim() : null,
                        results_html_preview: results ? results.innerHTML.slice(0, 300) : null,
                    };
                });
                console.log('searchResult:', searchResult);
                await page.screenshot({ path: path.join(TMP, 'guest_removal_S4_search.png'), fullPage: false });

                // PASS 조건: 모달 열림 + 가짜 데이터 검색 시 '없습니다' 류 메시지
                const noResultMsg = searchResult.status_text && /없|찾을 수 없|내역|조회 결과/.test(searchResult.status_text);
                results.S4.pass = modalOpen.open && (noResultMsg || searchResult.results_html_preview === '');
                results.S4.detail = { cancelBtn, modalOpen, searchResult };
            } else {
                results.S4.pass = false;
                results.S4.detail = { cancelBtn, modalOpen, error: 'inputs not found' };
            }
        } else {
            results.S4.pass = false;
            results.S4.detail = { cancelBtn, error: 'cancel button not found' };
        }
    } catch (e) {
        results.S4.pass = false;
        results.S4.detail.error = String(e);
    }

    await browser.close();

    // ─────────────────────────────────────────────────────
    // 결과 출력
    // ─────────────────────────────────────────────────────
    console.log('\n\n========================================');
    console.log('  검증 결과 요약');
    console.log('========================================');
    for (const [key, r] of Object.entries(results)) {
        const mark = r.pass ? 'PASS' : 'FAIL';
        console.log(`[${mark}] ${key}: ${r.name}`);
    }
    console.log('\n=== 상세 ===');
    console.log(JSON.stringify(results, null, 2));
    console.log('\n=== 콘솔 에러 ===');
    console.log(consoleErrors.length === 0 ? '(none)' : consoleErrors.join('\n'));
    console.log('\n=== 스크린샷 ===');
    ['guest_removal_S5_slots.png', 'guest_removal_S3_data.png', 'guest_removal_S1_modal.png', 'guest_removal_S4_modal.png', 'guest_removal_S4_search.png'].forEach(f => {
        const p = path.join(TMP, f);
        console.log(' -', p, fs.existsSync(p) ? '(OK)' : '(MISSING)');
    });

    const allPass = Object.values(results).every(r => r.pass === true);
    process.exit(allPass ? 0 : 2);
})().catch(e => { console.error('FATAL:', e); process.exit(1); });
