// ========== Speak Up Board ==========
let spCurrentUser = null;
let spCurrentProfile = null;
let spPostOffset = 0;
let spActiveCategory = '';   // '' = 전체. '일반'/'자랑하기'/'협력하기'/'질문하기'/'요청하기'
let spDedicatedCategory = '';
const SP_PAGE_SIZE = 10;
const SP_ABD_CATEGORY = 'AI Biz Daily';
const SP_CATEGORIES = ['AI 새 소식', SP_ABD_CATEGORY, '공부하기', '자랑하기', '협력하기', '질문하기', '요청하기', '토론하기'];
// 카테고리별 뱃지 클래스 (CSS와 매핑)
function spCatClass(c) {
    return ({
        'AI 새 소식': 'cat-general',
        'AI Biz Daily': 'cat-abd',
        '자랑하기': 'cat-showcase',
        '공부하기': 'cat-study',
        '협력하기': 'cat-collab',
        '질문하기': 'cat-question',
        '요청하기': 'cat-request',
        '토론하기': 'cat-discuss'
    })[c] || 'cat-general';
}

// 카드 뱃지 표시용 라벨 — 저장된 post.category 값은 절대 바꾸지 않는다(필터·작성
// 폼은 여전히 'AI Biz Daily'를 그대로 씀). 상단 메뉴·페이지 제목은 이 함수를
// 거치지 않으므로 그대로 "AI Biz Daily"로 남는다. PO, 2026-08-15: 카드 안에서
// "AI Biz Daily"가 중복 노출되는 걸 줄이기 위해 카드 뱃지만 "ABD"로 축약.
function spCatLabel(c) {
    return c === SP_ABD_CATEGORY ? 'ABD' : (c || 'AI 새 소식');
}

// AI Biz Daily 자동 게시글 제목 끝에 " · 평점 NN점"이 실려 오면(가운뎃점 U+00B7,
// 앞뒤 공백 포함) 그 부분만 뽑아 배지로 그리고 화면 제목에서는 지운다. 이 표기가
// 없는 글(수동 작성 글, 다른 카테고리 글)은 title을 원본 그대로 반환한다 — 원본
// post.title 자체는 절대 바꾸지 않으므로 수정 폼에는 항상 평점이 그대로 남는다.
function spExtractRatingBadge(title) {
    var raw = title || '';
    var match = /\s*·\s*평점\s*(\d+)\s*점(?=\))/.exec(raw);
    if (!match) return { title: raw, rating: null };
    return {
        title: raw.slice(0, match.index) + raw.slice(match.index + match[0].length),
        rating: match[1]
    };
}

function spApplyBoardContext() {
    var params = new URLSearchParams(window.location.search);
    var requestedCategory = params.get('category') || '';
    spActiveCategory = SP_CATEGORIES.indexOf(requestedCategory) !== -1 ? requestedCategory : '';
    spDedicatedCategory = spActiveCategory === SP_ABD_CATEGORY ? SP_ABD_CATEGORY : '';

    var bar = document.getElementById('category-filter');
    if (bar) {
        bar.querySelectorAll('.cat-tab').forEach(function (button) {
            button.classList.toggle('is-active', (button.dataset.cat || '') === spActiveCategory);
        });
        if (spDedicatedCategory) bar.style.display = 'none';
    }

    if (!spDedicatedCategory) {
        var abdRadio = document.querySelector('input[name="post-category"][value="' + SP_ABD_CATEGORY + '"]');
        if (abdRadio) {
            var abdLabel = abdRadio.closest('label');
            if (abdLabel) abdLabel.style.display = 'none';
        }
        return;
    }

    document.title = 'AI Biz Daily — WAAT';
    var title = document.getElementById('board-title');
    var description = document.getElementById('board-description');
    var membershipNotice = document.getElementById('abd-membership-notice');
    if (title) title.innerHTML = 'AI Biz Daily <span class="section-title-en abd-title-label">AI Biz 발굴</span>';
    if (description) description.textContent = '유망한 AI Biz 아이디어를 발굴하여 서로 토론을 통해 완성도를 높여봅시다.';
    if (membershipNotice) membershipNotice.hidden = false;

    document.querySelectorAll('[data-board-nav]').forEach(function (link) {
        link.classList.toggle('speakup-nav-active', link.dataset.boardNav === 'abd');
    });

    document.querySelectorAll('input[name="post-category"]').forEach(function (radio) {
        radio.checked = radio.value === SP_ABD_CATEGORY;
        var label = radio.closest('label');
        if (label) label.style.display = radio.value === SP_ABD_CATEGORY ? '' : 'none';
    });
    // 글쓰기 버튼은 커뮤니티 게시판과 같은 라벨(PO, 2026-08-15: "글쓰기"로 통일,
    // 새 스타일 없음) — HTML(speakup.html)의 기본 텍스트가 이미 "글쓰기"이므로
    // 여기서 따로 바꾸지 않는다. 카테고리 사전 선택(위 라디오 처리)은 그대로 유지.
}

function spUpdateAbdMembershipNotice() {
    if (spDedicatedCategory !== SP_ABD_CATEGORY) return;
    var notice = document.getElementById('abd-membership-notice');
    if (notice) notice.hidden = Boolean(spCurrentUser);
}

// ========== View Count Tracking (세션 당 1회) ==========
var _viewedPosts = [];
try { _viewedPosts = JSON.parse(sessionStorage.getItem('sp_viewed') || '[]'); } catch(e) {}

// 비로그인 방문자 식별용 랜덤 키 (PO, 2026-08-22 -- 로그인 사용자만 조회수를 집계하던
// 것을 풀어, 이메일 클릭처럼 대부분 비로그인인 유입도 잡히게 한다). sessionStorage와
// 달리 브라우저를 껐다 켜도 남아야 재방문이 중복 집계되지 않으므로 localStorage에 둔다.
// 로그인 사용자는 서버에서 auth.uid()를 우선 쓰므로 이 키는 무시된다.
function _spGetAnonKey() {
    try {
        var key = localStorage.getItem('sp_anon_id');
        if (!key) {
            key = crypto.randomUUID();
            localStorage.setItem('sp_anon_id', key);
        }
        return key;
    } catch (e) {
        return null;
    }
}

async function trackPostView(postId) {
    if (_viewedPosts.indexOf(postId) !== -1) return;
    _viewedPosts.push(postId);
    try { sessionStorage.setItem('sp_viewed', JSON.stringify(_viewedPosts)); } catch(e) {}
    try { await DB.incrementViewCount(postId, _spGetAnonKey()); } catch(e) {}
}

var spViewObserver = null;
var spViewTimers = new Map();

function spObservePostView(card, postId) {
    if (typeof IntersectionObserver === 'undefined') return;
    if (!spViewObserver) {
        spViewObserver = new IntersectionObserver(function (entries) {
            entries.forEach(function (entry) {
                var id = Number(entry.target.dataset.postId);
                var timer = spViewTimers.get(entry.target);
                if (entry.isIntersecting && entry.intersectionRatio >= 0.5) {
                    if (!timer && _viewedPosts.indexOf(id) === -1) {
                        timer = setTimeout(function () {
                            spViewTimers.delete(entry.target);
                            spViewObserver.unobserve(entry.target);
                            trackPostView(id);
                        }, 1000);
                        spViewTimers.set(entry.target, timer);
                    }
                } else if (timer) {
                    clearTimeout(timer);
                    spViewTimers.delete(entry.target);
                }
            });
        }, { threshold: [0, 0.5, 1] });
    }
    spViewObserver.observe(card);
}

// ========== Escape HTML ==========
function spEscape(str) {
    var div = document.createElement('div');
    div.textContent = str || '';
    return div.innerHTML;
}

function spEscapeAttr(str) {
    return String(str || '')
        .replace(/&/g, '&amp;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;');
}

function spDecodeHtml(str) {
    var div = document.createElement('div');
    div.innerHTML = str || '';
    return div.textContent || '';
}

