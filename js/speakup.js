// ========== Speak Up Board ==========
let spCurrentUser = null;
let spCurrentProfile = null;
let spPostOffset = 0;
const SP_PAGE_SIZE = 10;

// ========== View Count Tracking (세션 당 1회) ==========
var _viewedPosts = [];
try { _viewedPosts = JSON.parse(sessionStorage.getItem('sp_viewed') || '[]'); } catch(e) {}

async function trackPostView(postId) {
    if (_viewedPosts.indexOf(postId) !== -1) return;
    _viewedPosts.push(postId);
    try { sessionStorage.setItem('sp_viewed', JSON.stringify(_viewedPosts)); } catch(e) {}
    // 서버 측에서 비로그인은 무시되므로 로그인 시에만 호출 (불필요한 요청 절약)
    if (!spCurrentUser) return;
    try { await DB.incrementViewCount(postId); } catch(e) {}
}

// ========== Escape HTML ==========
function spEscape(str) {
    var div = document.createElement('div');
    div.textContent = str || '';
    return div.innerHTML;
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
        '<a href="$1" target="_blank" rel="noopener noreferrer" class="post-link">$1</a>'
    );
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
        navAdminLink.style.display = (spCurrentProfile && spCurrentProfile.role === 'admin') ? 'block' : 'none';
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
}

