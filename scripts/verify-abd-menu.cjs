const { chromium } = require('playwright');

const baseUrl = process.env.WAAT_VERIFY_URL || 'http://127.0.0.1:8899';

function assert(condition, message) {
    if (!condition) throw new Error(message);
}

async function mockBackend(page, loggedIn, gateViews = false) {
    const session = loggedIn
        ? { user: { id: 'user-1', email: 'member@example.com' } }
        : null;
    await page.route('**/js/supabase-config.js*', async (route) => {
        await route.fulfill({
            contentType: 'application/javascript',
            body: `
                window.ADMIN_EMAILS = [];
                window.escapeHtml = function (value) { return String(value || ''); };
                window.__getPostsCalls = [];
                window.__viewCalls = [];
                ${gateViews ? `
                    var viewGateStyle = document.createElement('style');
                    viewGateStyle.id = 'verify-view-gate';
                    viewGateStyle.textContent = '.post-card { margin-top: 1200px !important; }';
                    document.head.appendChild(viewGateStyle);
                ` : ''}
                window.DB = {
                    getPosts: async function (limit, offset, category) {
                        window.__getPostsCalls.push([limit, offset, category]);
                        return [{
                            id: 101, user_id: 'author-1', title: 'AI Biz 검증 후보',
                            content: '시장성과 실행 가능성을 토론합니다.', category: category || 'AI 새 소식',
                            view_count: 6, created_at: new Date().toISOString(), image_urls: [],
                            profiles: { name: '운영자' }
                        }];
                    },
                    getProfile: async function () { return { name: '테스트 회원' }; },
                    getReactionCounts: async function () { return { likes: 2, dislikes: 1 }; },
                    getCommentCount: async function () { return 1; },
                    getMyReaction: async function () { return null; },
                    getComments: async function () { return [{
                        id: 501, post_id: 101, user_id: 'author-2', parent_id: null,
                        content: '검증 의견', created_at: new Date().toISOString(), profiles: { name: '토론자' }
                    }]; },
                    incrementViewCount: async function (postId) { window.__viewCalls.push(postId); },
                    upsertReaction: async function () {},
                    createComment: async function () {},
                    deleteComment: async function () {}
                };
                window.Auth = {
                    getSession: async function () { return ${JSON.stringify(session)}; },
                    getUser: async function () { return ${JSON.stringify(session ? session.user : null)}; },
                    onAuthStateChange: function () {},
                    signOut: async function () {}
                };
            `
        });
    });
    await page.route('https://cdn.jsdelivr.net/**', (route) => route.fulfill({
        contentType: 'application/javascript',
        body: ''
    }));
}

async function verifyLoggedOut(browser) {
    const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
    await mockBackend(page, false);
    await page.goto(baseUrl + '/speakup.html?category=AI%20Biz%20Daily');
    await page.waitForFunction(() => window.__getPostsCalls && window.__getPostsCalls.length > 0);

    assert(await page.locator('#post-login-prompt').isVisible(), '비로그인 안내가 보이지 않음');
    assert(!(await page.locator('#post-write-btn-wrap').isVisible()), '비로그인에게 글쓰기 버튼이 보임');
    assert(!(await page.locator('#post-form-wrap').isVisible()), '비로그인에게 글쓰기 폼이 보임');
    assert(await page.locator('#abd-membership-notice').isVisible(), 'ABD 회원 안내가 보이지 않음');
    assert((await page.locator('#abd-membership-notice').innerText()).includes('WAAT Community 멤버로 가입하면 AI Biz Daily를 이메일로 매일 자동으로 받아볼 수 있습니다.'), '멤버 자동 수신 안내 문구 불일치');
    assert(await page.locator('#abd-membership-signup').isVisible(), '비회원에게 WAAT 회원가입 버튼이 보이지 않음');
    assert((await page.locator('#abd-subscription-email').count()) === 0, 'ABD 화면에 별도 이메일 입력이 남아 있음');
    await page.locator('#abd-membership-signup').click();
    await page.locator('#auth-modal.open').waitFor();
    assert(await page.locator('#signup-form').isVisible(), 'WAAT 회원가입 버튼이 가입 폼을 열지 않음');
    await page.close();
}