function spNormalizeHttpUrl(url) {
    try {
        var parsed = new URL(String(url || '').trim());
        if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') return null;
        return parsed.href;
    } catch (e) {
        return null;
    }
}

function spBuildSafeLink(escapedUrl, escapedLabel) {
    var normalized = spNormalizeHttpUrl(spDecodeHtml(escapedUrl));
    if (!normalized) return null;
    return '<a href="' + spEscapeAttr(normalized) + '" target="_blank" rel="noopener noreferrer" class="post-link">' +
        (escapedLabel === undefined ? escapedUrl : escapedLabel) +
        '</a>';
}

// ========== Render post images (image_urls array) ==========
// 2026-05-27 claude-news-agent 지원: posts.image_urls (text[]) 를 본문 아래 갤러리로 렌더링.
// 에이전트는 Supabase Storage 'post-images' 버킷에 업로드 후 public URL 배열을 image_urls 에 저장.
function spRenderImages(urls) {
    if (!Array.isArray(urls) || urls.length === 0) return '';
    var html = '<div class="post-images" style="margin-top:0.75rem;">';
    for (var i = 0; i < urls.length; i++) {
        var url = String(urls[i] || '').trim();
        var safeUrl = spNormalizeHttpUrl(url);
        if (!safeUrl) continue;
        html += '<img src="' + spEscapeAttr(safeUrl) + '" alt="" loading="lazy" ' +
            'style="max-width:100%;height:auto;margin:0.5rem 0;border-radius:6px;display:block;">';
    }
    html += '</div>';
    return html;
}

// ========== 요청 타임아웃 래퍼 (무한 대기 방지) ==========
// 등록 자체는 서버에서 성공해도 느린 네트워크(원격 데스크톱 등)에서는
// 응답 도착이 지연될 수 있다. 타임아웃 메시지는 "이미 등록됐을 수 있음"을 안내한다.
function spWithTimeout(promise, ms, label) {
    return Promise.race([
        Promise.resolve(promise),
        new Promise(function (_, reject) {
            setTimeout(function () {
                var err = new Error((label || '요청') + ' 응답이 지연되고 있습니다. 글이 이미 등록되었을 수 있으니, 다시 누르지 말고 페이지를 새로고침해 목록을 확인해주세요.');
                err.isTimeout = true;
                reject(err);
            }, ms);
        })
    ]);
}

// 에러를 사용자가 진단에 쓸 수 있도록 상세 문자열로 변환
function spErrDetail(err) {
    if (!err) return '알 수 없는 오류';
    if (typeof err === 'string') return err;
    var parts = [];
    if (err.message) parts.push(err.message);
    if (err.code) parts.push('code=' + err.code);
    if (err.hint) parts.push('hint=' + err.hint);
    if (err.details) parts.push(err.details);
    return parts.length ? parts.join(' / ') : JSON.stringify(err);
}

// ========== Time Ago ==========
function timeAgo(dateStr) {
    var now = new Date();
    var date = new Date(dateStr);
    var diff = Math.floor((now - date) / 1000);
    if (diff < 60) return '방금 전';
    if (diff < 3600) return Math.floor(diff / 60) + '분 전';
    if (diff < 86400) return Math.floor(diff / 3600) + '시간 전';
    if (diff < 604800) return Math.floor(diff / 86400) + '일 전';
    var m = date.getMonth() + 1;
    var d = date.getDate();
    return m + '월 ' + d + '일';
}

// ========== Linkify URLs ==========
function linkify(text) {
    var escaped = spEscape(text);
    return escaped.replace(
        /(https?:\/\/[^\s<]+)/g,
        function (match, url) { return spBuildSafeLink(url) || url; }
    );
}

// ========== 안전 마크다운 렌더 (2026-07-15) ==========
// 원칙: 먼저 전부 HTML escape(XSS 무력화) → 그 위에 화이트리스트 태그만 정규식으로 주입.
// 지원: **굵게**, *기울임*, [텍스트](http…), 맨 URL 자동링크, '- ' 목록, 줄바꿈.
function spRenderContent(text) {
    var s = spEscape(text || '');
    // 마크다운 링크 [텍스트](http/https…) — http(s)만 허용
    s = s.replace(/\[([^\]\n]+)\]\((https?:\/\/[^)\s]+)\)/g,
        function (match, label, url) { return spBuildSafeLink(url, label) || match; });
    // 굵게 (링크 처리 뒤), 그다음 기울임
    s = s.replace(/\*\*([^*\n]+)\*\*/g, '<strong>$1</strong>');
    s = s.replace(/\*([^*\n]+)\*/g, '<em>$1</em>');
    // 남은 맨 URL 자동링크 — 줄머리/공백 뒤만 매칭해 href 속성 안(따옴표 뒤)은 안 건드림
    s = s.replace(/(^|[\s])(https?:\/\/[^\s<]+)/g,
        function (match, prefix, url) { return prefix + (spBuildSafeLink(url) || url); });
    // '- ' 로 시작하는 연속 줄 → <ul><li>
    var lines = s.split('\n');
    var out = [];
    var inList = false;
    for (var i = 0; i < lines.length; i++) {
        var m = /^\s*-\s+(.*)$/.exec(lines[i]);
        if (m) {
            if (!inList) { out.push('<ul class="post-ul">'); inList = true; }
            out.push('<li>' + m[1] + '</li>');
        } else {
            if (inList) { out.push('</ul>'); inList = false; }
            out.push(lines[i]);
        }
    }
    if (inList) out.push('</ul>');
    var html = out.join('\n').replace(/\n/g, '<br>');
    // 블록 태그(<ul>/<li>) 주변의 불필요한 <br> 제거
    html = html.replace(/<br>\s*(<\/?(?:ul|li)[^>]*>)/g, '$1')
               .replace(/(<\/?(?:ul|li)[^>]*>)\s*<br>/g, '$1');
    return html;
}

// ========== Status Helper ==========
function spSetStatus(el, message, type) {
    if (!el) return;
    el.textContent = message;
    el.className = 'form-status ' + type;
}

// ========== Mobile Menu ==========
(function() {
    var menuBtn = document.querySelector('.mobile-menu-btn');
    var navLinks = document.querySelector('.nav-links');
    if (!menuBtn || !navLinks) return;
    menuBtn.addEventListener('click', function(e) {
        e.stopPropagation();
        navLinks.classList.toggle('show');
    });
    document.addEventListener('click', function(e) {
        if (!navLinks.classList.contains('show')) return;
        if (!e.target.closest('.nav-inner')) navLinks.classList.remove('show');
    });
    document.addEventListener('keydown', function(e) {
        if (e.key === 'Escape') navLinks.classList.remove('show');
    });
})();

// ========== Nav User Dropdown ==========
var spNavUserBtn = document.getElementById('nav-user-btn');
var spNavDropdown = document.getElementById('nav-dropdown');

if (spNavUserBtn) {
    spNavUserBtn.addEventListener('click', function(e) {
        e.stopPropagation();
        spNavDropdown.classList.toggle('show');
    });
}

document.addEventListener('click', function() {
    if (spNavDropdown) spNavDropdown.classList.remove('show');
});

// Dropdown actions
document.querySelectorAll('.dropdown-item').forEach(function(item) {
    item.addEventListener('click', async function(e) {
        var action = e.target.dataset.action;
        if (action === 'logout') {
            e.preventDefault();
            try {
                await Auth.signOut();
                spCurrentUser = null;
                spCurrentProfile = null;
                spUpdateAuthUI();
                spPostOffset = 0;
                await loadPosts(true);
            } catch (err) { /* ignore */ }
        }
        spNavDropdown.classList.remove('show');
    });
});

