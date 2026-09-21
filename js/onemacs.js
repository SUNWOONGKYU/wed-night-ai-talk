// ========== One MACS · 원맥스 상품 상세 (market/onemacs.html) — 하단 고정 CTA · 출시 모드 전환 · 출시 알림 예약 폼 ==========
// 인라인 스크립트는 CSP 가 막으므로 전부 이 파일에 둔다.
//
// [출시 모드] GET /api/market-config 의 mode ('reserve' | 'sale') — js/market.js 가 받아 window.MARKET_CONFIG 에 두고 'market-config' 이벤트를 쏜다.
//   HTML 기본 상태 = reserve (data-mode="sale" 요소는 hidden, data-mode="reserve" 요소는 표시). fetch 실패·mode 없음 → reserve 그대로.
//   sale 이면 data-mode 요소를 반대로 전환하고 CTA 3곳(히어로·가격 카드·스티키)을 "9,900원에 받기 · #buy" 로 되돌린다. 결제 UI 코드는 그대로.
// [예약 폼] #rs-form → POST /api/reserve {email, name, phone, agree} → 완료 화면(예약번호). 같은 이메일이면 duplicate → 기존 예약번호 안내.
(function () {
    'use strict';

    var $ = function (id) { return document.getElementById(id); };
    var mode = 'reserve';

    // ---------- 하단 고정 CTA: 히어로 버튼이 화면 위로 지나가면 보인다 ----------
    (function sticky() {
        var s = $('sticky'), h = $('heroCta');
        if (!s) return;
        if (!h || !('IntersectionObserver' in window)) { s.classList.add('on'); return; }
        new IntersectionObserver(function (e) {
            s.classList.toggle('on', !e[0].isIntersecting && e[0].boundingClientRect.top < 0);
        }, { threshold: 0 }).observe(h);
    })();

    // ---------- 출시 모드 ----------
    var CTA = {
        reserve: { href: '#reserve', hero: '출시 알림 예약하기', heroSmall: '출시 가격 9,900원 · VAT 포함 · 1회 결제 · 월 구독 없음',
                   card: '출시 알림 예약하기', sticky: '출시 알림 예약하기 · 출시 가격 9,900원' },
        sale:    { href: '#buy', hero: '9,900원에 받기', heroSmall: 'VAT 포함 · 1회 결제 · 월 구독 없음 · APK 즉시 다운로드',
                   card: '9,900원에 받기', sticky: '9,900원에 받기 · 1회 결제 · 월 구독 없음' }
    };

    function fmt(n) { var v = Number(n); return isFinite(v) ? v.toLocaleString('ko-KR') : String(n || ''); }

    function applyMode(m, price) {
        mode = m === 'sale' ? 'sale' : 'reserve';
        var p = fmt(price || 9900);
        var t = CTA[mode];
        Array.prototype.forEach.call(document.querySelectorAll('[data-mode]'), function (el) {
            if (el.getAttribute('data-mode') === mode) el.removeAttribute('hidden'); else el.setAttribute('hidden', '');
        });
        var hero = $('heroCta');
        if (hero) { hero.href = t.href; hero.innerHTML = ''; hero.appendChild(document.createTextNode(t.hero.replace('9,900', p)));
                    var sm = document.createElement('small'); sm.textContent = t.heroSmall.replace('9,900', p); hero.appendChild(sm); }
        var card = document.querySelector('#reserve-cta [data-cta]');
        if (card) { card.href = t.href; card.textContent = t.card.replace('9,900', p); }
        var st = document.querySelector('#sticky [data-cta]');
        if (st) { st.href = t.href; st.textContent = t.sticky.replace('9,900', p); }
        document.body.setAttribute('data-launch-mode', mode);
        // 옛 링크(#buy · #renew · 콘솔 페이지의 "앱 받기")로 들어왔는데 출시 전이면 예약 폼으로
        if (mode === 'reserve' && (location.hash === '#buy' || location.hash === '#renew')) {
            var r = $('reserve'); if (r) setTimeout(function () { r.scrollIntoView({ behavior: 'smooth', block: 'start' }); }, 50);
        }
    }

    function onConfig(cfg) {
        applyMode(cfg && cfg.mode, cfg && cfg.product && cfg.product.price);
    }
    if (window.MARKET_CONFIG) onConfig(window.MARKET_CONFIG);
    else document.addEventListener('market-config', function (e) { onConfig(e.detail); });

    // ---------- 출시 알림 예약 폼 ----------
    function show(node, on) { if (!node) return; if (on) node.removeAttribute('hidden'); else node.setAttribute('hidden', ''); }
    function setMsg(node, msg, ok) { if (!node) return; node.textContent = msg || ''; node.classList.toggle('ok', !!ok); show(node, !!msg); }
    function rsStep(id) {
        Array.prototype.forEach.call(document.querySelectorAll('.rs-step'), function (s) { s.classList.remove('active'); });
        var el = $(id); if (el) el.classList.add('active');
    }

    async function reserve(e) {
        e.preventDefault();
        var email = $('rs-email').value.trim();
        var name = $('rs-name').value.trim();
        var phone = $('rs-phone').value.trim();
        var agree = $('rs-agree').checked;
        var err = $('rs-error');
        setMsg(err, '');
        if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) { setMsg(err, '올바른 이메일 주소를 입력해 주세요.'); $('rs-email').focus(); return; }
        if (!agree) { setMsg(err, '출시 안내 메일 수신에 동의해 주세요.'); $('rs-agree').focus(); return; }

        var btn = $('rs-btn');
        var orig = btn.textContent;
        btn.disabled = true; btn.textContent = '예약 중...';
        try {
            var r = await fetch('/api/reserve', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email: email, name: name, phone: phone, agree: true })
            });
            var data = null;
            try { data = await r.json(); } catch (e2) { data = null; }
            if (!r.ok || !data || !data.success) throw new Error((data && data.error) || '예약에 실패했습니다.');
            $('rs-done-id').textContent = data.reserveId || '';
            $('rs-done-email').textContent = data.email || email;
            if (data.duplicate) {
                $('rs-done-title').textContent = '이미 예약된 이메일입니다';
                $('rs-done-note').textContent = '예약번호는 처음 예약할 때 보내드린 메일에도 있습니다. 출시 첫날 같은 주소로 알려드립니다.';
            } else {
                $('rs-done-title').textContent = '예약 완료';
                $('rs-done-note').textContent = '예약 확인 메일을 보내드렸습니다. 메일이 안 보이면 스팸함을 확인해 주세요.';
            }
            rsStep('rs-step-done');
            var sec = $('reserve');
            if (sec) { var top = sec.getBoundingClientRect().top + window.pageYOffset - 8; window.scrollTo({ top: top, behavior: 'smooth' }); }
        } catch (ex) {
            setMsg(err, ex.message || '예약 중 오류가 발생했습니다. 잠시 후 다시 시도해 주세요.');
        } finally {
            btn.disabled = false; btn.textContent = orig;
        }
    }

    function init() {
        var f = $('rs-form');
        if (f) f.addEventListener('submit', reserve);
    }
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init); else init();
})();
