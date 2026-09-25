// ========== AI 툴 마켓 리뷰·댓글 (market/<앱id>/reviews.html) — 툴 공통. body[data-app] 이 app_code ==========
// API: /api/reviews · /api/review-comments · /api/review-report · /api/review-admin (설계: 브릿지 2026_09_21__PC2안_마켓리뷰댓글_시안.md)
// 인라인 스크립트는 CSP 가 막으므로 전부 이 파일에 둔다. 관리 키는 sessionStorage 에만(URL·localStorage 금지).
(function () {
    'use strict';
    var $ = function (id) { return document.getElementById(id); };
    var APP = document.body.getAttribute('data-app') || 'onemacs';
    var qs = new URLSearchParams(location.search);
    var sort = 'new', page = 1, items = [], stars = 0, manageToken = qs.get('manage') || '', admin = false, adminKey = '';
    var reportTarget = null;

    function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
    function show(n, on) { if (!n) return; if (on) n.removeAttribute('hidden'); else n.setAttribute('hidden', ''); }
    function setMsg(n, msg, ok) { if (!n) return; n.textContent = msg || ''; n.classList.toggle('ok', !!ok); show(n, !!msg); }
    function date(iso) { if (!iso) return ''; var d = new Date(iso); return isNaN(d) ? '' : d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0'); }
    function starHtml(n) { n = n || 0; var s = ''; for (var i = 1; i <= 5; i++) s += '<span' + (i > n ? ' class="off"' : '') + '>★</span>'; return '<span class="stars" aria-label="' + (n ? n + '점' : '별점 없음') + '">' + s + '</span>'; }
    async function api(url, opt) {
        var o = Object.assign({ headers: {} }, opt || {});
        if (o.body && typeof o.body !== 'string') { o.body = JSON.stringify(o.body); o.headers['Content-Type'] = 'application/json'; }
        if (admin && adminKey) o.headers['X-Admin-Key'] = adminKey;
        var r = await fetch(url, o); var d = null; try { d = await r.json(); } catch (e) { d = null; }
        if (!r.ok || !d || d.success === false) { var err = new Error((d && d.error) || '처리 중 오류가 생겼습니다. 잠시 후 다시 시도해 주세요.'); err.status = r.status; err.data = d; throw err; }
        return d;
    }

    // ---------- 요약 ----------
    function renderSummary(s) {
        var count = s.count || 0;
        var tab = $('rv-tab-count'); if (tab) tab.textContent = count ? String(count) : '';
        if (!count) { show($('rv-summary'), false); return; }
        show($('rv-summary'), true);
        $('rv-avg').textContent = s.avg == null ? '-' : Number(s.avg).toFixed(1);
        $('rv-count-label').textContent = '리뷰 ' + count.toLocaleString('ko-KR') + '개';
        $('rv-avg-stars').innerHTML = s.avg == null ? '' : starHtml(Math.round(Number(s.avg)));
        var rated = [5, 4, 3, 2, 1].reduce(function (a, k) { return a + (s.dist[k] || 0); }, 0) || 1;
        $('rv-dist').innerHTML = [5, 4, 3, 2, 1].map(function (k) { var n = s.dist[k] || 0; return '<div><span>' + k + '점</span><i><b style="width:' + Math.round(n / rated * 100) + '%"></b></i><span>' + n + '</span></div>'; }).join('');
    }

    // ---------- 목록 ----------
    function card(r) {
        var state = r.status && r.status !== 'published' ? '<span class="badge-state">' + (r.status === 'pending' ? '확인 대기' : r.status === 'hidden' ? '숨김' : r.status) + '</span>' : '';
        return '<div class="rv" id="r-' + esc(r.id) + '" data-id="' + esc(r.id) + '">' +
            '<div class="hd"><div><span class="nick">' + esc(r.nick) + '</span>' + (r.verifiedBuy ? '<span class="badge-buy">구매 확인</span>' : '') + state +
            '<div class="meta">' + esc(date(r.publishedAt || r.createdAt)) + (r.edited ? ' · 고침' : '') + (admin && r.reportCount ? ' · 신고 ' + r.reportCount + '건' : '') + '</div></div>' + starHtml(r.stars) + '</div>' +
            '<p class="body">' + esc(r.body) + '</p>' + (admin && r.pendingBody ? '<p class="body" style="border-left:3px solid var(--warn);padding-left:10px">수정 대기: ' + esc(r.pendingBody) + '</p>' : '') +
            '<div class="ft"><button type="button" class="cm-toggle" data-id="' + esc(r.id) + '">댓글 ' + (r.commentCount || 0) + ' ▼</button>' +
            '<span class="adm">' + (admin ? (r.status === 'hidden' ? '<button type="button" class="adm-act" data-act="restore" data-kind="review" data-id="' + esc(r.id) + '">복구</button>' : '<button type="button" class="adm-act" data-act="hide" data-kind="review" data-id="' + esc(r.id) + '">숨김</button>') +
            '<button type="button" class="adm-act" data-act="delete" data-kind="review" data-id="' + esc(r.id) + '">지우기</button><button type="button" class="adm-reply" data-id="' + esc(r.id) + '">판매자 답글</button>' : '') + '</span>' +
            '<button type="button" class="report" data-kind="review" data-id="' + esc(r.id) + '">신고</button></div>' +
            '<div class="cm" id="cm-' + esc(r.id) + '" hidden></div></div>';
    }
    async function load(reset) {
        if (reset) { page = 1; items = []; $('rv-list').innerHTML = ''; }
        var d = admin ? await api('/api/review-admin?app=' + encodeURIComponent(APP)) : await api('/api/reviews?app=' + encodeURIComponent(APP) + '&sort=' + sort + '&page=' + page);
        if (!admin) renderSummary(d.summary);
        items = items.concat(d.items || []);
        $('rv-list').insertAdjacentHTML('beforeend', (d.items || []).map(card).join(''));
        show($('rv-empty'), !items.length);
        show($('rv-more'), !!d.hasMore);
        if (admin && d.comments) { window.__adminComments = d.comments; }
        var v = qs.get('verified');
        if (v && reset) { var el = $('r-' + v); if (el) { el.classList.add('hl'); setTimeout(function () { el.scrollIntoView({ behavior: 'smooth', block: 'center' }); }, 100); } }
        if (location.hash.indexOf('#c-') === 0 && reset) { var rid = v; if (rid) toggleComments(rid, true); }
    }

    // ---------- 댓글 ----------
    function cHtml(c, reviewId) {
        return '<div class="c' + (c.parentId ? ' reply' : '') + '" id="c-' + esc(c.id) + '"><span class="nick">' + esc(c.nick) + '</span>' + (c.isSeller ? '<span class="badge-seller">판매자</span>' : '') +
            (c.status && c.status !== 'published' ? '<span class="badge-state">' + (c.status === 'pending' ? '확인 대기' : '숨김') + '</span>' : '') +
            '<span class="meta">' + esc(date(c.publishedAt || c.createdAt)) + '</span><p>' + esc(c.body) + '</p>' +
            '<div class="act">' + (!c.parentId ? '<button type="button" class="c-reply" data-review="' + esc(reviewId) + '" data-parent="' + esc(c.id) + '" data-nick="' + esc(c.nick) + '">답글</button>' : '') +
            '<button type="button" class="report" data-kind="comment" data-id="' + esc(c.id) + '">신고</button>' +
            (admin ? '<button type="button" class="adm adm-act" data-act="' + (c.status === 'hidden' ? 'restore' : 'hide') + '" data-kind="comment" data-id="' + esc(c.id) + '">' + (c.status === 'hidden' ? '복구' : '숨김') + '</button>' +
                     (!c.parentId ? '<button type="button" class="adm adm-reply" data-id="' + esc(reviewId) + '" data-parent="' + esc(c.id) + '">판매자 답글</button>' : '') : '') + '</div></div>';
    }
    async function toggleComments(reviewId, forceOpen) {
        var box = $('cm-' + reviewId), btn = document.querySelector('.cm-toggle[data-id="' + reviewId + '"]');
        if (!box) return;
        var open = box.hasAttribute('hidden');
        if (!open && !forceOpen) { show(box, false); if (btn) btn.textContent = btn.textContent.replace('▲', '▼'); return; }
        show(box, true); if (btn) btn.textContent = btn.textContent.replace('▼', '▲');
        box.innerHTML = '<div class="loading">댓글을 불러오는 중…</div>';
        try {
            var list = admin ? (window.__adminComments || []).filter(function (c) { return c.reviewId === reviewId; }) : (await api('/api/review-comments?review=' + encodeURIComponent(reviewId))).items;
            var parents = list.filter(function (c) { return !c.parentId; }), html = '';
            parents.forEach(function (p) { html += cHtml(p, reviewId); list.filter(function (c) { return c.parentId === p.id; }).forEach(function (c) { html += cHtml(c, reviewId); }); });
            box.innerHTML = (html || '<div class="loading">아직 댓글이 없습니다.</div>') + '<div class="cwrite" id="cw-' + esc(reviewId) + '"><button type="button" class="c-reply" data-review="' + esc(reviewId) + '" style="background:none;border:0;color:var(--link);font-weight:700;font-family:inherit;font-size:13px;padding:0;cursor:pointer">댓글 남기기</button></div>';
            if (btn) btn.textContent = '댓글 ' + list.length + ' ▲';
            if (location.hash.indexOf('#c-') === 0) { var t = document.querySelector(location.hash); if (t) { t.classList.add('hl'); t.scrollIntoView({ behavior: 'smooth', block: 'center' }); } }
        } catch (e) { box.innerHTML = '<div class="loading">' + esc(e.message) + '</div>'; }
    }
    function openCommentForm(reviewId, parentId, toNick) {
        var host = $('cw-' + reviewId); if (!host) return;
        host.innerHTML = '<div class="to">' + (parentId ? esc(toNick) + ' 님에게 답글' : '이 리뷰에 댓글') + ' — 확인 메일의 버튼을 누르면 게시됩니다</div>' +
            '<input class="cw-nick" placeholder="닉네임" maxlength="20"><input class="cw-email" type="email" placeholder="이메일 주소 (공개되지 않습니다)"><textarea class="cw-body" maxlength="500" placeholder="내용 (2~500자)"></textarea>' +
            '<div class="hp" aria-hidden="true"><input class="cw-web" tabindex="-1" autocomplete="off"></div>' +
            '<div class="msg" hidden></div><div class="row"><button type="button" class="cw-send">올리기</button><button type="button" class="ghost cw-cancel">취소</button></div>';
        host.querySelector('.cw-nick').focus();
        host.querySelector('.cw-cancel').addEventListener('click', function () { toggleComments(reviewId, true); });
        host.querySelector('.cw-send').addEventListener('click', async function () {
            var msg = host.querySelector('.msg'); var b = this; b.disabled = true;
            try {
                await api('/api/review-comments', { method: 'POST', body: { review: reviewId, parent: parentId || null, nick: host.querySelector('.cw-nick').value.trim(), email: host.querySelector('.cw-email').value.trim(), body: host.querySelector('.cw-body').value.trim(), website: host.querySelector('.cw-web').value } });
                host.innerHTML = '<div class="msg ok">확인 메일을 보냈습니다. 메일의 버튼을 누르면 댓글이 게시됩니다.</div>';
            } catch (e) { setMsg(msg, e.message); b.disabled = false; }
        });
    }

    // ---------- 리뷰 남기기 / 고치기 / 지우기 ----------
    function paintStars() { Array.prototype.forEach.call($('rv-pick').querySelectorAll('button'), function (b) { b.classList.toggle('on', parseInt(b.getAttribute('data-star'), 10) <= stars); b.setAttribute('aria-pressed', parseInt(b.getAttribute('data-star'), 10) === stars ? 'true' : 'false'); }); }
    function enterEditMode() {
        $('rv-form-title').textContent = '내 리뷰 고치기';
        $('rv-submit').textContent = '고친 내용으로 바꾸기';
        $('rv-form-note').textContent = '리뷰를 남길 때 사용한 이메일을 적고 바꿀 내용만 채우세요. 확인 메일의 버튼을 누르면 게시된 리뷰가 고친 내용으로 바뀝니다(그 전까지는 지금 리뷰가 그대로 보입니다).';
        $('rv-body').placeholder = '바꿀 내용 (비워 두면 지금 내용 그대로)';
        $('rv-nick').placeholder = '바꿀 닉네임 (비워 두면 그대로)';
        show($('rv-delete'), true);
        setTimeout(function () { $('write').scrollIntoView({ behavior: 'smooth', block: 'start' }); }, 100);
    }
    async function submitReview(e) {
        e.preventDefault();
        var err = $('rv-error'); setMsg(err, '');
        var nick = $('rv-nick').value.trim(), email = $('rv-email').value.trim(), body = $('rv-body').value.trim();
        if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) { setMsg(err, '이메일 주소를 확인해 주세요.'); $('rv-email').focus(); return; }
        if (!manageToken) {
            if (Array.from(nick).length < 2) { setMsg(err, '닉네임을 2자 이상 적어 주세요.'); $('rv-nick').focus(); return; }
            if (Array.from(body).length < 10) { setMsg(err, '내용을 10자 이상 적어 주세요.'); $('rv-body').focus(); return; }
        } else if (!nick && !body && !stars) { setMsg(err, '바꿀 내용을 적어 주세요.'); return; }
        var btn = $('rv-submit'); btn.disabled = true;
        try {
            var payload = manageToken ? { action: 'edit', manage: manageToken, email: email, nick: nick || null, body: body || null, stars: stars || null }
                                      : { app: APP, nick: nick, email: email, body: body, stars: stars || null, website: $('rv-website').value };
            await api('/api/reviews', { method: 'POST', body: payload });
            show($('rv-form'), false); show($('rv-form-note'), false); show($('rv-sent'), true);
            $('rv-sent-note').textContent = manageToken ? '메일의 버튼을 누르면 고친 내용으로 바뀝니다. 메일이 안 보이면 스팸함을 확인해 주세요.' : '메일의 버튼을 누르면 리뷰가 게시됩니다. 메일이 안 보이면 스팸함을 확인해 주세요.';
            if (manageToken) { manageToken = ''; history.replaceState(null, '', location.pathname); }
        } catch (ex) {
            if (ex.data && ex.data.duplicate) { setMsg(err, ex.message + ' 아래 "내 리뷰 고치기·지우기"에서 확인 메일을 받으세요.'); $('manage').scrollIntoView({ behavior: 'smooth' }); }
            else setMsg(err, ex.message);
            btn.disabled = false;
        }
    }
    async function deleteReview() {
        var err = $('rv-error'); setMsg(err, '');
        var email = $('rv-email').value.trim();
        if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) { setMsg(err, '리뷰를 남길 때 사용한 이메일을 적어 주세요.'); $('rv-email').focus(); return; }
        if (!window.confirm('리뷰를 지우면 댓글도 함께 보이지 않습니다. 확인 메일을 보낼까요?')) return;
        var b = $('rv-delete'); b.disabled = true;
        try {
            await api('/api/reviews', { method: 'POST', body: { action: 'delete', manage: manageToken, email: email } });
            show($('rv-form'), false); show($('rv-form-note'), false); show($('rv-sent'), true);
            $('rv-sent-note').textContent = '메일의 버튼을 누르면 리뷰가 지워집니다.';
            manageToken = ''; history.replaceState(null, '', location.pathname);
        } catch (ex) { setMsg(err, ex.message); b.disabled = false; }
    }
    async function manage(e) {
        e.preventDefault();
        var msg = $('rv-manage-msg'); setMsg(msg, '');
        var email = $('rv-manage-email').value.trim();
        if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) { setMsg(msg, '이메일 주소를 확인해 주세요.'); return; }
        var b = $('rv-manage-btn'); b.disabled = true;
        try { await api('/api/reviews', { method: 'POST', body: { action: 'manage', app: APP, email: email } }); setMsg(msg, '확인 메일을 보냈습니다. 메일의 버튼을 누르면 이 페이지에서 고치거나 지울 수 있습니다.', true); }
        catch (ex) { setMsg(msg, ex.message); }
        b.disabled = false;
    }

    // ---------- 신고 ----------
    function openReport(kind, id) { reportTarget = { kind: kind, id: id }; Array.prototype.forEach.call(document.querySelectorAll('input[name=rv-reason]'), function (i) { i.checked = false; }); setMsg($('rv-report-msg'), ''); show($('rv-report'), true); }
    async function sendReport() {
        var sel = document.querySelector('input[name=rv-reason]:checked'); var msg = $('rv-report-msg');
        if (!sel) { setMsg(msg, '신고 사유를 골라 주세요.'); return; }
        var b = $('rv-report-send'); b.disabled = true;
        try { var d = await api('/api/review-report', { method: 'POST', body: { kind: reportTarget.kind, id: reportTarget.id, reason: sel.value } });
              setMsg(msg, d.already ? '이미 신고하셨습니다.' : d.hidden ? '신고가 접수되어 이 내용이 가려졌습니다.' : '신고가 접수되었습니다.', true); setTimeout(function () { show($('rv-report'), false); if (d.hidden) load(true); }, 1200); }
        catch (e) { setMsg(msg, e.message); }
        b.disabled = false;
    }

    // ---------- 관리 모드 ----------
    async function adminAct(act, kind, id) {
        var label = { hide: '숨김', restore: '복구', delete: '지우기(되돌릴 수 없음)' }[act];
        if (!window.confirm(kind === 'comment' ? '이 댓글을 ' + label + ' 처리할까요?' : '이 리뷰를 ' + label + ' 처리할까요? (리뷰를 숨기면 댓글도 함께 가려집니다)')) return;
        try { await api('/api/review-admin', { method: 'POST', body: { action: act, kind: kind, id: id } }); await load(true); } catch (e) { window.alert(e.message); }
    }
    async function sellerReply(reviewId, parentId) {
        var body = window.prompt('판매자 답글 내용 (닉네임은 "파인더월드", 판매자 배지가 붙습니다)'); if (!body || !body.trim()) return;
        try { await api('/api/review-admin', { method: 'POST', body: { action: 'seller-reply', review: reviewId, parent: parentId || null, body: body.trim() } }); await load(true); toggleComments(reviewId, true); } catch (e) { window.alert(e.message); }
    }
    function initAdmin() {
        if (qs.get('admin') !== '1') return;
        try { adminKey = sessionStorage.getItem('waat-review-admin') || ''; } catch (e) { adminKey = ''; }
        if (!adminKey) { adminKey = window.prompt('관리 키를 입력하세요 (이 탭에서만 기억합니다)') || ''; if (!adminKey) return; try { sessionStorage.setItem('waat-review-admin', adminKey); } catch (e) { /* ignore */ } }
        admin = true; document.body.classList.add('admin');
        $('rv-list').insertAdjacentHTML('beforebegin', '<div class="admin-bar">관리 모드 — 확인 대기·숨김 리뷰가 모두 보입니다. 숨김/복구/지우기·판매자 답글은 바로 반영됩니다. <button type="button" id="rv-admin-out" style="margin-left:8px;background:none;border:1px solid var(--warn-line);color:var(--warn);border-radius:8px;padding:2px 8px;font-family:inherit;cursor:pointer">나가기</button></div>');
        $('rv-admin-out').addEventListener('click', function () { try { sessionStorage.removeItem('waat-review-admin'); } catch (e) { /* ignore */ } location.href = location.pathname; });
        show($('rv-sort'), false);
    }

    // ---------- 시작 ----------
    function init() {
        initAdmin();
        if (qs.get('verified')) setMsg($('rv-flash'), qs.get('edited') ? '고친 내용으로 바뀌었습니다.' : '리뷰가 게시되었습니다. 고맙습니다.', true);
        if (qs.get('deleted')) setMsg($('rv-flash'), '리뷰를 지웠습니다.', true);
        if (manageToken) enterEditMode();
        $('rv-sort').addEventListener('click', function (e) { var b = e.target.closest('[data-sort]'); if (!b) return; sort = b.getAttribute('data-sort'); Array.prototype.forEach.call($('rv-sort').querySelectorAll('button'), function (x) { x.classList.toggle('on', x === b); }); load(true); });
        $('rv-more').addEventListener('click', function () { page += 1; load(false); });
        $('rv-pick').addEventListener('click', function (e) { var b = e.target.closest('[data-star]'); if (!b) return; var n = parseInt(b.getAttribute('data-star'), 10); stars = stars === n ? 0 : n; paintStars(); });
        $('rv-body').addEventListener('input', function () { $('rv-cnt').textContent = Array.from($('rv-body').value).length.toLocaleString('ko-KR'); });
        $('rv-form').addEventListener('submit', submitReview);
        $('rv-delete').addEventListener('click', deleteReview);
        $('rv-manage-form').addEventListener('submit', manage);
        $('rv-report-send').addEventListener('click', sendReport);
        $('rv-report-close').addEventListener('click', function () { show($('rv-report'), false); });
        document.addEventListener('click', function (e) {
            var t = e.target.closest('.cm-toggle'); if (t) return toggleComments(t.getAttribute('data-id'));
            t = e.target.closest('.c-reply'); if (t) return openCommentForm(t.getAttribute('data-review'), t.getAttribute('data-parent') || null, t.getAttribute('data-nick') || '');
            t = e.target.closest('.report'); if (t) return openReport(t.getAttribute('data-kind'), t.getAttribute('data-id'));
            t = e.target.closest('.adm-act'); if (t && admin) return adminAct(t.getAttribute('data-act'), t.getAttribute('data-kind'), t.getAttribute('data-id'));
            t = e.target.closest('.adm-reply'); if (t && admin) return sellerReply(t.getAttribute('data-id'), t.getAttribute('data-parent') || null);
        });
        load(true).catch(function (e) { $('rv-list').innerHTML = '<div class="empty">' + esc(e.message) + '</div>'; });
    }
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init); else init();
})();