// ========== Auth UI ==========
function spUpdateAuthUI() {
    var navLoginLink = document.getElementById('nav-login-link');
    var navSignupLink = document.getElementById('nav-signup-link');
    var navUserMenu = document.getElementById('nav-user-menu');
    var navUserName = document.getElementById('nav-user-name');
    var navAdminLink = document.getElementById('nav-admin-link');
    var postFormWrap = document.getElementById('post-form-wrap');
    var postLoginPrompt = document.getElementById('post-login-prompt');

    var postWriteBtnWrap = document.getElementById('post-write-btn-wrap');

    if (spCurrentUser) {
        navLoginLink.style.display = 'none';
        navSignupLink.style.display = 'none';
        navUserMenu.style.display = 'block';
        navUserName.textContent = (spCurrentProfile && spCurrentProfile.name) || spCurrentUser.email;
        navAdminLink.style.display = isAdmin() ? 'block' : 'none';
        postWriteBtnWrap.style.display = 'block';
        postLoginPrompt.style.display = 'none';
    } else {
        navLoginLink.style.display = 'block';
        navSignupLink.style.display = 'block';
        navUserMenu.style.display = 'none';
        navAdminLink.style.display = 'none';
        postWriteBtnWrap.style.display = 'none';
        postFormWrap.style.display = 'none';
        postLoginPrompt.style.display = 'block';
    }
    spUpdateAbdMembershipNotice();
}

// ========== Init Auth ==========
async function spInitAuth() {
    var session = await Auth.getSession();
    if (session) {
        spCurrentUser = session.user;
        try {
            spCurrentProfile = await DB.getMyProfile();
        } catch (e) {
            spCurrentProfile = null;
        }
    }
    spUpdateAuthUI();

    Auth.onAuthStateChange(async function(event, session) {
        if (event === 'SIGNED_IN' && session) {
            spCurrentUser = session.user;
            try {
                spCurrentProfile = await DB.getMyProfile();
            } catch (e) {
                spCurrentProfile = null;
            }
            spUpdateAuthUI();
            spPostOffset = 0;
            await loadPosts(true);
        } else if (event === 'SIGNED_OUT') {
            spCurrentUser = null;
            spCurrentProfile = null;
            spUpdateAuthUI();
            spPostOffset = 0;
            await loadPosts(true);
        }
    });
}

// ========== Check ownership / admin ==========
function isOwner(userId) {
    return spCurrentUser && spCurrentUser.id === userId;
}

function isAdmin() {
    var email = spCurrentUser && spCurrentUser.email;
    return !!email && Array.isArray(ADMIN_EMAILS) &&
        ADMIN_EMAILS.indexOf(email.toLowerCase()) !== -1;
}

// ========== Load Posts ==========
// excludeId: 공유 링크로 이미 최상단에 표시한 글 — 목록에서 중복 제외
async function loadPosts(reset, excludeId) {
    var container = document.getElementById('posts-container');
    var loadMoreWrap = document.getElementById('load-more-wrap');
    // excludeId가 있으면 공유 글이 이미 container에 표시돼 있으므로 비우지 않고 이어붙인다
    var pinned = !!excludeId;

    if (reset) {
        spPostOffset = 0;
        if (!pinned) container.innerHTML = '<div class="admin-loading">게시글을 불러오는 중...</div>';
    }

    try {
        var excludeCategory = spDedicatedCategory ? null : SP_ABD_CATEGORY;
        var posts = await DB.getPosts(SP_PAGE_SIZE, spPostOffset, spActiveCategory, excludeCategory);

        if (reset && posts.length === 0 && !pinned) {
            container.innerHTML = '<div class="speakup-empty">아직 게시글이 없습니다. 첫 글을 작성해보세요!</div>';
            loadMoreWrap.style.display = 'none';
            return;
        }

        if (reset && !pinned) container.innerHTML = '';

        for (var i = 0; i < posts.length; i++) {
            if (excludeId && Number(posts[i].id) === Number(excludeId)) continue;
            var postEl = await renderPostCard(posts[i]);
            container.appendChild(postEl);
        }

        spPostOffset += posts.length;
        loadMoreWrap.style.display = posts.length < SP_PAGE_SIZE ? 'none' : 'block';
    } catch (e) {
        console.error('loadPosts error:', e);
        if (reset && !pinned) {
            container.innerHTML = '<div style="text-align:center;padding:2rem;color:var(--accent-pink);">게시글 로드 오류: ' + escapeHtml(String(e.message || e)) + '</div>';
        }
    }
}

