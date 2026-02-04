// ========== Speak Up Board ==========
let spCurrentUser = null;
let spCurrentProfile = null;
let spPostOffset = 0;
const SP_PAGE_SIZE = 10;

// ========== Escape HTML ==========
function spEscape(str) {
    var div = document.createElement('div');
    div.textContent = str || '';
    return div.innerHTML;
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
document.querySelector('.mobile-menu-btn').addEventListener('click', function() {
    document.querySelector('.nav-links').classList.toggle('show');
});

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
async function loadPosts(reset) {
    var container = document.getElementById('posts-container');
    var loadMoreWrap = document.getElementById('load-more-wrap');

    if (reset) {
        spPostOffset = 0;
        container.innerHTML = '<div class="admin-loading">게시글을 불러오는 중...</div>';
    }

    try {
        var posts = await DB.getPosts(SP_PAGE_SIZE, spPostOffset);

        if (reset && posts.length === 0) {
            container.innerHTML = '<div class="speakup-empty">아직 게시글이 없습니다. 첫 글을 작성해보세요!</div>';
            loadMoreWrap.style.display = 'none';
            return;
        }

        if (reset) container.innerHTML = '';

        for (var i = 0; i < posts.length; i++) {
            var postEl = await renderPostCard(posts[i]);
            container.appendChild(postEl);
        }

        spPostOffset += posts.length;
        loadMoreWrap.style.display = posts.length < SP_PAGE_SIZE ? 'none' : 'block';
    } catch (e) {
        console.error('loadPosts error:', e);
        if (reset) {
            container.innerHTML = '<div style="text-align:center;padding:2rem;color:var(--accent-pink);">게시글 로드 오류: ' + (e.message || e) + '</div>';
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
            '<button class="comment-toggle-btn" data-post-id="' + post.id + '">' +
                '💬 댓글 <span class="comment-count">' + commentCount + '</span>' +
            '</button>' +
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

    // Comment form — submit 이벤트 + 버튼 클릭 이벤트 모두 바인딩
    var commentForm = card.querySelector('.comment-form');
    if (commentForm) {
        var commentSubmitHandler = async function(e) {
            if (e) e.preventDefault();
            var postId = parseInt(commentForm.dataset.postId);
            var input = commentForm.querySelector('.comment-input');
            var content = input.value.trim();
            if (!content) return;
            var submitBtn = commentForm.querySelector('.comment-submit-btn');
            submitBtn.disabled = true;
            try {
                console.log('Creating comment:', { postId: postId, userId: spCurrentUser.id });
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
        };
        commentForm.addEventListener('submit', commentSubmitHandler);
        // 버튼 직접 클릭도 처리
        var cSubmitBtn = commentForm.querySelector('.comment-submit-btn');
        if (cSubmitBtn) {
            cSubmitBtn.addEventListener('click', function(e) {
                e.preventDefault();
                commentSubmitHandler(e);
            });
        }
    }

    // Edit button
    var editBtn = card.querySelector('.post-edit-btn');
    if (editBtn) {
        editBtn.addEventListener('click', function() {
            var postId = parseInt(editBtn.dataset.postId);
            startEditPost(postId, post.title, post.content);
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
                var input = form.querySelector('.reply-input');
                var content = input.value.trim();
                if (!content) return;
                var submitBtn = form.querySelector('.comment-submit-btn');
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
        document.getElementById('post-title').focus();
    });
}

// ========== Post Form (Create / Edit) ==========
var postForm = document.getElementById('post-form');
var postEditId = document.getElementById('post-edit-id');
var postCancelBtn = document.getElementById('post-cancel-btn');
var postSubmitBtn = document.getElementById('post-submit-btn');

// form submit 막기
if (postForm) {
    postForm.addEventListener('submit', function(e) { e.preventDefault(); });
}

// 등록/수정 버튼 클릭
if (postSubmitBtn) {
    postSubmitBtn.addEventListener('click', async function() {
        var title = document.getElementById('post-title').value.trim();
        var content = document.getElementById('post-content').value.trim();
        var editId = postEditId.value;

        if (!title || !content) {
            alert('제목과 내용을 모두 입력해주세요.');
            return;
        }

        postSubmitBtn.disabled = true;
        postSubmitBtn.textContent = editId ? '수정 중...' : '등록 중...';

        if (editId) {
            // 수정
            try {
                console.log('Updating post:', editId, 'User:', spCurrentUser.id);
                var resp = await _supabase
                    .from('posts')
                    .update({ title: title, content: content, updated_at: new Date().toISOString() })
                    .eq('id', Number(editId));
                console.log('Update response:', resp);
                if (resp.error) {
                    console.error('Update error:', resp.error);
                    alert('수정 오류: ' + resp.error.message);
                    postSubmitBtn.disabled = false;
                    postSubmitBtn.textContent = '수정';
                    return;
                }
                // 성공 시 affected rows 확인
                if (resp.status === 204 || resp.statusText === 'No Content') {
                    console.log('Update successful (204 No Content)');
                }
                document.getElementById('post-title').value = '';
                document.getElementById('post-content').value = '';
                postEditId.value = '';
                postSubmitBtn.textContent = '등록';
                postSubmitBtn.disabled = false;
                document.getElementById('post-form-wrap').style.display = 'none';
                document.getElementById('post-write-btn-wrap').style.display = 'block';
                spPostOffset = 0;
                await loadPosts(true);
                alert('수정되었습니다.');
            } catch (err) {
                alert('수정 오류: ' + (err.message || err));
                postSubmitBtn.disabled = false;
                postSubmitBtn.textContent = '수정';
            }
        } else {
            // 등록
            try {
                var resp = await _supabase
                    .from('posts')
                    .insert({ user_id: spCurrentUser.id, title: title, content: content });
                if (resp.error) {
                    alert('등록 오류: ' + resp.error.message);
                    postSubmitBtn.disabled = false;
                    postSubmitBtn.textContent = '등록';
                    return;
                }
                document.getElementById('post-title').value = '';
                document.getElementById('post-content').value = '';
                postSubmitBtn.textContent = '등록';
                postSubmitBtn.disabled = false;
                document.getElementById('post-form-wrap').style.display = 'none';
                document.getElementById('post-write-btn-wrap').style.display = 'block';
                spPostOffset = 0;
                await loadPosts(true);
                alert('게시글이 등록되었습니다.');
            } catch (err) {
                alert('등록 오류: ' + (err.message || err));
                postSubmitBtn.disabled = false;
                postSubmitBtn.textContent = '등록';
            }
        }
    });
}

function startEditPost(postId, title, content) {
    document.getElementById('post-title').value = title;
    document.getElementById('post-content').value = content;
    postEditId.value = postId;
    document.querySelector('.post-submit-btn').textContent = '수정';
    document.getElementById('post-form-wrap').style.display = 'block';
    document.getElementById('post-write-btn-wrap').style.display = 'none';
    var formEl = document.getElementById('post-form-wrap');
    var navHeight = document.querySelector('nav').offsetHeight || 70;
    var top = formEl.getBoundingClientRect().top + window.pageYOffset - navHeight - 20;
    window.scrollTo({ top: top, behavior: 'smooth' });
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

    spInitAuth().then(function() {
        return loadPosts(true);
    }).catch(function(e) {
        console.error('SpeakUp init error:', e);
    });
}

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', startSpeakUp);
} else {
    startSpeakUp();
}