async function verifyAbdLoggedIn(browser) {
    const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
    await mockBackend(page, true, true);
    await page.goto(baseUrl + '/index.html');
    const mainAbdMenu = page.locator('a[href="speakup.html?category=AI%20Biz%20Daily"]').first();
    assert(await mainAbdMenu.locator('.nav-ko').innerText() === '유망 AI Biz 발굴', '메인 화면 보조문구 불일치');
    await mainAbdMenu.click();
    await page.waitForFunction(() => window.__getPostsCalls && window.__getPostsCalls.length > 0);

    assert(new URL(page.url()).searchParams.get('category') === 'AI Biz Daily', 'ABD 전용 URL 이동 실패');
    const boardTitleText = await page.locator('#board-title').innerText();
    assert(boardTitleText.includes('AI Biz Daily'), 'ABD 제목 누락: ' + boardTitleText);
    assert(boardTitleText.includes('AI Biz 발굴'), 'AI Biz 발굴 보조표기 누락: ' + boardTitleText);
    assert(await page.locator('#board-description').innerText() === '유망한 AI Biz 아이디어를 발굴하여 서로 토론을 통해 완성도를 높여봅시다.', 'ABD 제목 부제 불일치');
    assert((await page.locator('#abd-discussion-guide').count()) === 0, '불필요한 사업 검증 안내가 남아 있음');
    assert(await page.locator('#abd-membership-member-note').isVisible(), '로그인 회원 안내가 보이지 않음');
    assert(!(await page.locator('#abd-membership-signup').isVisible()), '로그인 회원에게 가입 버튼이 노출됨');
    assert(await page.evaluate(() => window.__getPostsCalls.at(-1)[2]) === 'AI Biz Daily', 'ABD 카테고리 필터 미적용');
    assert(await page.locator('[data-board-nav="abd"]').evaluate((el) => el.classList.contains('speakup-nav-active')), 'ABD 메뉴 활성 상태 누락');
    assert(!(await page.locator('#category-filter').isVisible()), 'ABD 전용 화면에서 타 카테고리가 노출됨');

    await page.waitForTimeout(1150);
    assert((await page.evaluate(() => window.__viewCalls.length)) === 0, '50% 미만 노출인 카드의 조회수가 증가함');
    await page.locator('.post-card').scrollIntoViewIfNeeded();
    await page.waitForTimeout(1150);
    assert((await page.evaluate(() => window.__viewCalls.length)) === 1, '50% 이상 1초 노출 후 조회수가 1회 증가하지 않음');
    await page.evaluate(() => loadPosts(true));
    await page.waitForTimeout(1150);
    assert((await page.evaluate(() => window.__viewCalls.length)) === 1, '동일 세션에서 같은 게시물 조회수가 중복 증가함');

    assert(!(await page.locator('#post-login-prompt').isVisible()), '로그인 회원에게 로그인 안내가 보임');
    assert(await page.locator('#post-write-btn-wrap').isVisible(), '로그인 회원에게 글쓰기 버튼이 보이지 않음');
    assert(!(await page.locator('#post-form-wrap').isVisible()), '초기 상태에서 글쓰기 폼이 열려 있음');
    await page.locator('#post-write-open-btn').click();
    assert(await page.locator('#post-form-wrap').isVisible(), '글쓰기 버튼 클릭 후 폼이 열리지 않음');
    assert(await page.locator('input[name="post-category"][value="AI Biz Daily"]').isChecked(), 'ABD 글쓰기 카테고리가 고정되지 않음');

    assert((await page.locator('.like-btn').innerText()).startsWith('기회'), 'ABD 기회 반응 문구 누락');
    assert((await page.locator('.dislike-btn').innerText()).startsWith('우려'), 'ABD 우려 반응 문구 누락');
    assert((await page.locator('.comment-toggle-btn').innerText()).startsWith('토론 참여'), 'ABD 토론 참여 문구 누락');
    await page.locator('.comment-toggle-btn').click();
    await page.locator('.comment-reply-btn').waitFor();
    assert(await page.locator('.comment-reply-btn').innerText() === '토론 답변', 'ABD 답글 문구 누락');

    await page.evaluate(() => document.getElementById('verify-view-gate').remove());
    await page.evaluate(() => window.scrollTo(0, 0));
    await page.screenshot({ path: 'G:/내 드라이브/WAAT/_검증결과/abd-menu-desktop.png', fullPage: true });
    await page.close();
}

async function verifyCommunityRegression(browser) {
    const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
    await mockBackend(page, true);
    await page.goto(baseUrl + '/speakup.html');
    await page.waitForFunction(() => window.__getPostsCalls && window.__getPostsCalls.length > 0);
    assert(await page.evaluate(() => window.__getPostsCalls.at(-1)[2]) === '', 'Community 전체 필터가 유지되지 않음');
    assert((await page.locator('#abd-discussion-guide').count()) === 0, 'Community에 삭제된 토론 안내가 남아 있음');
    assert((await page.locator('.like-btn').innerText()).startsWith('👍'), 'Community 좋아요 문구 회귀');
    assert((await page.locator('.comment-toggle-btn').innerText()).startsWith('💬 댓글'), 'Community 댓글 문구 회귀');
    await page.close();
}

async function verifyMobile(browser) {
    const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
    await mockBackend(page, false);
    await page.goto(baseUrl + '/index.html');
    await page.locator('.mobile-menu-btn').click();
    const abdMenu = page.locator('.nav-links-center a[href="speakup.html?category=AI%20Biz%20Daily"]');
    assert(await abdMenu.isVisible(), '모바일 메뉴에서 ABD 항목이 보이지 않음');
    await abdMenu.click();
    await page.waitForFunction(() => window.__getPostsCalls && window.__getPostsCalls.length > 0);
    assert((await page.locator('#board-title').innerText()).includes('AI Biz Daily'), '모바일 ABD 화면 진입 실패');
    await page.screenshot({ path: 'G:/내 드라이브/WAAT/_검증결과/abd-menu-mobile.png', fullPage: true });
    await page.close();
}

(async () => {
    const browser = await chromium.launch({ headless: true });
    try {
        await verifyLoggedOut(browser);
        await verifyAbdLoggedIn(browser);
        await verifyCommunityRegression(browser);
        await verifyMobile(browser);
        console.log('ABD_MENU_AUTH_DISCUSSION_VIEW_BROWSER_VERIFY_PASS');
    } finally {
        await browser.close();
    }
})().catch((error) => {
    console.error(error.stack || error);
    process.exit(1);
});