// ========== Render Single Post Card ==========
async function renderPostCard(post) {
    var card = document.createElement('div');
    card.className = 'post-card' + (post.pinned_at ? ' is-pinned' : '');
    card.dataset.postId = post.id;

    var authorName = (post.profiles && post.profiles.name) || '알 수 없음';
    var isOwnPost = isOwner(post.user_id);
    var isAdminUser = isAdmin();

    // Fetch reaction counts and comment count in parallel
    var reactionData, commentCount, myReaction;
    try {
        var promises = [
            DB.getReactionCounts(post.id),
            DB.getCommentCount(post.id)
        ];
        if (spCurrentUser) {
            promises.push(DB.getMyReaction(post.id, spCurrentUser.id));
        }
        var results = await Promise.all(promises);
        reactionData = results[0];
        commentCount = results[1];
        myReaction = results[2] || null;
    } catch (e) {
        reactionData = { likes: 0, dislikes: 0 };
        commentCount = 0;
        myReaction = null;
    }

    var isAbdDiscussion = spDedicatedCategory === SP_ABD_CATEGORY;
    var likeLabel = isAbdDiscussion ? '기회' : '👍';
    var dislikeLabel = isAbdDiscussion ? '우려' : '👎';
    var commentLabel = isAbdDiscussion ? '토론 참여' : '💬 댓글';
    var commentPlaceholder = isAbdDiscussion ? '사업 검증 의견을 남겨주세요' : '댓글을 입력하세요';
    var likeActive = myReaction && myReaction.reaction_type === 'like' ? ' active' : '';
    var dislikeActive = myReaction && myReaction.reaction_type === 'dislike' ? ' active' : '';

    // Action buttons for own post / admin
    var actionBtns = '';
    if (isOwnPost || isAdminUser) {
        actionBtns = '<div class="post-actions">' +
            (isAdminUser ?
                '<button class="post-action-btn post-pin-btn" data-post-id="' + post.id + '" data-pinned="' + (post.pinned_at ? 'true' : 'false') + '">' +
                    (post.pinned_at ? '고정 해제' : '상단 고정') +
                '</button>' : '') +
            '<button class="post-action-btn post-edit-btn" data-post-id="' + post.id + '"' + (isAdminUser && !isOwnPost ? ' title="관리자 수정"' : '') + '>수정</button>' +
            '<button class="post-action-btn post-delete-btn" data-post-id="' + post.id + '">삭제</button>' +
            '</div>';
    }

    var pinBadgeHtml = post.pinned_at ? '<span class="post-pin-badge">상단 고정</span>' : '';
    var fbBadgeHtml = '';
    var sourceUrl = spNormalizeHttpUrl(post.fb_url);
    if (sourceUrl) {
        var isThreads = /threads\.(net|com)/i.test(sourceUrl);
        var isFacebook = /(?:^|\.)facebook\.com|(?:^|\.)fb\.com/i.test(sourceUrl);
        var badgeClass, badgeLabel, badgeIcon;
        if (isThreads) {
            badgeClass = 'post-fb-badge post-threads-badge';
            badgeLabel = '쓰레드 원본 보기';
            badgeIcon = '<svg viewBox="0 0 24 24" width="14" height="14" fill="currentColor" aria-hidden="true"><path d="M17.7 11.1c-.1 0-.1-.1-.2-.1-.1-1.8-1.1-2.9-2.7-2.9-1 0-1.8.4-2.3 1.2l.9.6c.4-.6.9-.7 1.4-.7.6 0 1 .2 1.3.5.2.3.4.6.4 1-.5-.1-1-.2-1.5-.2-1.7 0-2.7.9-2.7 2.2 0 .6.2 1.1.7 1.5.4.4 1 .6 1.7.6.9 0 1.5-.3 2-.9.4-.5.5-1.1.6-1.5.5.3.8.7 1 1.2.2.6.2 1.4-.1 2.1-.5 1.3-1.8 2.2-3.5 2.2-1.9 0-3.4-.7-4.3-2.1-.9-1.3-1.3-3.2-1.3-5.4 0-2.2.4-4 1.3-5.4.9-1.4 2.3-2 4.3-2 1.9 0 3.4.7 4.4 2 .5.7.9 1.5 1.1 2.5l1.1-.3c-.3-1.2-.7-2.2-1.4-3-1.2-1.5-2.9-2.4-5.1-2.4S6.7 4.6 5.5 6.3C4.4 8 3.9 10.1 3.9 12.4c0 2.4.5 4.4 1.6 6 1.2 1.7 2.9 2.5 5.1 2.5 2.1 0 3.7-.8 4.6-2.4.4-.7.7-1.5.8-2.4.1-.5 0-1 0-1.5-.1-.6-.4-1.1-1-1.5zm-3 2.4c-.1.3-.3.6-.5.7-.3.2-.6.3-1 .3-.4 0-.7-.1-.9-.3-.2-.2-.3-.4-.3-.7 0-.7.7-1.1 1.6-1.1.4 0 .8 0 1.2.1 0 .4-.1.7-.1 1z"/></svg>';
        } else if (isFacebook) {
            badgeClass = 'post-fb-badge';
            badgeLabel = '페이스북 원본 보기';
            badgeIcon = '<svg viewBox="0 0 24 24" width="14" height="14" fill="currentColor" aria-hidden="true"><path d="M22 12a10 10 0 1 0-11.56 9.88v-6.99H7.9V12h2.54V9.8c0-2.5 1.49-3.89 3.77-3.89 1.09 0 2.24.2 2.24.2v2.46h-1.26c-1.24 0-1.63.77-1.63 1.56V12h2.78l-.44 2.89h-2.34v6.99A10 10 0 0 0 22 12z"/></svg>';
        } else {
            badgeClass = 'post-fb-badge post-source-badge';
            badgeLabel = '원문 보기';
            badgeIcon = '<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M14 3h7v7"/><path d="M10 14L21 3"/><path d="M21 14v5a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5"/></svg>';
        }
        fbBadgeHtml =
            '<a href="' + spEscapeAttr(sourceUrl) + '" target="_blank" rel="noopener noreferrer" class="' + badgeClass + '" title="' + badgeLabel + '">' +
                badgeIcon +
                '<span>' + badgeLabel + '</span>' +
            '</a>';
    }

    var spTitleInfo = spExtractRatingBadge(post.title);
    var spRatingBadgeHtml = spTitleInfo.rating
        ? '<span class="post-category-badge post-rating-badge">평점 ' + spEscape(spTitleInfo.rating) + '점</span>'
        : '';

    card.innerHTML =
        '<div class="post-header">' +
            '<div class="post-author-info">' +
                '<span class="post-category-badge ' + spCatClass(post.category || 'AI 새 소식') + '">' + spEscape(spCatLabel(post.category)) + '</span>' +
                spRatingBadgeHtml +
                '<div class="post-avatar">' + spEscape(authorName.charAt(0)) + '</div>' +
                '<div class="post-author">' + spEscape(authorName) + '</div>' +
                '<div class="post-time">' + timeAgo(post.created_at) + '</div>' +
            '</div>' +
            actionBtns +
        '</div>' +
        '<div class="post-body">' +
            pinBadgeHtml +
            '<h3 class="post-title">' + spEscape(spTitleInfo.title) + '</h3>' +
            '<div class="post-content-wrap">' +
                '<div class="post-content clamped">' + spRenderContent(post.content) + spRenderImages(post.image_urls) + '</div>' +
                '<button type="button" class="post-more-btn" style="display:none;">… 더 보기</button>' +
            '</div>' +
            fbBadgeHtml +
        '</div>' +
        '<div class="post-footer">' +
            '<div class="post-reactions">' +
                '<button class="reaction-btn like-btn' + likeActive + '" data-post-id="' + post.id + '" data-type="like">' +
                    likeLabel + ' <span class="like-count">' + reactionData.likes + '</span>' +
                '</button>' +
                '<button class="reaction-btn dislike-btn' + dislikeActive + '" data-post-id="' + post.id + '" data-type="dislike">' +
                    dislikeLabel + ' <span class="dislike-count">' + reactionData.dislikes + '</span>' +
                '</button>' +
            '</div>' +
            '<div class="post-footer-right">' +
                '<span class="post-view-count">👁 <span class="view-count-num">' + (post.view_count || 0) + '</span></span>' +
                '<button class="post-share-btn" data-post-id="' + post.id + '" title="링크 복사">공유</button>' +
                '<button class="comment-toggle-btn" data-post-id="' + post.id + '">' +
                    commentLabel + ' <span class="comment-count">' + commentCount + '</span>' +
                '</button>' +
            '</div>' +
        '</div>' +
        '<div class="comments-section" id="comments-' + post.id + '" style="display:none;">' +
            '<div class="comments-list" id="comments-list-' + post.id + '"></div>' +
            (spCurrentUser ?
                '<div class="comment-form-wrap">' +
                    '<form class="comment-form" data-post-id="' + post.id + '">' +
                        '<input type="text" class="comment-input" placeholder="' + commentPlaceholder + '" required maxlength="1000">' +
                        '<button type="submit" class="btn-primary comment-submit-btn">등록</button>' +
                    '</form>' +
                '</div>' : '') +
        '</div>';

    // 카드가 실제로 50% 이상 1초간 노출된 경우에만 조회로 인정한다.
    spObservePostView(card, post.id);

    // Bind events
    bindPostCardEvents(card, post);
    return card;
}

