// 배포 사이트에서 모임별 슬롯 신청자 명단 확인
const path = require('path');
const puppeteer = require(path.join(process.env.APPDATA, 'npm', 'node_modules', 'puppeteer'));

const URL = 'https://wed-night-ai-talk.vercel.app/';

(async () => {
    const browser = await puppeteer.launch({ headless: 'new' });
    const page = await browser.newPage();
    await page.setViewport({ width: 1280, height: 1400, deviceScaleFactor: 1 });
    await page.goto(URL, { waitUntil: 'networkidle2' });
    await page.waitForSelector('.waat-slot-time, .slot-attendees, .admin-loading', { timeout: 15000 }).catch(() => {});
    await new Promise(r => setTimeout(r, 2500));

    const data = await page.evaluate(() => {
        const cards = Array.from(document.querySelectorAll('#events-container > *'));
        return cards.map(card => {
            const title = (card.querySelector('.info-value, h3, .event-title') || {}).textContent || card.textContent.slice(0, 30);
            const slots = Array.from(card.querySelectorAll('.slot-attendees')).map(s => {
                const label = (s.querySelector('.slot-attendees-label') || {}).textContent || '';
                const names = Array.from(s.querySelectorAll('.attendee-tag')).map(t => t.textContent.trim());
                return label + ' → ' + (names.join(', ') || '(없음)');
            });
            return { title: title.trim().slice(0, 40), slots };
        });
    });

    console.log('=== 모임별 슬롯 신청자 ===');
    data.forEach(d => {
        console.log('\n[' + d.title + ']');
        d.slots.forEach(s => console.log('  ' + s));
    });

    await page.screenshot({ path: path.join(__dirname, '..', 'tmp', 'attendees_verify.png'), fullPage: true });
    await browser.close();
})().catch(e => { console.error(e); process.exit(1); });
