// ========== 앱 마켓 (market.html) — 주문·결제 안내·다운로드 ==========
//
// 흐름
//   #buy 주문 폼 → create_app_order() RPC → 주문번호 발급
//   → 결제 안내(카카오페이: 폰=송금 링크 / PC=QR 이미지 · 계좌이체: 계좌 복사)
//   → 15초마다 get_app_order() 로 상태 확인 → paid 가 되면 같은 화면에 다운로드 버튼 + 라이선스 키
//   (관리자가 admin.html 앱 주문 탭에서 [입금 확인]을 누르면 paid 가 된다)
//
// 보안 원칙 (supabase-config.js 의 2026-09-02 방침과 동일)
//   · 브라우저는 app_orders / app_settings 테이블을 직접 읽지 않는다. RPC 만 쓴다.
//   · 다운로드 주소·라이선스 키는 get_app_order() 가 status=paid 일 때만 돌려준다.
//   · 주문 조회에는 주문번호 + 연락처가 모두 필요하다. 연락처는 이 브라우저의
//     localStorage 에만 저장해(다른 기기에서 열면 다시 입력) 링크만 새어도 조회가 안 되게 한다.
//
// Google Sheets 미러링: 주문 생성 직후 POST /api/market/sheet-sync { order_no, contact } 를 한 번 부른다.
//   실패해도 무시(콘솔 로그만). 정본은 Supabase.
//
// 이 파일은 supabase-config.js (전역 _supabase) 다음에 로드된다. 인라인 스크립트는 CSP 가 막는다.