// ========== Bind post card events ==========
function bindPostCardEvents(card, post) {
    // 본문 더보기/접기 — 페이스북식. clamped 상태에서 본문이 잘려있을 때만 버튼 노출.
    var contentEl = card.querySelector('.post-content');
    var moreBtn = card.querySelector('.post-more-btn');
    if (contentEl && moreBtn) {
        requestAnimationFrame(function () {
            // 잘림 감지: 스크롤 높이가 보이는 높이보다 큰 경우
            if (contentEl.scrollHeight - contentEl.clientHeight > 2) {
                moreBtn.style.display = 'inline-block';
            }
        });
        moreBtn.addEventListener('click', function () {
            if (contentEl.classList.contains('clamped')) {
                contentEl.classList.remove('clamped');
                moreBtn.textContent = '접기';
            } else {
                contentEl.classList.add('clamped');
                moreBtn.textContent = '… 더 보기';
            }
        });
    }

    // Reaction buttons
    card.querySelectorAll('.reaction-btn').forEach(function(btn) {
        btn.addEventListener('click', async function() {
            if (!spCurrentUser) {
                alert('로그인이 필요합니다.');
                return;
            }
            var postId = parseInt(btn.dataset.postId);
            var type = btn.dataset.type;
            btn.disabled = true;
            try {
                await DB.upsertReaction(postId, spCurrentUser.id, type);
                // Refresh counts
                var counts = await DB.getReactionCounts(postId);
                var myR = await DB.getMyReaction(postId, spCurrentUser.id);
                var postCard = card;
                postCard.querySelector('.like-count').textContent = counts.likes;
                postCard.querySelector('.dislike-count').textContent = counts.dislikes;
                var likeBtn = postCard.querySelector('.like-btn');
                var dislikeBtn = postCard.querySelector('.dislike-btn');
                likeBtn.classList.toggle('active', myR && myR.reaction_type === 'like');
                dislikeBtn.classList.toggle('active', myR && myR.reaction_type === 'dislike');
            } catch (e) {
                console.error('Reaction error:', e);
            } finally {
                btn.disabled = false;
            }
        });
    });

    // Comment toggle
    var toggleBtn = card.querySelector('.comment-toggle-btn');
    if (toggleBtn) {
        toggleBtn.addEventListener('click', async function() {
            var postId = parseInt(toggleBtn.dataset.postId);
            var section = card.querySelector('#comments-' + postId);
            if (section.style.display === 'none') {
                section.style.display = 'block';
                await loadComments(postId, card);
            } else {
                section.style.display = 'none';
            }
        });
    }

    // Comment form submit
    var commentForm = card.querySelector('.comment-form');
    if (commentForm) {
        commentForm.addEventListener('submit', async function(e) {
            e.preventDefault();
            e.stopPropagation();
            var postId = parseInt(commentForm.dataset.postId);
            var input = commentForm.querySelector('.comment-input');
            var content = input.value.trim();
            if (!content) return;
            var submitBtn = commentForm.querySelector('.comment-submit-btn');
            if (submitBtn.disabled) return; // 중복 방지

            // 세션 재확인 (모바일 토큰 만료 대비)
            if (!spCurrentUser) {
                try {
                    var session = await Auth.getSession();
                    if (session) spCurrentUser = session.user;
                } catch (e) {}
            }
            if (!spCurrentUser) {
                alert('로그인이 필요합니다. 다시 로그인해주세요.');
                return;
            }

            submitBtn.disabled = true;
            try {
                await DB.createComment(postId, spCurrentUser.id, content, null);
                input.value = '';
                await loadComments(postId, card);
                var count = await DB.getCommentCount(postId);
                card.querySelector('.comment-count').textContent = count;
            } catch (err) {
                console.error('Comment error:', err);
                alert('댓글 등록 오류: ' + (err.message || err));
            } finally {
                submitBtn.disabled = false;
            }
        });
    }

    // Share button
    var shareBtn = card.querySelector('.post-share-btn');
    if (shareBtn) {
        shareBtn.addEventListener('click', function() {
            var postId = shareBtn.dataset.postId;
            var shareUrl = new URL(window.location.pathname, window.location.origin);
            if (spDedicatedCategory) shareUrl.searchParams.set('category', spDedicatedCategory);
            shareUrl.searchParams.set('post', postId);
            var url = shareUrl.toString();
            if (navigator.clipboard) {
                navigator.clipboard.writeText(url).then(function() {
                    shareBtn.textContent = '복사됨';
                    setTimeout(function() { shareBtn.textContent = '공유'; }, 1500);
                });
            } else {
                var ta = document.createElement('textarea');
                ta.value = url;
                document.body.appendChild(ta);
                ta.select();
                document.execCommand('copy');
                document.body.removeChild(ta);
                shareBtn.textContent = '✅';
                setTimeout(function() { shareBtn.textContent = '🔗'; }, 1500);
            }
        });
    }

    // 관리자만 현재 아젠다를 상단에 고정하거나 해제할 수 있다.
    var pinBtn = card.querySelector('.post-pin-btn');
    if (pinBtn) {
        pinBtn.addEventListener('click', async function() {
            var postId = parseInt(pinBtn.dataset.postId);
            var shouldPin = pinBtn.dataset.pinned !== 'true';
            var message = shouldPin
                ? '이 게시글을 상단에 고정하시겠습니까? 고정글은 최대 3개입니다.'
                : '이 게시글의 상단 고정을 해제하시겠습니까?';
            if (!confirm(message)) return;

            pinBtn.disabled = true;
            try {
                await DB.setPostPinned(postId, shouldPin);
                await loadPosts(true);
            } catch (err) {
                alert((shouldPin ? '상단 고정' : '상단 고정 해제') + ' 오류: ' + (err.message || err));
            } finally {
                pinBtn.disabled = false;
            }
        });
    }

    // Edit button
    var editBtn = card.querySelector('.post-edit-btn');
    if (editBtn) {
        editBtn.addEventListener('click', function(e) {
            e.preventDefault();
            e.stopPropagation();
            var postId = parseInt(editBtn.dataset.postId);
            try {
                startEditPost(postId, post.title, post.content, post.fb_url || '', post.category || 'AI 새 소식', post.image_urls || []);
            } catch (err) {
                console.error('[edit] startEditPost error:', err);
                alert('수정 모드 진입 오류: ' + (err.message || err));
            }
        });
    }

    // Delete button
    var deleteBtn = card.querySelector('.post-delete-btn');
    if (deleteBtn) {
        deleteBtn.addEventListener('click', async function() {
            var postId = parseInt(deleteBtn.dataset.postId);
            if (!confirm('이 게시글을 삭제하시겠습니까?')) return;
            try {
                await DB.deletePost(postId);
                card.remove();
            } catch (err) {
                alert('삭제 오류: ' + (err.message || err));
            }
        });
    }
}

// ========== Load Comments ==========
async function loadComments(postId, postCard) {
    var listEl = postCard.querySelector('#comments-list-' + postId);
    if (!listEl) return;
    listEl.innerHTML = '<div class="admin-loading" style="padding:0.5rem;">댓글 불러오는 중...</div>';

    try {
        var comments = await DB.getComments(postId);
        if (comments.length === 0) {
            var emptyText = spDedicatedCategory === SP_ABD_CATEGORY ? '아직 토론 의견이 없습니다.' : '댓글이 없습니다.';
            listEl.innerHTML = '<div class="speakup-empty" style="padding:0.5rem;font-size:0.85rem;">' + emptyText + '</div>';
            return;
        }

        // Separate top-level and replies
        var topLevel = [];
        var replyMap = {};
        comments.forEach(function(c) {
            if (!c.parent_id) {
                topLevel.push(c);
            } else {
                if (!replyMap[c.parent_id]) replyMap[c.parent_id] = [];
                replyMap[c.parent_id].push(c);
            }
        });

        listEl.innerHTML = '';
        topLevel.forEach(function(comment) {
            var el = renderComment(comment, postId, postCard, false);
            listEl.appendChild(el);
            // Replies
            var replies = replyMap[comment.id] || [];
            replies.forEach(function(reply) {
                var replyEl = renderComment(reply, postId, postCard, true);
                listEl.appendChild(replyEl);
            });
        });
    } catch (e) {
        listEl.innerHTML = '<div style="padding:0.5rem;color:var(--accent-pink);">댓글 로드 오류</div>';
    }
}

// ========== Render Comment ==========
function renderComment(comment, postId, postCard, isReply) {
    var el = document.createElement('div');
    el.className = 'comment-item' + (isReply ? ' comment-reply' : '');
    el.dataset.commentId = comment.id;

    var name = (comment.profiles && comment.profiles.name) || '알 수 없음';
    var canDelete = isOwner(comment.user_id) || isAdmin();

    var deleteBtnHtml = canDelete ?
        '<button class="comment-delete-btn" data-comment-id="' + comment.id + '">삭제</button>' : '';

    var replyBtnHtml = (!isReply && spCurrentUser) ?
        '<button class="comment-reply-btn" data-comment-id="' + comment.id + '">' +
            (spDedicatedCategory === SP_ABD_CATEGORY ? '토론 답변' : '답글') + '</button>' : '';

    el.innerHTML =
        '<div class="comment-header">' +
            '<span class="comment-author">' + spEscape(name) + '</span>' +
            '<span class="comment-time">' + timeAgo(comment.created_at) + '</span>' +
            replyBtnHtml +
            deleteBtnHtml +
        '</div>' +
        '<div class="comment-body">' + spEscape(comment.content).replace(/\n/g, '<br>') + '</div>' +
        '<div class="reply-form-wrap" id="reply-form-' + comment.id + '" style="display:none;"></div>';

    // Reply button
    var replyBtn = el.querySelector('.comment-reply-btn');
    if (replyBtn) {
        replyBtn.addEventListener('click', function() {
            var wrap = el.querySelector('#reply-form-' + comment.id);
            if (wrap.style.display !== 'none') {
                wrap.style.display = 'none';
                wrap.innerHTML = '';
                return;
            }
            wrap.style.display = 'block';
            wrap.innerHTML =
                '<form class="reply-form" data-post-id="' + postId + '" data-parent-id="' + comment.id + '">' +
                    '<input type="text" class="comment-input reply-input" placeholder="' +
                        (spDedicatedCategory === SP_ABD_CATEGORY ? '사업 검증 답변을 남겨주세요' : '답글을 입력하세요') + '" required maxlength="1000">' +
                    '<button type="submit" class="btn-primary comment-submit-btn">등록</button>' +
                '</form>';

            var form = wrap.querySelector('.reply-form');
            form.addEventListener('submit', async function(ev) {
                ev.preventDefault();
                ev.stopPropagation();
                var input = form.querySelector('.reply-input');
                var content = input.value.trim();
                if (!content) return;
                var submitBtn = form.querySelector('.comment-submit-btn');
                if (submitBtn.disabled) return; // 중복 방지
                submitBtn.disabled = true;
                try {
                    await DB.createComment(postId, spCurrentUser.id, content, comment.id);
                    wrap.style.display = 'none';
                    wrap.innerHTML = '';
                    await loadComments(postId, postCard);
                    var count = await DB.getCommentCount(postId);
                    postCard.querySelector('.comment-count').textContent = count;
                } catch (err) {
                    alert('답글 등록 오류: ' + (err.message || err));
                } finally {
                    submitBtn.disabled = false;
                }
            });

            wrap.querySelector('.reply-input').focus();
        });
    }

    // Delete button
    var deleteBtn = el.querySelector('.comment-delete-btn');
    if (deleteBtn) {
        deleteBtn.addEventListener('click', async function() {
            if (!confirm('이 댓글을 삭제하시겠습니까?')) return;
            try {
                await DB.deleteComment(parseInt(deleteBtn.dataset.commentId));
                await loadComments(postId, postCard);
                var count = await DB.getCommentCount(postId);
                postCard.querySelector('.comment-count').textContent = count;
            } catch (err) {
                alert('댓글 삭제 오류: ' + (err.message || err));
            }
        });
    }

    return el;
}

