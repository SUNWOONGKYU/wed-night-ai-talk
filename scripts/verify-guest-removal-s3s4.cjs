// S3, S4 재검증 — 슬롯 명단 전체 텍스트와 S4 PASS 로직 보정
const path = require('path');
const puppeteer = require(path.join(process.env.APPDATA, 'npm', 'node_modules', 'puppeteer'));

const TMP = 'G:/내 드라이브/WAAT/tmp';
const ORIGIN = 'https://waat.community';

(async () => {
    const browser = await puppeteer.launch({ headless: 'new' });
    const page = await browser.newPage();
    await page.setCacheEnabled(false);
    await page.setViewport({ width: 1280, height: 1200 });

    const URL = `${ORIGIN}/?_=` + Date.now();
    console.log('navigate', URL);
    await page.goto(URL, { waitUntil: 'networkidle2', timeout: 60000 });

    // 데이터 로드 대기
    await new Promise(r => setTimeout(r, 4000));

    // schedule 영역 스크롤 후 다시 한번 대기 (lazy render 가능)
    await page.evaluate(() => {
        const el = document.getElementById('schedule');
        if (el) el.scrollIntoView({ behavior: 'instant', block: 'start' });
    });
    await new Promise(r => setTimeout(r, 2000));

    // 모든 슬롯의 명단 텍스트 추출
    const slotDetails = await page.evaluate(() => {
        // 가능한 모든 슬롯 컨테이너
        const sections = Array.from(document.querySelectorAll('#schedule *')).filter(el => {
            const t = el.innerText || '';
            return t.length > 0 && t.length < 2000;
        });
        // 슬롯 카운트 표기 패턴
        const bodyAll = document.body.innerText;
        const lines = bodyAll.split('\n').map(s => s.trim()).filter(Boolean);

        // 게스트 이름 직접 검색
        const guestNamePatterns = [
            'Sang yeong', 'Sang Yeong', 'sang yeong', 'sangyeong',
            '도치', '도치60'
        ];
        const found = {};
        guestNamePatterns.forEach(p => {
            found[p] = bodyAll.includes(p);
        });

        // 슬롯별 명단을 찾기 위해 DOM에서 attendee 관련 클래스 검색
        const attendeeEls = Array.from(document.querySelectorAll('[class*="attend"], [class*="participant"], [class*="member"], [class*="guest"], [data-attendee]'));
        const attendeeTexts = attendeeEls.slice(0, 30).map(el => ({
            tag: el.tagName,
            cls: el.className,
            text: (el.innerText || '').slice(0, 100)
        }));

        // 5회 모임 (달빛) 부근 텍스트 추출
        const idx5 = bodyAll.indexOf('5회');
        const around5 = idx5 >= 0 ? bodyAll.slice(idx5, idx5 + 500) : null;
        const idxMoon = bodyAll.indexOf('달빛');
        const aroundMoon = idxMoon >= 0 ? bodyAll.slice(idxMoon, idxMoon + 500) : null;

        return {
            totalBodyLength: bodyAll.length,
            allLines: lines,
            guestNamesFound: found,
            attendeeElsCount: attendeeEls.length,
            attendeeTexts: attendeeTexts.slice(0, 10),
            around5,
            aroundMoon,
        };
    });

    console.log('=== S3 슬롯 상세 ===');
    console.log('totalBodyLength:', slotDetails.totalBodyLength);
    console.log('guestNamesFound:', slotDetails.guestNamesFound);
    console.log('attendeeElsCount:', slotDetails.attendeeElsCount);
    console.log('attendeeTexts (sample):', slotDetails.attendeeTexts);
    console.log('around5 (snippet):', slotDetails.around5 ? slotDetails.around5.slice(0, 300) : null);
    console.log('aroundMoon (snippet):', slotDetails.aroundMoon ? slotDetails.aroundMoon.slice(0, 300) : null);
    console.log('\nAll lines:');
    slotDetails.allLines.forEach((l, i) => console.log(' [', i, ']', l));

    await page.screenshot({ path: path.join(TMP, 'guest_removal_S3_recheck.png'), fullPage: true });

    await browser.close();
})().catch(e => { console.error('FATAL:', e); process.exit(1); });