(function () {
    'use strict';

    var POLL_MS = 15000;
    var LS_PREFIX = 'waat_market_order:';   // localStorage: 주문번호 → 연락처

    var settings = {};
    var currentOrder = null;
    var pollTimer = null;

    function $(id) { return document.getElementById(id); }
    function fmtWon(n) { var v = Number(n); return isFinite(v) ? v.toLocaleString('ko-KR') : String(n || ''); }
    function show(node, on) { if (!node) return; if (on) node.removeAttribute('hidden'); else node.setAttribute('hidden', ''); }
    function setError(node, msg) { if (!node) return; node.textContent = msg || ''; show(node, !!msg); }
    function methodLabel(m) { return m === 'kakaopay' ? '카카오페이 송금' : m === 'bank' ? '계좌 이체' : (m || '-'); }
    function isMobile() {
        return /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent) || window.innerWidth <= 768;
    }
    function rememberContact(orderNo, contact) { try { localStorage.setItem(LS_PREFIX + orderNo, contact); } catch (e) { /* 사생활 모드 */ } }
    function recallContact(orderNo) { try { return localStorage.getItem(LS_PREFIX + orderNo) || ''; } catch (e) { return ''; } }
    function setUrlOrder(orderNo) {
        try {
            var u = new URL(window.location.href);
            if (orderNo) u.searchParams.set('order', orderNo); else u.searchParams.delete('order');
            window.history.replaceState({}, '', u.pathname + u.search + '#buy');
        } catch (e) { /* ignore */ }
    }
    function orderPageUrl(orderNo) { return window.location.origin + '/market?order=' + encodeURIComponent(orderNo) + '#buy'; }

    function goPanel(id) {
        Array.prototype.forEach.call(document.querySelectorAll('#buy .pay-step'), function (s) { s.classList.remove('active'); });
        var el = $(id); if (el) el.classList.add('active');
        var buy = $('buy');
        if (buy) {
            var top = buy.getBoundingClientRect().top + window.pageYOffset - 8;
            if (Math.abs(window.pageYOffset - top) > 240) window.scrollTo({ top: top, behavior: 'smooth' });
        }
    }

    // ---------- 설정 (공개 RPC) ----------
    async function loadSettings() {
        try {
            var res = await _supabase.rpc('get_market_settings');
            if (res.error) throw res.error;
            settings = res.data || {};
        } catch (e) {
            console.error('get_market_settings error:', e);
            settings = {};
        }
        var price = settings.product_price || '9900';
        Array.prototype.forEach.call(document.querySelectorAll('[data-price]'), function (n) { n.textContent = fmtWon(price); });
        if (settings.seller_info && settings.seller_info.trim() && $('mk-seller-line')) {
            // 관리자 설정의 판매자 표기가 있으면 그것을 우선 (줄바꿈은 ' · ' 로)
            $('mk-seller-line').textContent = settings.seller_info.replace(/\r?\n/g, ' · ');
        }
        applyPayInfo();
    }

    function applyPayInfo() {
        var amount = currentOrder ? currentOrder.amount : (settings.product_price || 9900);
        Array.prototype.forEach.call(document.querySelectorAll('.mk-amount-inline'), function (n) { n.textContent = fmtWon(amount); });

        var hasBank = !!(settings.bank_account && settings.bank_account.trim());
        $('mk-bank-name').textContent = settings.bank_name || '-';
        $('mk-bank-account').textContent = settings.bank_account || '-';
        $('mk-bank-holder').textContent = settings.bank_holder || '-';
        show($('mk-bank-box'), hasBank);
        show($('mk-bank-missing'), !hasBank);
        $('mk-bank-copy').disabled = !hasBank;

        $('mk-kakao-holder').textContent = settings.bank_holder || '선웅규';
        var link = (settings.kakaopay_link || '').trim();
        var hasKakao = /^https:\/\//i.test(link);
        $('mk-kakao-btn').href = hasKakao ? link : '#';
        show($('mk-kakao-missing'), !hasKakao);
        // 폰: 링크 버튼 / PC: QR 이미지 (기존 판매 시스템의 QR 그대로 — 금액은 송금 시 입력)
        show($('mk-kakao-mobile'), hasKakao && isMobile());
        show($('mk-kakao-pc'), !isMobile());
    }

    // ---------- 주문 화면 ----------
    function renderOrder(order) {
        currentOrder = order;
        $('mk-order-no').textContent = order.order_no;
        $('mk-order-version').textContent = settings.product_version || '';
        $('mk-order-amount').textContent = fmtWon(order.amount);
        $('mk-order-name').textContent = order.buyer_name || '-';
        $('mk-order-method').textContent = methodLabel(order.pay_method);
        $('mk-order-link').href = orderPageUrl(order.order_no);

        var st = $('mk-status');
        st.classList.remove('is-paid', 'is-cancelled');
        show($('mk-pay-guide'), false); show($('mk-paid'), false); show($('mk-cancelled'), false);
        show($('mk-guide-bank'), false); show($('mk-guide-kakaopay'), false);

        if (order.status === 'paid') {
            st.textContent = '결제 확인됨'; st.classList.add('is-paid');
            var dl = (order.download_url || '').trim();
            var hasDl = /^https:\/\//i.test(dl);
            $('mk-download-btn').href = hasDl ? dl : '#';
            $('mk-download-btn').classList.toggle('is-disabled', !hasDl);
            show($('mk-download-missing'), !hasDl);
            $('mk-license-key').textContent = order.license_key || '-';
            show($('mk-paid'), true);
            stopPolling();
        } else if (order.status === 'cancelled') {
            st.textContent = '취소됨'; st.classList.add('is-cancelled');
            show($('mk-cancelled'), true);
            stopPolling();
        } else {
            st.textContent = order.pay_method === 'kakaopay' ? '송금 대기' : '입금 대기';
            applyPayInfo();
            show(order.pay_method === 'kakaopay' ? $('mk-guide-kakaopay') : $('mk-guide-bank'), true);
            show($('mk-pay-guide'), true);
            startPolling();
        }
        goPanel('mk-order-panel');
    }

    async function fetchOrder(orderNo, contact) {
        var res = await _supabase.rpc('get_app_order', { p_order_no: String(orderNo || '').trim(), p_contact: String(contact || '').trim() });
        if (res.error) throw res.error;
        return res.data || null;
    }

    async function refreshOrder() {
        if (!currentOrder) return;
        var contact = recallContact(currentOrder.order_no) || currentOrder.contact;
        try {
            var o = await fetchOrder(currentOrder.order_no, contact);
            if (o) renderOrder(o);
        } catch (e) { console.warn('주문 상태 확인 실패:', e); }
    }
    function startPolling() {
        stopPolling();
        pollTimer = setInterval(function () { if (!document.hidden) refreshOrder(); }, POLL_MS);
    }
    function stopPolling() { if (pollTimer) { clearInterval(pollTimer); pollTimer = null; } }
    document.addEventListener('visibilitychange', function () {
        if (!document.hidden && currentOrder && currentOrder.status === 'pending') refreshOrder();
    });

    // Google Sheets 미러링 — 실패해도 무시
    function syncSheet(orderNo, contact) {
        try {
            fetch('/api/market/sheet-sync', {
                method: 'POST', headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ order_no: orderNo, contact: contact }), keepalive: true
            }).then(function (r) { return r.json(); }).then(function (j) { if (!j.ok) console.info('sheet-sync:', j); })
              .catch(function (e) { console.info('sheet-sync 실패(무시):', e && e.message); });
        } catch (e) { /* ignore */ }
    }

    // ---------- 주문 폼 ----------
    async function submitOrder(e) {
        e.preventDefault();
        var err = $('mk-form-error');
        setError(err, '');
        var name = $('mk-name').value.trim();
        var contact = $('mk-contact').value.trim();
        var mi = document.querySelector('input[name="mk-method"]:checked');
        var method = mi ? mi.value : '';
        if (!name) { setError(err, '이름을 입력해 주세요.'); $('mk-name').focus(); return; }
        if (!contact) { setError(err, '이메일 또는 휴대폰 번호를 입력해 주세요.'); $('mk-contact').focus(); return; }
        if (method !== 'bank' && method !== 'kakaopay') { setError(err, '결제 방법을 선택해 주세요.'); return; }
        if (!$('mk-agree').checked) { setError(err, '안내 사항 확인에 체크해 주세요.'); return; }

        var btn = $('mk-submit-btn');
        btn.disabled = true; btn.textContent = '주문번호 발급 중...';
        try {
            var res = await _supabase.rpc('create_app_order', { p_name: name, p_contact: contact, p_method: method });
            if (res.error) throw res.error;
            var order = res.data;
            rememberContact(order.order_no, contact);
            setUrlOrder(order.order_no);
            renderOrder(order);
            syncSheet(order.order_no, contact);
        } catch (ex) {
            console.error('create_app_order error:', ex);
            setError(err, (ex && ex.message) ? ex.message : '주문 생성에 실패했습니다. 잠시 후 다시 시도해 주세요.');
        } finally {
            btn.disabled = false; btn.textContent = '주문번호 받기';
        }
    }

    // ---------- 주문 조회 ----------
    function openLookup(prefillNo) {
        setError($('mk-lookup-error'), '');
        if (prefillNo) $('mk-lookup-no').value = prefillNo;
        goPanel('mk-lookup-panel');
        setTimeout(function () { (prefillNo ? $('mk-lookup-contact') : $('mk-lookup-no')).focus(); }, 250);
    }
    async function submitLookup(e) {
        e.preventDefault();
        var err = $('mk-lookup-error');
        setError(err, '');
        var no = $('mk-lookup-no').value.trim().toUpperCase();
        var contact = $('mk-lookup-contact').value.trim();
        if (!no || !contact) { setError(err, '주문번호와 연락처를 모두 입력해 주세요.'); return; }
        try {
            var o = await fetchOrder(no, contact);
            if (!o) { setError(err, '일치하는 주문이 없습니다. 주문번호와 연락처를 확인해 주세요.'); return; }
            rememberContact(o.order_no, contact);
            setUrlOrder(o.order_no);
            renderOrder(o);
        } catch (ex) {
            console.error('get_app_order error:', ex);
            setError(err, '조회에 실패했습니다. 잠시 후 다시 시도해 주세요.');
        }
    }

    // ---------- 복사 ----------
    function copyText(text, btn, doneLabel) {
        var done = function () {
            if (!btn) return;
            var t = btn.innerHTML;
            btn.textContent = doneLabel || '복사됨';
            btn.classList.add('is-done');
            setTimeout(function () { btn.innerHTML = t; btn.classList.remove('is-done'); }, 1600);
        };
        if (navigator.clipboard && navigator.clipboard.writeText) {
            navigator.clipboard.writeText(text).then(done).catch(function () { window.prompt('복사하세요', text); });
        } else { window.prompt('복사하세요', text); }
    }
    document.addEventListener('click', function (e) {
        var btn = e.target.closest('.mk-copy');
        if (!btn) return;
        var target = $(btn.dataset.copyTarget);
        if (target) copyText(target.textContent.trim(), btn);
    });

    // ---------- 시작 ----------
    async function init() {
        $('mk-order-form').addEventListener('submit', submitOrder);
        $('mk-lookup-form').addEventListener('submit', submitLookup);
        $('mk-lookup-open-btn').addEventListener('click', function () { openLookup(''); });
        $('mk-lookup-cancel-btn').addEventListener('click', function () { goPanel('mk-order-form-panel'); });
        $('mk-new-order-btn').addEventListener('click', function () { stopPolling(); currentOrder = null; setUrlOrder(''); goPanel('mk-order-form-panel'); });
        $('mk-refresh-btn').addEventListener('click', refreshOrder);
        $('mk-bank-copy').addEventListener('click', function () {
            var acc = (settings.bank_account || '').trim();
            if (acc) copyText(acc, $('mk-bank-copy'), '복사됨 — 은행 앱에서 이체해 주세요');
        });

        if (!_supabase) { setError($('mk-form-error'), '서비스 연결에 실패했습니다. 잠시 후 다시 시도해 주세요.'); return; }
        await loadSettings();

        // /market?order=CS-... 로 돌아온 경우
        var orderNo = '';
        try { orderNo = (new URLSearchParams(window.location.search).get('order') || '').trim().toUpperCase(); } catch (e) { orderNo = ''; }
        if (orderNo) {
            var contact = recallContact(orderNo);
            if (contact) {
                try { var o = await fetchOrder(orderNo, contact); if (o) { renderOrder(o); return; } }
                catch (e) { console.warn('주문 자동 조회 실패:', e); }
            }
            openLookup(orderNo);
        }
    }

    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init); else init();
})();