// ========== Write Button Toggle ==========
var postWriteOpenBtn = document.getElementById('post-write-open-btn');
if (postWriteOpenBtn) {
    postWriteOpenBtn.addEventListener('click', function() {
        var wrap = document.getElementById('post-form-wrap');
        wrap.style.display = 'block';
        document.getElementById('post-write-btn-wrap').style.display = 'none';
        // 전용 메뉴에서는 AI Biz Daily, 일반 커뮤니티에서는 AI 새 소식으로 시작한다.
        var defaultCategory = spDedicatedCategory || 'AI 새 소식';
        var defaultRadio = document.querySelector('input[name="post-category"][value="' + defaultCategory + '"]');
        if (defaultRadio) defaultRadio.checked = true;
        spResetImages();
        spAutoGrow(document.getElementById('post-content'));
        // 폼으로 스크롤 (모바일에서 폼이 화면 아래라서 못 보는 경우 방지)
        var navHeight = (document.querySelector('nav') && document.querySelector('nav').offsetHeight) || 70;
        var top = wrap.getBoundingClientRect().top + window.pageYOffset - navHeight - 12;
        window.scrollTo({ top: top, behavior: 'smooth' });
        setTimeout(function() {
            document.getElementById('post-title').focus();
        }, 250);
    });
}

// ========== Post Form (Create / Edit) ==========
var postForm = document.getElementById('post-form');
var postEditId = document.getElementById('post-edit-id');
var postCancelBtn = document.getElementById('post-cancel-btn');
var postSubmitBtn = document.getElementById('post-submit-btn');

// ========== 이미지 첨부 (2026-07-15, 옵션 A: 로그인 사용자 업로드) ==========
var SP_IMG_BUCKET = 'post-images';
var SP_IMG_MAX = 5;
var SP_IMG_MAX_BYTES = 5 * 1024 * 1024;
var SP_IMG_MIME = ['image/png', 'image/jpeg', 'image/webp', 'image/gif'];
var spNewImageFiles = [];      // 이번에 새로 올릴 File[]
var spExistingImageUrls = [];  // 수정 시 유지되는 기존 public URL[]

function spResetImages() {
    spNewImageFiles = [];
    spExistingImageUrls = [];
    var input = document.getElementById('post-image-input');
    if (input) input.value = '';
    spRenderImagePreviews();
}

function spRenderImagePreviews() {
    var wrap = document.getElementById('post-image-previews');
    if (!wrap) return;
    wrap.innerHTML = '';
    // 기존(수정) 이미지 — 제거 시 배열에서 빠져 저장 때 반영됨
    spExistingImageUrls.forEach(function (url, idx) {
        var d = document.createElement('div');
        d.className = 'post-image-thumb';
        var img = document.createElement('img');
        img.alt = '';
        img.src = url;
        var btn = document.createElement('button');
        btn.type = 'button';
        btn.className = 'post-image-remove';
        btn.title = '제거';
        btn.textContent = '×';
        btn.addEventListener('click', function () {
            spExistingImageUrls.splice(idx, 1);
            spRenderImagePreviews();
        });
        d.appendChild(img);
        d.appendChild(btn);
        wrap.appendChild(d);
    });
    // 새로 선택한 파일 — data URL 미리보기 (CSP img-src가 data: 허용, blob:은 미허용)
    spNewImageFiles.forEach(function (file, idx) {
        var d = document.createElement('div');
        d.className = 'post-image-thumb';
        var img = document.createElement('img');
        img.alt = '';
        var reader = new FileReader();
        reader.onload = function (e) { img.src = e.target.result; };
        reader.readAsDataURL(file);
        var btn = document.createElement('button');
        btn.type = 'button';
        btn.className = 'post-image-remove';
        btn.title = '제거';
        btn.textContent = '×';
        btn.addEventListener('click', function () {
            spNewImageFiles.splice(idx, 1);
            spRenderImagePreviews();
        });
        d.appendChild(img);
        d.appendChild(btn);
        wrap.appendChild(d);
    });
}

// 파일 선택 → 검증(형식·용량·개수) 후 목록에 추가
var spImageInput = document.getElementById('post-image-input');
if (spImageInput) {
    spImageInput.addEventListener('change', function () {
        var statusEl = document.getElementById('post-status');
        var files = Array.prototype.slice.call(spImageInput.files || []);
        spImageInput.value = '';  // 같은 파일 재선택 허용 + 매 change 초기화
        for (var i = 0; i < files.length; i++) {
            var f = files[i];
            if (SP_IMG_MIME.indexOf(f.type) === -1) {
                spSetStatus(statusEl, '지원하지 않는 형식: ' + (f.name || '') + ' (PNG/JPG/WEBP/GIF만)', 'error');
                continue;
            }
            if (f.size > SP_IMG_MAX_BYTES) {
                spSetStatus(statusEl, '용량 초과: ' + (f.name || '') + ' (장당 5MB 이하)', 'error');
                continue;
            }
            if (spExistingImageUrls.length + spNewImageFiles.length >= SP_IMG_MAX) {
                spSetStatus(statusEl, '이미지는 최대 ' + SP_IMG_MAX + '장까지 첨부할 수 있습니다.', 'error');
                break;
            }
            spNewImageFiles.push(f);
        }
        spRenderImagePreviews();
    });
}

// 새 File[] 을 Storage(post-images/user/<uid>/) 에 업로드 → public URL[] 반환. 실패 시 throw.
async function spUploadNewImages(userId) {
    var urls = [];
    for (var i = 0; i < spNewImageFiles.length; i++) {
        var file = spNewImageFiles[i];
        var ext = (file.name && file.name.indexOf('.') !== -1)
            ? file.name.split('.').pop().toLowerCase().replace(/[^a-z0-9]/g, '') : 'png';
        var rand = Math.random().toString(36).slice(2, 8);
        var path = 'user/' + userId + '/' + Date.now() + '_' + rand + '.' + (ext || 'png');
        var up = await _supabase.storage.from(SP_IMG_BUCKET).upload(path, file, {
            contentType: file.type || 'image/png',
            upsert: true
        });
        if (up.error) throw new Error('이미지 업로드 실패: ' + (up.error.message || up.error));
        var pub = _supabase.storage.from(SP_IMG_BUCKET).getPublicUrl(path);
        var publicUrl = pub && pub.data && pub.data.publicUrl;
        if (!publicUrl) throw new Error('이미지 public URL 생성 실패');
        urls.push(publicUrl);
    }
    return urls;
}