// ========== Init Auth ==========
async function spInitAuth() {
    var session = await Auth.getSession();
    if (session) {
        spCurrentUser = session.user;
        try {
            spCurrentProfile = await DB.getProfile(spCurrentUser.id);
        } catch (e) {
            spCurrentProfile = null;
        }
    }
    spUpdateAuthUI();

    Auth.onAuthStateChange(async function(event, session) {
        if (event === 'SIGNED_IN' && session) {
            spCurrentUser = session.user;
            try {
                spCurrentProfile = await DB.getProfile(spCurrentUser.id);
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
    return spCurrentProfile && spCurrentProfile.role === 'admin';
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
        var posts = await DB.getPosts(SP_PAGE_SIZE, spPostOffset);

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
    card.className = 'post-card';
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

    var likeActive = myReaction && myReaction.reaction_type === 'like' ? ' active' : '';
    var dislikeActive = myReaction && myReaction.reaction_type === 'dislike' ? ' active' : '';

    // Action buttons for own post / admin
    var actionBtns = '';
    if (isOwnPost) {
        actionBtns = '<div class="post-actions">' +
            '<button class="post-action-btn post-edit-btn" data-post-id="' + post.id + '">수정</button>' +
            '<button class="post-action-btn post-delete-btn" data-post-id="' + post.id + '">삭제</button>' +
            '</div>';
    } else if (isAdminUser) {
        actionBtns = '<div class="post-actions">' +
            '<button class="post-action-btn post-delete-btn" data-post-id="' + post.id + '">삭제</button>' +
            '</div>';
    }

    var fbBadgeHtml = '';
    if (post.fb_url) {
        var isThreads = /threads\.(net|com)/i.test(post.fb_url);
        var badgeClass = isThreads ? 'post-fb-badge post-threads-badge' : 'post-fb-badge';
        var badgeLabel = isThreads ? '쓰레드 원본 보기' : '페이스북 원본 보기';
        var badgeIcon = isThreads
            ? '<svg viewBox="0 0 24 24" width="14" height="14" fill="currentColor" aria-hidden="true"><path d="M17.7 11.1c-.1 0-.1-.1-.2-.1-.1-1.8-1.1-2.9-2.7-2.9-1 0-1.8.4-2.3 1.2l.9.6c.4-.6.9-.7 1.4-.7.6 0 1 .2 1.3.5.2.3.4.6.4 1-.5-.1-1-.2-1.5-.2-1.7 0-2.7.9-2.7 2.2 0 .6.2 1.1.7 1.5.4.4 1 .6 1.7.6.9 0 1.5-.3 2-.9.4-.5.5-1.1.6-1.5.5.3.8.7 1 1.2.2.6.2 1.4-.1 2.1-.5 1.3-1.8 2.2-3.5 2.2-1.9 0-3.4-.7-4.3-2.1-.9-1.3-1.3-3.2-1.3-5.4 0-2.2.4-4 1.3-5.4.9-1.4 2.3-2 4.3-2 1.9 0 3.4.7 4.4 2 .5.7.9 1.5 1.1 2.5l1.1-.3c-.3-1.2-.7-2.2-1.4-3-1.2-1.5-2.9-2.4-5.1-2.4S6.7 4.6 5.5 6.3C4.4 8 3.9 10.1 3.9 12.4c0 2.4.5 4.4 1.6 6 1.2 1.7 2.9 2.5 5.1 2.5 2.1 0 3.7-.8 4.6-2.4.4-.7.7-1.5.8-2.4.1-.5 0-1 0-1.5-.1-.6-.4-1.1-1-1.5zm-3 2.4c-.1.3-.3.6-.5.7-.3.2-.6.3-1 .3-.4 0-.7-.1-.9-.3-.2-.2-.3-.4-.3-.7 0-.7.7-1.1 1.6-1.1.4 0 .8 0 1.2.1 0 .4-.1.7-.1 1z"/></svg>'
            : '<svg viewBox="0 0 24 24" width="14" height="14" fill="currentColor" aria-hidden="true"><path d="M22 12a10 10 0 1 0-11.56 9.88v-6.99H7.9V12h2.54V9.8c0-2.5 1.49-3.89 3.77-3.89 1.09 0 2.24.2 2.24.2v2.46h-1.26c-1.24 0-1.63.77-1.63 1.56V12h2.78l-.44 2.89h-2.34v6.99A10 10 0 0 0 22 12z"/></svg>';
        fbBadgeHtml =
            '<a href="' + spEscape(post.fb_url) + '" target="_blank" rel="noopener noreferrer" class="' + badgeClass + '" title="' + badgeLabel + '">' +
                badgeIcon +
                '<span>' + badgeLabel + '</span>' +
            '</a>';
    }

    card.innerHTML =
        '<div class="post-header">' +
            '<div class="post-author-info">' +
                '<div class="post-avatar">' + spEscape(authorName.charAt(0)) + '</div>' +
                '<div>' +
                    '<div class="post-author">' + spEscape(authorName) + '</div>' +
                    '<div class="post-time">' + timeAgo(post.created_at) + '</div>' +
                '</div>' +
            '</div>' +
            actionBtns +
        '</div>' +
        '<div class="post-body">' +
            '<h3 class="post-title">' + spEscape(post.title) + '</h3>' +
            '<div class="post-content">' + linkify(post.content).replace(/\n/g, '<br>') + '</div>' +
            fbBadgeHtml +
        '</div>' +
        '<div class="post-footer">' +
            '<div class="post-reactions">' +
                '<button class="reaction-btn like-btn' + likeActive + '" data-post-id="' + post.id + '" data-type="like">' +
                    '👍 <span class="like-count">' + reactionData.likes + '</span>' +
                '</button>' +
                '<button class="reaction-btn dislike-btn' + dislikeActive + '" data-post-id="' + post.id + '" data-type="dislike">' +
                    '👎 <span class="dislike-count">' + reactionData.dislikes + '</span>' +
                '</button>' +
            '</div>' +
            '<div class="post-footer-right">' +
                '<span class="post-view-count">👁 <span class="view-count-num">' + (post.view_count || 0) + '</span></span>' +
                '<button class="post-share-btn" data-post-id="' + post.id + '" title="링크 복사">공유</button>' +
                '<button class="comment-toggle-btn" data-post-id="' + post.id + '">' +
                    '💬 댓글 <span class="comment-count">' + commentCount + '</span>' +
                '</button>' +
            '</div>' +
        '</div>' +
        '<div class="comments-section" id="comments-' + post.id + '" style="display:none;">' +
            '<div class="comments-list" id="comments-list-' + post.id + '"></div>' +
            (spCurrentUser ?
                '<div class="comment-form-wrap">' +
                    '<form class="comment-form" data-post-id="' + post.id + '">' +
                        '<input type="text" class="comment-input" placeholder="댓글을 입력하세요" required maxlength="1000">' +
                        '<button type="submit" class="btn-primary comment-submit-btn">등록</button>' +
                    '</form>' +
                '</div>' : '') +
        '</div>';

    // 조회수 트래킹 (fire and forget)
    trackPostView(post.id);

    // Bind events
    bindPostCardEvents(card, post);
    return card;
}

// ========== Bind post card events ==========
function bindPostCardEvents(card, post) {
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
            var url = window.location.origin + window.location.pathname + '?post=' + postId;
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

    // Edit button
    var editBtn = card.querySelector('.post-edit-btn');
    if (editBtn) {
        editBtn.addEventListener('click', function(e) {
            e.preventDefault();
            e.stopPropagation();
            var postId = parseInt(editBtn.dataset.postId);
            try {
                startEditPost(postId, post.title, post.content, post.fb_url || '');
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
            listEl.innerHTML = '<div class="speakup-empty" style="padding:0.5rem;font-size:0.85rem;">댓글이 없습니다.</div>';
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
        '<button class="comment-reply-btn" data-comment-id="' + comment.id + '">답글</button>' : '';

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
                    '<input type="text" class="comment-input reply-input" placeholder="답글을 입력하세요" required maxlength="1000">' +
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

        if (!title || !content) {
            spSetStatus(statusEl, '제목과 내용을 모두 입력해주세요.', 'error');
            return;
        }

        // 페이스북 / 쓰레드 링크 검증 (선택 입력 — 비어있으면 통과)
        var fbUrl = null;
        if (fbUrlRaw) {
            if (!/^https?:\/\/(www\.|m\.|web\.|business\.)?(facebook\.com|fb\.com|fb\.watch|threads\.net|threads\.com)\//i.test(fbUrlRaw)) {
                spSetStatus(statusEl, '페이스북 또는 쓰레드 링크만 가능합니다. (facebook.com / fb.com / fb.watch / threads.net)', 'error');
                return;
            }
            fbUrl = fbUrlRaw;
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

        if (editId) {
            // 수정
            try {
                var resp = await spWithTimeout(
                    _supabase
                        .from('posts')
                        .update({ title: title, content: content, fb_url: fbUrl, updated_at: new Date().toISOString() })
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
                        .insert({ user_id: spCurrentUser.id, title: title, content: content, fb_url: fbUrl }),
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

function startEditPost(postId, title, content, fbUrl) {
    document.getElementById('post-title').value = title || '';
    document.getElementById('post-content').value = content || '';
    if (document.getElementById('post-fb-url')) document.getElementById('post-fb-url').value = fbUrl || '';
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

    spInitAuth().then(async function() {
        var params = new URLSearchParams(window.location.search);
        var sharedPostId = params.get('post');

        // 공유 링크(?post=N)가 아니면 평소대로 전체 목록만 로드
        if (!sharedPostId) {
            return loadPosts(true);
        }

        // --- 공유 링크 접속: 해당 글을 페이지 최상단에 바로 표시 ---
        var container = document.getElementById('posts-container');
        var loginPrompt = document.getElementById('post-login-prompt');
        if (loginPrompt) loginPrompt.style.display = 'none';  // 글쓰기 안내 숨김

        var pinned = false;
        try {
            var post = await DB.getPost(Number(sharedPostId));
            if (post) {
                container.innerHTML = '';
                var card = await renderPostCard(post);
                card.classList.add('post-highlighted');
                container.appendChild(card);          // 공유 글을 맨 위에 고정
                window.scrollTo(0, 0);                // 그 글이 바로 보이도록 최상단
                pinned = true;
                setTimeout(function () { card.classList.remove('post-highlighted'); }, 3000);
            }
        } catch (e) {
            // 글이 삭제됐거나 존재하지 않음 → 일반 목록으로 폴백
        }

        // 나머지 글은 공유 글 아래로 이어붙인다 (공유 글 중복 제외)
        return loadPosts(true, pinned ? Number(sharedPostId) : null);
    }).catch(function(e) {
        console.error('SpeakUp init error:', e);
    });
}

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', startSpeakUp);
} else {
    startSpeakUp();
}
