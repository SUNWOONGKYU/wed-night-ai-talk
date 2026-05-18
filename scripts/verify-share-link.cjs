// 공유 링크 — 비로그인 방문자가 글을 바로 볼 수 있는지 검증
const path = require('path');
const puppeteer = require(path.join(process.env.APPDATA, 'npm', 'node_modules', 'puppeteer'));

const BASE = 'https://wed-night-ai-talk.vercel.app';

(async () => {
    const browser = await puppeteer.launch({ headless: 'new' });

    // 1) 먼저 존재하는 post id 하나 확보 (목록에서)
    const probe = await browser.newPage();
    await probe.goto(BASE + '/speakup.html', { waitUntil: 'networkidle2' });
    await new Promise(r => setTimeout(r, 3000));
    const ids = await probe.evaluate(() =>
        Array.from(document.querySelectorAll('[data-post-id]')).map(e => e.dataset.postId));
    console.log('목록의 post id:', ids.join(', ') || '(없음)');
    await probe.close();
    if (!ids.length) { console.log('글이 없어 검증 불가'); await browser.close(); return; }

    const testId = ids[ids.length - 1]; // 가장 아래(오래된) 글

    // 2) 비로그인 + 공유 링크로 접속
    const page = await browser.newPage();
    // 시크릿처럼 — 새 컨텍스트라 로그인 세션 없음
    await page.goto(BASE + '/speakup.html?post=' + testId, { waitUntil: 'networkidle2' });
    await new Promise(r => setTimeout(r, 3500));

    const result = await page.evaluate((tid) => {
        const card = document.querySelector('[data-post-id="' + tid + '"]');
        const loginPrompt = document.getElementById('post-login-prompt');
        const writeBtn = document.getElementById('post-write-btn-wrap');
        return {
            cardVisible: !!card,
            cardText: card ? card.textContent.replace(/\s+/g, ' ').trim().slice(0, 60) : null,
            loginPromptShown: loginPrompt ? getComputedStyle(loginPrompt).display !== 'none' : null,
            writeBtnShown: writeBtn ? getComputedStyle(writeBtn).display !== 'none' : null,
            highlighted: card ? card.classList.contains('post-highlighted') : false
        };
    }, testId);

    console.log('\n=== 비로그인 공유 링크 접속 (?post=' + testId + ') ===');
    console.log('공유된 글 카드 표시   :', result.cardVisible ? 'O' : 'X');
    console.log('글 내용 (앞 60자)     :', result.cardText);
    console.log('로그인 안내 표시 여부 :', result.loginPromptShown === false ? '숨김(정상)' : (result.loginPromptShown === true ? '보임(문제)' : 'N/A'));
    console.log('글쓰기 버튼 표시      :', result.writeBtnShown ? '보임' : '숨김(비로그인 정상)');

    await page.screenshot({ path: path.join(__dirname, '..', 'tmp', 'share_link_test.png'), fullPage: true });
    await browser.close();
    console.log('\nSaved share_link_test.png');
})().catch(e => { console.error(e); process.exit(1); });