// ========== 내용 입력칸 자동 높이 — 글자 수에 비례해 늘어남 ==========
var SP_TEXTAREA_MIN = 110;   // px, 약 4줄
var SP_TEXTAREA_MAX = 640;   // px, 이 이상은 내부 스크롤
function spAutoGrow(el) {
    if (!el) return;
    el.style.height = 'auto';
    var h = Math.min(Math.max(el.scrollHeight, SP_TEXTAREA_MIN), SP_TEXTAREA_MAX);
    el.style.height = h + 'px';
    el.style.overflowY = (el.scrollHeight > SP_TEXTAREA_MAX) ? 'auto' : 'hidden';
}
var postContentEl = document.getElementById('post-content');
if (postContentEl) {
    postContentEl.addEventListener('input', function () { spAutoGrow(postContentEl); });
}

// ========== 서식 툴바 (굵게/기울임/목록/링크) — 등록·수정 공용 ==========
function spApplyFormat(fmt) {
    var ta = document.getElementById('post-content');
    if (!ta) return;
    var start = ta.selectionStart, end = ta.selectionEnd;
    var val = ta.value;
    var sel = val.slice(start, end);
    var before = val.slice(0, start), after = val.slice(end);
    var newVal, cs, ce;
    if (fmt === 'bold' || fmt === 'italic') {
        var mark = fmt === 'bold' ? '**' : '*';
        var t = sel || (fmt === 'bold' ? '굵은 텍스트' : '기울인 텍스트');
        newVal = before + mark + t + mark + after;
        cs = start + mark.length; ce = cs + t.length;
    } else if (fmt === 'list') {
        var block = sel || '목록 항목';
        var listed = block.split('\n').map(function (l) { return l.trim() ? '- ' + l : l; }).join('\n');
        var prefix = (before && !/\n$/.test(before)) ? '\n' : '';
        newVal = before + prefix + listed + after;
        cs = start + prefix.length; ce = cs + listed.length;
    } else if (fmt === 'link') {
        var isUrl = /^https?:\/\//.test(sel);
        var label = isUrl ? '링크 텍스트' : (sel || '링크 텍스트');
        var url = isUrl ? sel : 'https://';
        newVal = before + '[' + label + '](' + url + ')' + after;
        cs = start + 1; ce = cs + label.length;   // 텍스트 부분 선택
    } else {
        return;
    }
    ta.value = newVal;
    ta.focus();
    ta.setSelectionRange(cs, ce);
    spAutoGrow(ta);
}

var spFmtToolbar = document.getElementById('post-format-toolbar');
if (spFmtToolbar) {
    spFmtToolbar.addEventListener('click', function (e) {
        var btn = e.target.closest('.fmt-btn');
        if (!btn) return;
        e.preventDefault();
        spApplyFormat(btn.dataset.fmt);
    });
}

// form submit 막기
if (postForm) {
    postForm.addEventListener('submit', function(e) { e.preventDefault(); });
}

// 등록/수정 버튼 클릭
if (postSubmitBtn) {
    postSubmitBtn.addEventListener('click', async function() {
        var statusEl = document.getElementById('post-status');
        var title = document.getElementById('post-title').value.trim();
        var content = document.getElementById('post-content').value.trim();
        var fbUrlRaw = (document.getElementById('post-fb-url') && document.getElementById('post-fb-url').value.trim()) || '';
        var editId = postEditId.value;
        var catEl = document.querySelector('input[name="post-category"]:checked');
        var category = (catEl && SP_CATEGORIES.indexOf(catEl.value) !== -1) ? catEl.value : 'AI 새 소식';

        if (!title || !content) {
            spSetStatus(statusEl, '제목과 내용을 모두 입력해주세요.', 'error');
            return;
        }

        // 원문·참고 링크 검증 (선택 입력 — 모든 HTTP/HTTPS 웹 링크 허용)
        var fbUrl = null;
        if (fbUrlRaw) {
            try {
                var parsedSourceUrl = new URL(fbUrlRaw);
                if (parsedSourceUrl.protocol !== 'http:' && parsedSourceUrl.protocol !== 'https:') {
                    throw new Error('unsupported protocol');
                }
            } catch (urlError) {
                spSetStatus(statusEl, 'http:// 또는 https://로 시작하는 유효한 웹 링크를 입력해주세요.', 'error');
                return;
            }
            fbUrl = parsedSourceUrl.href;
        }
        // 세션 재확인 — 성공하면 최신 user로 갱신, 실패해도 기존 사용자로 폴백.
        // (getSession 실패만으로 차단하면 멀쩡히 로그인한 사용자도 막히므로 강제 차단 금지)
        try {
            var session = await spWithTimeout(Auth.getSession(), 8000, '세션 확인');
            if (session && session.user) spCurrentUser = session.user;
        } catch (e) { /* 폴백: spInitAuth가 잡아둔 spCurrentUser 유지 */ }
        if (!spCurrentUser) {
            spSetStatus(statusEl, '로그인이 필요합니다. 페이지를 새로고침한 뒤 다시 로그인해주세요.', 'error');
            return;
        }

        postSubmitBtn.disabled = true;
        postSubmitBtn.textContent = editId ? '수정 중...' : '등록 중...';
        spSetStatus(statusEl, editId ? '수정 중...' : '등록 중...', 'loading');

        // 첨부 이미지 업로드 (있으면). 실패 시 저장 중단하고 버튼 복구.
        var finalImages;
        try {
            if (spNewImageFiles.length > 0) {
                spSetStatus(statusEl, '이미지 업로드 중...', 'loading');
            }
            var newImgUrls = await spUploadNewImages(spCurrentUser.id);
            finalImages = spExistingImageUrls.concat(newImgUrls);
        } catch (imgErr) {
            spSetStatus(statusEl, spErrDetail(imgErr), 'error');
            postSubmitBtn.disabled = false;
            postSubmitBtn.textContent = editId ? '수정' : '등록';
            return;
        }

        if (editId) {
            // 수정
            try {
                var resp = await spWithTimeout(
                    _supabase
                        .from('posts')
                        .update({ title: title, content: content, fb_url: fbUrl, category: category, image_urls: finalImages, updated_at: new Date().toISOString() })
                        .eq('id', Number(editId)),
                    30000, '수정'
                );
                if (resp.error) {
                    spSetStatus(statusEl, '수정 오류: ' + spErrDetail(resp.error), 'error');
                    postSubmitBtn.disabled = false;
                    postSubmitBtn.textContent = '수정';
                    return;
                }
                document.getElementById('post-title').value = '';
                document.getElementById('post-content').value = '';
                spAutoGrow(document.getElementById('post-content'));
                if (document.getElementById('post-fb-url')) document.getElementById('post-fb-url').value = '';
                spResetImages();
                postEditId.value = '';
                postSubmitBtn.textContent = '등록';
                postSubmitBtn.disabled = false;
                document.getElementById('post-form-wrap').style.display = 'none';
                document.getElementById('post-write-btn-wrap').style.display = 'block';
                spSetStatus(statusEl, '', '');
                spPostOffset = 0;
                await loadPosts(true);
            } catch (err) {
                spSetStatus(statusEl, '수정 오류: ' + spErrDetail(err), 'error');
                postSubmitBtn.disabled = false;
                postSubmitBtn.textContent = '수정';
            }
        } else {
            // 등록
            try {
                var resp = await spWithTimeout(
                    _supabase
                        .from('posts')
                        .insert({ user_id: spCurrentUser.id, title: title, content: content, fb_url: fbUrl, category: category, image_urls: finalImages }),
                    30000, '등록'
                );
                if (resp.error) {
                    spSetStatus(statusEl, '등록 오류: ' + spErrDetail(resp.error), 'error');
                    postSubmitBtn.disabled = false;
                    postSubmitBtn.textContent = '등록';
                    return;
                }
                document.getElementById('post-title').value = '';
                document.getElementById('post-content').value = '';
                spAutoGrow(document.getElementById('post-content'));
                if (document.getElementById('post-fb-url')) document.getElementById('post-fb-url').value = '';
                spResetImages();
                postSubmitBtn.textContent = '등록';
                postSubmitBtn.disabled = false;
                document.getElementById('post-form-wrap').style.display = 'none';
                document.getElementById('post-write-btn-wrap').style.display = 'block';
                spSetStatus(statusEl, '', '');
                spPostOffset = 0;
                await loadPosts(true);
            } catch (err) {
                spSetStatus(statusEl, '등록 오류: ' + spErrDetail(err), 'error');
                postSubmitBtn.disabled = false;
                postSubmitBtn.textContent = '등록';
            }
        }
    });
}

