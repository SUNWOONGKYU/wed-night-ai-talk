// ========== 앱 마켓 (market.html) ==========
//
// 흐름
//   상품 카드 [구매하기] → 주문 폼 → create_app_order() RPC → 주문번호 발급
//   → 결제 안내(무통장 / 카카오페이) → 15초마다 get_app_order() 로 상태 확인
//   → paid 가 되면 같은 화면에 다운로드 버튼 + 라이선스 키
//
// 보안 원칙 (supabase-config.js 의 2026-09-02 방침과 동일)
//   · 브라우저는 app_orders / app_settings 테이블을 직접 읽지 않는다. RPC 만 쓴다.
//   · 다운로드 주소·라이선스 키는 get_app_order() 가 status=paid 일 때만 돌려준다.
//   · 주문 조회에는 주문번호 + 연락처가 모두 필요하다. 연락처는 이 브라우저의
//     localStorage 에만 저장해(다른 기기에서 열면 다시 입력) 링크만 새어도 조회가 안 되게 한다.
//
// 이 파일은 supabase-config.js (전역 _supabase, Auth, DB) 다음에 로드된다.

(function () {
    'use strict';

    var POLL_MS = 15000;
    var LS_PREFIX = 'waat_market_order:';   // localStorage 키: 주문번호 → 연락처

    var settings = {};       // get_market_settings() 결과
    var currentOrder = null; // 화면에 띄운 주문
    var pollTimer = null;

    // ---------- DOM ----------
    function $(id) { return document.getElementById(id); }

    var el = {
        buyBtn:        $('mk-buy-btn'),
        price:         $('mk-price'),
        version:       $('mk-version'),
        formPanel:     $('mk-order-form-panel'),
        form:          $('mk-order-form'),
        name:          $('mk-name'),
        contact:       $('mk-contact'),
        agree:         $('mk-agree'),
        formError:     $('mk-form-error'),
        submitBtn:     $('mk-submit-btn'),
        cancelBtn:     $('mk-cancel-btn'),
        orderPanel:    $('mk-order-panel'),
        orderNo:       $('mk-order-no'),
        status:        $('mk-status'),
        orderVersion:  $('mk-order-version'),
        orderAmount:   $('mk-order-amount'),
        orderName:     $('mk-order-name'),
        orderMethod:   $('mk-order-method'),
        payGuide:      $('mk-pay-guide'),
        guideBank:     $('mk-guide-bank'),
        guideKakao:    $('mk-guide-kakaopay'),
        bankBox:       $('mk-bank-box'),
        bankName:      $('mk-bank-name'),
        bankAccount:   $('mk-bank-account'),
        bankHolder:    $('mk-bank-holder'),
        bankAmount:    $('mk-bank-amount'),
        bankMissing:   $('mk-bank-missing'),
        kakaoBtn:      $('mk-kakao-btn'),
        kakaoQr:       $('mk-kakao-qr'),
        kakaoMissing:  $('mk-kakao-missing'),
        orderLink:     $('mk-order-link'),
        refreshBtn:    $('mk-refresh-btn'),
        paid:          $('mk-paid'),
        downloadBtn:   $('mk-download-btn'),
        downloadMissing: $('mk-download-missing'),
        licenseKey:    $('mk-license-key'),
        cancelled:     $('mk-cancelled'),
        lookupPanel:   $('mk-lookup-panel'),
        lookupForm:    $('mk-lookup-form'),
        lookupNo:      $('mk-lookup-no'),
        lookupContact: $('mk-lookup-contact'),
        lookupError:   $('mk-lookup-error'),
        lookupCancel:  $('mk-lookup-cancel-btn'),
        lookupOpen:    $('mk-lookup-open-btn'),
        sellerInfo:    $('mk-seller-info')
    };

    // ---------- 유틸 ----------
    function fmtWon(n) {
        var v = Number(n);
        if (!isFinite(v)) return String(n || '');
        return v.toLocaleString('ko-KR');
    }

    function show(node, on) {
        if (!node) return;
        if (on) node.removeAttribute('hidden'); else node.setAttribute('hidden', '');
    }

    function setError(node, msg) {
        if (!node) return;
        node.textContent = msg || '';
        show(node, !!msg);
    }

    function methodLabel(m) {
        return m === 'kakaopay' ? '카카오페이 송금' : m === 'bank' ? '무통장 입금' : (m || '-');
    }

    function rememberContact(orderNo, contact) {
        try { localStorage.setItem(LS_PREFIX + orderNo, contact); } catch (e) { /* 사생활 모드 등 */ }
    }
    function recallContact(orderNo) {
        try { return localStorage.getItem(LS_PREFIX + orderNo) || ''; } catch (e) { return ''; }
    }

    function setUrlOrder(orderNo) {
        try {
            var u = new URL(window.location.href);
            if (orderNo) u.searchParams.set('order', orderNo); else u.searchParams.delete('order');
            window.history.replaceState({}, '', u.pathname + u.search + u.hash);
        } catch (e) { /* ignore */ }
    }

    function orderPageUrl(orderNo) {
        return window.location.origin + '/market?order=' + encodeURIComponent(orderNo);
    }

    function scrollTo(node) {
        if (!node) return;
        var top = node.getBoundingClientRect().top + window.pageYOffset - 90;
        window.scrollTo({ top: top, behavior: 'smooth' });
    }

    // ---------- 설정 ----------
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
        if (el.price) el.price.textContent = fmtWon(price);
        if (el.version && settings.product_version) el.version.textContent = settings.product_version;
        if (el.sellerInfo && settings.seller_info && settings.seller_info.trim()) {
            el.sellerInfo.textContent = settings.seller_info;
        }
        applyBankAndKakao();
    }

    function applyBankAndKakao() {
        var amount = currentOrder ? currentOrder.amount : (settings.product_price || 9900);
        Array.prototype.forEach.call(document.querySelectorAll('.mk-amount-inline'), function (n) {
            n.textContent = fmtWon(amount);
        });
        if (el.bankAmount) el.bankAmount.textContent = fmtWon(amount);

        var hasBank = !!(settings.bank_account && settings.bank_account.trim());
        el.bankName.textContent = settings.bank_name || '-';
        el.bankAccount.textContent = settings.bank_account || '-';
        el.bankHolder.textContent = settings.bank_holder || '-';
        show(el.bankBox, hasBank);
        show(el.bankMissing, !hasBank);

        var link = (settings.kakaopay_link || '').trim();
        var hasKakao = /^https:\/\//i.test(link);
        if (hasKakao) {
            el.kakaoBtn.href = link;
            el.kakaoBtn.classList.remove('is-disabled');
            renderQr(link);
        } else {
            el.kakaoBtn.href = '#';
            el.kakaoBtn.classList.add('is-disabled');
            el.kakaoQr.innerHTML = '';
        }
        show(el.kakaoMissing, !hasKakao);
    }

    // qrcode-generator (cdn.jsdelivr.net — CSP script-src 허용 출처) 로 SVG 생성.
    // 라이브러리가 못 떠도 버튼은 동작하므로 QR 만 조용히 생략한다.
    function renderQr(text) {
        el.kakaoQr.innerHTML = '';
        if (typeof window.qrcode !== 'function') return;
        try {
            var qr = window.qrcode(0, 'M');
            qr.addData(text);
            qr.make();
            el.kakaoQr.innerHTML = qr.createSvgTag({ cellSize: 4, margin: 2, scalable: true });
        } catch (e) {
            console.warn('QR 생성 실패:', e);
        }
    }

    // ---------- 주문 화면 ----------
    function renderOrder(order) {
        currentOrder = order;
        el.orderNo.textContent = order.order_no;
        el.orderVersion.textContent = settings.product_version || '';
        el.orderAmount.textContent = fmtWon(order.amount);
        el.orderName.textContent = order.buyer_name || '-';
        el.orderMethod.textContent = methodLabel(order.pay_method);
        el.orderLink.href = orderPageUrl(order.order_no);

        el.status.classList.remove('is-paid', 'is-cancelled');
        show(el.payGuide, false);
        show(el.paid, false);
        show(el.cancelled, false);
        show(el.guideBank, false);
        show(el.guideKakao, false);

        if (order.status === 'paid') {
            el.status.textContent = '결제 확인됨';
            el.status.classList.add('is-paid');
            var dl = (order.download_url || '').trim();
            var hasDl = /^https:\/\//i.test(dl);
            el.downloadBtn.href = hasDl ? dl : '#';
            el.downloadBtn.classList.toggle('is-disabled', !hasDl);
            show(el.downloadMissing, !hasDl);
            el.licenseKey.textContent = order.license_key || '-';
            show(el.paid, true);
            stopPolling();
        } else if (order.status === 'cancelled') {
            el.status.textContent = '취소됨';
            el.status.classList.add('is-cancelled');
            show(el.cancelled, true);
            stopPolling();
        } else {
            el.status.textContent = order.pay_method === 'kakaopay' ? '송금 대기' : '입금 대기';
            applyBankAndKakao();
            show(order.pay_method === 'kakaopay' ? el.guideKakao : el.guideBank, true);
            show(el.payGuide, true);
            startPolling();
        }

        show(el.formPanel, false);
        show(el.lookupPanel, false);
        show(el.orderPanel, true);
    }

    async function fetchOrder(orderNo, contact) {
        var res = await _supabase.rpc('get_app_order', {
            p_order_no: String(orderNo || '').trim(),
            p_contact:  String(contact || '').trim()
        });
        if (res.error) throw res.error;
        return res.data || null;   // 못 찾으면 null
    }

    async function refreshOrder() {
        if (!currentOrder) return;
        var contact = recallContact(currentOrder.order_no) || currentOrder.contact;
        try {
            var o = await fetchOrder(currentOrder.order_no, contact);
            if (o) renderOrder(o);
        } catch (e) {
            console.warn('주문 상태 확인 실패:', e);
        }
    }

    function startPolling() {
        stopPolling();
        pollTimer = setInterval(function () {
            if (document.hidden) return;   // 백그라운드 탭에서는 쉬고, 돌아오면 다음 틱에 확인
            refreshOrder();
        }, POLL_MS);
    }
    function stopPolling() {
        if (pollTimer) { clearInterval(pollTimer); pollTimer = null; }
    }
    document.addEventListener('visibilitychange', function () {
        if (!document.hidden && currentOrder && currentOrder.status === 'pending') refreshOrder();
    });

    // ---------- 주문 폼 ----------
    function openForm() {
        show(el.lookupPanel, false);
        show(el.orderPanel, false);
        show(el.formPanel, true);
        setError(el.formError, '');
        scrollTo(el.formPanel);
        setTimeout(function () { el.name.focus(); }, 300);
    }

    async function submitOrder(e) {
        e.preventDefault();
        setError(el.formError, '');

        var name = el.name.value.trim();
        var contact = el.contact.value.trim();
        var methodInput = el.form.querySelector('input[name="mk-method"]:checked');
        var method = methodInput ? methodInput.value : '';

        if (!name) { setError(el.formError, '이름을 입력해 주세요.'); el.name.focus(); return; }
        if (!contact) { setError(el.formError, '이메일 또는 휴대폰 번호를 입력해 주세요.'); el.contact.focus(); return; }
        if (method !== 'bank' && method !== 'kakaopay') { setError(el.formError, '결제 방법을 선택해 주세요.'); return; }
        if (!el.agree.checked) { setError(el.formError, '안내 사항 확인에 체크해 주세요.'); return; }

        el.submitBtn.disabled = true;
        el.submitBtn.textContent = '주문번호 발급 중...';
        try {
            var res = await _supabase.rpc('create_app_order', { p_name: name, p_contact: contact, p_method: method });
            if (res.error) throw res.error;
            var order = res.data;
            rememberContact(order.order_no, contact);
            setUrlOrder(order.order_no);
            renderOrder(order);
            scrollTo(el.orderPanel);
        } catch (err) {
            console.error('create_app_order error:', err);
            setError(el.formError, (err && err.message) ? err.message : '주문 생성에 실패했습니다. 잠시 후 다시 시도해 주세요.');
        } finally {
            el.submitBtn.disabled = false;
            el.submitBtn.textContent = '주문번호 받기';
        }
    }

    // ---------- 주문 조회 ----------
    function openLookup(prefillNo) {
        show(el.formPanel, false);
        show(el.orderPanel, false);
        setError(el.lookupError, '');
        if (prefillNo) el.lookupNo.value = prefillNo;
        show(el.lookupPanel, true);
        scrollTo(el.lookupPanel);
        setTimeout(function () { (prefillNo ? el.lookupContact : el.lookupNo).focus(); }, 300);
    }

    async function submitLookup(e) {
        e.preventDefault();
        setError(el.lookupError, '');
        var no = el.lookupNo.value.trim().toUpperCase();
        var contact = el.lookupContact.value.trim();
        if (!no || !contact) { setError(el.lookupError, '주문번호와 연락처를 모두 입력해 주세요.'); return; }
        try {
            var o = await fetchOrder(no, contact);
            if (!o) { setError(el.lookupError, '일치하는 주문이 없습니다. 주문번호와 연락처를 확인해 주세요.'); return; }
            rememberContact(o.order_no, contact);
            setUrlOrder(o.order_no);
            renderOrder(o);
            scrollTo(el.orderPanel);
        } catch (err) {
            console.error('get_app_order error:', err);
            setError(el.lookupError, '조회에 실패했습니다. 잠시 후 다시 시도해 주세요.');
        }
    }

    // ---------- 복사 버튼 ----------
    document.addEventListener('click', function (e) {
        var btn = e.target.closest('.mk-copy');
        if (!btn) return;
        var target = $(btn.dataset.copyTarget);
        if (!target) return;
        var text = target.textContent.trim();
        var done = function () {
            var orig = btn.textContent;
            btn.textContent = '복사됨';
            btn.classList.add('is-done');
            setTimeout(function () { btn.textContent = orig; btn.classList.remove('is-done'); }, 1500);
        };
        if (navigator.clipboard && navigator.clipboard.writeText) {
            navigator.clipboard.writeText(text).then(done).catch(function () { fallbackCopy(text); done(); });
        } else {
            fallbackCopy(text); done();
        }
    });
    function fallbackCopy(text) {
        var ta = document.createElement('textarea');
        ta.value = text;
        ta.setAttribute('readonly', '');
        ta.style.position = 'fixed'; ta.style.top = '-1000px';
        document.body.appendChild(ta);
        ta.select();
        try { document.execCommand('copy'); } catch (e) { /* ignore */ }
        document.body.removeChild(ta);
    }

    // ---------- 내비 (로그인 상태 표시 / 모바일 메뉴) ----------
    async function initNav() {
        // 모바일 메뉴 — speakup.js 와 같은 방식 (첫 .nav-links = 가운데 메뉴를 토글)
        var menuBtn = document.querySelector('.mobile-menu-btn');
        var navLinks = document.querySelector('.nav-links');
        if (menuBtn && navLinks) {
            menuBtn.addEventListener('click', function (e) { e.stopPropagation(); navLinks.classList.toggle('show'); });
            document.addEventListener('click', function (e) {
                if (navLinks.classList.contains('show') && !e.target.closest('.nav-inner')) navLinks.classList.remove('show');
            });
        }

        var userBtn = $('nav-user-btn');
        var dropdown = $('nav-dropdown');
        if (userBtn && dropdown) {
            userBtn.addEventListener('click', function (e) { e.stopPropagation(); dropdown.classList.toggle('show'); });
            document.addEventListener('click', function () { dropdown.classList.remove('show'); });
        }
        var logoutBtn = document.querySelector('[data-action="logout"]');
        if (logoutBtn) {
            logoutBtn.addEventListener('click', async function () {
                try { await Auth.signOut(); } catch (e) { /* ignore */ }
                window.location.reload();
            });
        }

        if (!_supabase) return;
        try {
            var session = await Auth.getSession();
            if (!session) return;
            var profile = null;
            try { profile = await DB.getMyProfile(); } catch (e) { profile = null; }
            $('nav-user-name').textContent = (profile && profile.name) || session.user.email || '사용자';
            $('nav-login-link').style.display = 'none';
            $('nav-signup-link').style.display = 'none';
            $('nav-user-menu').style.display = '';
            if (profile && profile.role === 'admin') $('nav-admin-link').style.display = '';
        } catch (e) {
            /* 비로그인 화면 그대로 */
        }
    }

    // ---------- 시작 ----------
    async function init() {
        if (!_supabase) {
            setError(el.formError, '서비스 연결에 실패했습니다. 잠시 후 다시 시도해 주세요.');
        }

        el.buyBtn.addEventListener('click', openForm);
        el.cancelBtn.addEventListener('click', function () { show(el.formPanel, false); scrollTo($('mk-product')); });
        el.form.addEventListener('submit', submitOrder);
        el.refreshBtn.addEventListener('click', refreshOrder);
        el.lookupOpen.addEventListener('click', function () { openLookup(''); });
        el.lookupCancel.addEventListener('click', function () { show(el.lookupPanel, false); });
        el.lookupForm.addEventListener('submit', submitLookup);

        initNav();
        await loadSettings();

        // /market?order=CS-... 로 돌아온 경우: 이 브라우저에 연락처가 있으면 바로, 없으면 연락처 입력
        var orderNo = '';
        try { orderNo = (new URLSearchParams(window.location.search).get('order') || '').trim().toUpperCase(); } catch (e) { orderNo = ''; }
        if (orderNo) {
            var contact = recallContact(orderNo);
            if (contact) {
                try {
                    var o = await fetchOrder(orderNo, contact);
                    if (o) { renderOrder(o); scrollTo(el.orderPanel); return; }
                } catch (e) { console.warn('주문 자동 조회 실패:', e); }
            }
            openLookup(orderNo);
        }
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
})();