function startEditPost(postId, title, content, fbUrl, category, imageUrls) {
    document.getElementById('post-title').value = title || '';
    document.getElementById('post-content').value = content || '';
    if (document.getElementById('post-fb-url')) document.getElementById('post-fb-url').value = fbUrl || '';
    // 기존 첨부 이미지 복원 (제거 가능, 새 이미지 추가 가능)
    spNewImageFiles = [];
    spExistingImageUrls = Array.isArray(imageUrls) ? imageUrls.slice() : [];
    var imgInput = document.getElementById('post-image-input');
    if (imgInput) imgInput.value = '';
    spRenderImagePreviews();
    // 카테고리 라디오 복원
    var cat = SP_CATEGORIES.indexOf(category) !== -1 ? category : 'AI 새 소식';
    var radio = document.querySelector('input[name="post-category"][value="' + cat + '"]');
    if (radio) radio.checked = true;
    postEditId.value = postId;
    var submitBtn = document.querySelector('.post-submit-btn');
    if (submitBtn) submitBtn.textContent = '수정';
    document.getElementById('post-form-wrap').style.display = 'block';
    spAutoGrow(document.getElementById('post-content'));
    var writeBtnWrap = document.getElementById('post-write-btn-wrap');
    if (writeBtnWrap) writeBtnWrap.style.display = 'none';
    var statusEl = document.getElementById('post-status');
    spSetStatus(statusEl, '✏️ 수정 모드 — 내용을 고친 후 "수정" 버튼을 누르세요', 'loading');
    var formEl = document.getElementById('post-form-wrap');
    var navEl = document.querySelector('nav');
    var navHeight = (navEl && navEl.offsetHeight) || 70;
    var top = formEl.getBoundingClientRect().top + window.pageYOffset - navHeight - 12;
    window.scrollTo({ top: top, behavior: 'smooth' });
    setTimeout(function() {
        var titleInput = document.getElementById('post-title');
        if (titleInput) titleInput.focus();
    }, 350);
}

function cancelEditPost() {
    postForm.reset();
    spResetImages();
    postEditId.value = '';
    document.querySelector('.post-submit-btn').textContent = '등록';
    document.getElementById('post-form-wrap').style.display = 'none';
    document.getElementById('post-write-btn-wrap').style.display = 'block';
}

if (postCancelBtn) {
    postCancelBtn.addEventListener('click', cancelEditPost);
}

// ========== Load More ==========
var loadMoreBtn = document.getElementById('load-more-btn');
if (loadMoreBtn) {
    loadMoreBtn.addEventListener('click', function() {
        loadPosts(false);
    });
}

// ========== 카테고리 필터 탭 ==========
(function () {
    var bar = document.getElementById('category-filter');
    if (!bar) return;
    bar.addEventListener('click', function (e) {
        var btn = e.target.closest('.cat-tab');
        if (!btn) return;
        var cat = btn.dataset.cat || '';
        if (cat === spActiveCategory) return;
        spActiveCategory = cat;
        // 활성 표시 갱신
        bar.querySelectorAll('.cat-tab').forEach(function (b) {
            b.classList.toggle('is-active', b === btn);
        });
        spPostOffset = 0;
        loadPosts(true);
    });
})();

// ========== Init ==========
var spStartAttempts = 0;
function startSpeakUp() {
    spStartAttempts++;
    var dbReady = typeof DB !== 'undefined';
    var authReady = typeof Auth !== 'undefined';

    if ((!dbReady || !authReady) && spStartAttempts <= 10) {
        setTimeout(startSpeakUp, 500);
        return;
    }

    if (!dbReady || !authReady) {
        document.getElementById('posts-container').innerHTML =
            '<div style="text-align:center;padding:2rem;color:var(--accent-pink);">시스템 로드 실패. 페이지를 새로고침 해주세요.</div>';
        return;
    }

    spApplyBoardContext();
    spInitAuth().then(async function() {
        var params = new URLSearchParams(window.location.search);
        var sharedPostId = params.get('post');

        // 공유 링크(?post=N)가 아니면 평소대로 전체 목록만 로드
        if (!sharedPostId) {
            return loadPosts(true);
        }

        return spRenderSinglePost(Number(sharedPostId));
    }).catch(function(e) {
        console.error('SpeakUp init error:', e);
    });
}

// ========== 공유 링크(?post=N) 단독 표시 ==========
// PO 확정(2026-08-15): 이메일·게시 링크로 들어온 사람은 그 글을 읽으러 온 것이므로,
// 예전처럼 목록 맨 위에 고정해 보여주고 그 아래로 나머지 글을 이어 붙이던 방식(그래서
// 여전히 "목록처럼" 보인다는 지적을 받음) 대신 그 글 하나만 목록·필터·페이지네이션
// 없이 보여준다. 비로그인 사용자도 동일하게 봐야 한다 -- 글 조회는 RLS가 anon에도
// 열려 있어(정책: "Anyone can view posts" USING (true)) 로그인 여부를 신경 쓸 필요가
// 없다. 존재하지 않는 post 값은 목록으로 자연스럽게 떨어진다(빈 화면·에러 금지).
async function spRenderSinglePost(postId) {
    var container = document.getElementById('posts-container');
    var loginPrompt = document.getElementById('post-login-prompt');
    if (loginPrompt) loginPrompt.style.display = 'none';

    // 목록·필터·페이지네이션은 숨긴다 -- 이 글 하나만 보여줄 것이므로.
    var filterBar = document.getElementById('category-filter');
    if (filterBar) filterBar.style.display = 'none';
    var loadMoreWrap = document.getElementById('load-more-wrap');
    if (loadMoreWrap) loadMoreWrap.style.display = 'none';

    var post = null;
    try {
        post = await DB.getPost(postId);
    } catch (e) {
        post = null;
    }

    if (!post) {
        // 삭제됐거나 잘못된 id -- 숨겼던 목록 UI를 되돌리고 평소 목록으로 폴백.
        if (filterBar) filterBar.style.display = '';
        if (loadMoreWrap) loadMoreWrap.style.display = '';
        return loadPosts(true);
    }

    container.innerHTML = '';

    // "목록으로" -- 새 디자인 없이 기존 버튼 스타일(.post-action-btn) 재사용.
    var backWrap = document.createElement('div');
    backWrap.className = 'sp-back-to-list';
    var backLink = document.createElement('a');
    backLink.className = 'post-action-btn';
    backLink.textContent = '← 목록으로';
    backLink.href = 'speakup.html' + (post.category ? '?category=' + encodeURIComponent(post.category) : '');
    backWrap.appendChild(backLink);
    container.appendChild(backWrap);

    var card = await renderPostCard(post);
    var contentEl = card.querySelector('.post-content');
    // 링크로 들어온 사람은 이 글을 읽으러 온 것이므로 "더 보기" 없이 펼친 상태로.
    if (contentEl) contentEl.classList.remove('clamped');
    container.appendChild(card);

    window.scrollTo(0, 0);
}

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', startSpeakUp);
} else {
    startSpeakUp();
}
