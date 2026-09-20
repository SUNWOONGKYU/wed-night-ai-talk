// ========== 앱 마켓 (market.html) — 결제 흐름 ==========
//
// 출처: PO 의 기존 판매 시스템 index.html 결제 UI (2025-10) 를 원맥스 One MACS용으로 이식.
//   단계 1 결제 방법 선택 → 단계 2 카카오페이(모바일: 링크 / PC: QR 이미지) 또는 무통장 입금(복사)
//   → 단계 3 이메일·이름 입력 → POST /api/send-download → 단계 4 완료
//   (입금 확인 없이 자기 신고로 즉시 발송 — Sheets 에 SELF_REPORTED 로 남겨 나중에 대조)
//
// 설정(가격·카카오페이 링크·계좌)은 GET /api/market-config 에서 받는다 (Vercel 환경변수, 없으면 기존 계좌·링크 기본값).
// 결제 수단은 카카오페이 송금·무통장 입금 2개뿐 (PG 미도입 — PO 결정). PC 의 카카오페이 QR 은 market/img/kakaopay-qr.jpg.
// 인라인 스크립트는 CSP 가 막으므로 전부 이 파일에 둔다.

(function () {
    'use strict';

    var $ = function (id) { return document.getElementById(id); };
    var cfg = null;
    var selectedMethod = '';

    function fmt(n) { var v = Number(n); return isFinite(v) ? v.toLocaleString('ko-KR') : String(n || ''); }
    function show(node, on) { if (!node) return; if (on) node.removeAttribute('hidden'); else node.setAttribute('hidden', ''); }
    function isMobile() {
        return /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent) || window.innerWidth <= 768;
    }
    function setMsg(node, msg, ok) {
        if (!node) return;
        node.textContent = msg || '';
        node.classList.toggle('ok', !!ok);
        show(node, !!msg);
    }

    // ---------- 단계 전환 ----------
    function goStep(id) {
        Array.prototype.forEach.call(document.querySelectorAll('.pay-step'), function (s) { s.classList.remove('active'); });
        var el = $(id);
        if (el) el.classList.add('active');
        var buy = $('buy');
        if (buy && id !== 'pay-step1') {
            var top = buy.getBoundingClientRect().top + window.pageYOffset - 8;
            if (Math.abs(window.pageYOffset - top) > 200) window.scrollTo({ top: top, behavior: 'smooth' });
        }
    }

    function selectKakaoPay() {
        selectedMethod = 'kakaopay';
        var link = (cfg && cfg.kakaopayLink) || '';
        var has = /^https:\/\//i.test(link);
        $('pay-kakao-holder').textContent = (cfg && cfg.bank && cfg.bank.holder) || '판매자';
        show($('pay-kakao-missing'), !has);
        if (has) {
            if (isMobile()) {
                $('pay-kakao-open').href = link;
                show($('pay-kakao-mobile'), true); show($('pay-kakao-pc'), false);
            } else {
                show($('pay-kakao-mobile'), false); show($('pay-kakao-pc'), true);   // PC: QR 이미지(기존 판매 시스템 QR)
            }
        } else {
            show($('pay-kakao-mobile'), false); show($('pay-kakao-pc'), false);
        }
        goStep('pay-step-kakaopay');
    }

    function selectBank() {
        selectedMethod = 'bank';
        var b = (cfg && cfg.bank) || {};
        var has = !!(b.account && String(b.account).trim());
        $('pay-bank-name').textContent = b.name || '-';
        $('pay-bank-account').textContent = b.account || '-';
        $('pay-bank-holder').textContent = b.holder || '-';
        show($('pay-bank-missing'), !has);
        $('pay-bank-copy').disabled = !has;
        goStep('pay-step-bank');
    }

    function showEmailStep() {
        if (!selectedMethod) selectedMethod = 'kakaopay';   // "이미 송금했어요" 로 바로 온 경우 기본값
        setMsg($('pay-error'), '');
        goStep('pay-step-email');
        setTimeout(function () { $('pay-email').focus(); }, 250);
    }

    // ---------- 복사 ----------
    function copyText(text, btn) {
        var done = function () {
            if (!btn) return;
            var t = btn.innerHTML;
            btn.textContent = '복사됨 — 은행 앱에서 입금해 주세요';
            setTimeout(function () { btn.innerHTML = t; }, 1800);
        };
        if (navigator.clipboard && navigator.clipboard.writeText) {
            navigator.clipboard.writeText(text).then(done).catch(function () { window.prompt('계좌번호를 복사하세요', text); });
        } else {
            window.prompt('계좌번호를 복사하세요', text);
        }
    }

    // ---------- 단계 3: 발송 ----------
    async function sendDownload(e) {
        e.preventDefault();
        var email = $('pay-email').value.trim();
        var name = $('pay-name').value.trim();
        var phone = $('pay-phone').value.trim();
        var err = $('pay-error');
        setMsg(err, '');
        if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) { setMsg(err, '올바른 이메일 주소를 입력해 주세요.'); $('pay-email').focus(); return; }
        if (!name) { setMsg(err, '이름(입금자명)을 입력해 주세요.'); $('pay-name').focus(); return; }
        if (!$('pay-agree').checked) { setMsg(err, '안내 사항 확인에 체크해 주세요.'); return; }

        var btn = $('pay-send-btn');
        var orig = btn.textContent;
        btn.disabled = true; btn.textContent = '전송 중...';
        try {
            var r = await fetch('/api/send-download', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email: email, name: name, phone: phone, paymentMethod: selectedMethod || 'kakaopay' })
            });
            var data = null;
            try { data = await r.json(); } catch (e2) { data = null; }
            if (!r.ok || !data || !data.success) throw new Error((data && data.error) || '전송에 실패했습니다.');
            $('pay-done-email').textContent = email;
            $('pay-done-order').textContent = data.orderId || '';
            goStep('pay-step-done');
        } catch (ex) {
            setMsg(err, ex.message || '전송 중 오류가 발생했습니다. 잠시 후 다시 시도해 주세요.');
        } finally {
            btn.disabled = false; btn.textContent = orig;
        }
    }

    // ---------- 재발급 ----------
    async function renew(e) {
        e.preventDefault();
        var msg = $('renew-msg');
        var orderId = $('renew-order').value.trim().toUpperCase();
        var email = $('renew-email').value.trim();
        setMsg(msg, '');
        if (!orderId || !email) { setMsg(msg, '주문번호와 이메일을 모두 입력해 주세요.'); return; }
        var btn = $('renew-btn');
        btn.disabled = true;
        try {
            var r = await fetch('/api/renew-download-link', {
                method: 'POST', headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ orderId: orderId, email: email })
            });
            var data = null;
            try { data = await r.json(); } catch (e2) { data = null; }
            if (!r.ok || !data || !data.success) throw new Error((data && data.error) || '재발급에 실패했습니다.');
            setMsg(msg, email + ' 로 새 다운로드 링크를 보냈습니다. (남은 횟수 ' + data.remaining + '회)', true);
        } catch (ex) {
            setMsg(msg, ex.message);
        } finally {
            btn.disabled = false;
        }
    }

    // ---------- 설정 ----------
    async function loadConfig() {
        try {
            var r = await fetch('/api/market-config', { cache: 'no-store' });
            if (!r.ok) throw new Error('config ' + r.status);
            cfg = await r.json();
        } catch (e) {
            console.warn('market-config 실패 (정적 미리보기?):', e);
            cfg = { product: { price: 9900, version: 'v1.0', name: '원맥스 One MACS' },
                    kakaopayLink: 'https://qr.kakaopay.com/Ej8qUBxLx135601791',
                    bank: { name: '하나은행', account: '287-910921-40507', holder: '선웅규' } };
        }
        var price = (cfg.product && cfg.product.price) || 9900;
        Array.prototype.forEach.call(document.querySelectorAll('[data-price]'), function (n) { n.textContent = fmt(price); });
    }

    // ---------- 시작 ----------
    async function init() {
        document.addEventListener('click', function (e) {
            var el = e.target.closest('[data-pay]');
            if (!el) return;
            switch (el.dataset.pay) {
                case 'kakaopay': selectKakaoPay(); break;
                case 'bank':     selectBank(); break;
                case 'email':    showEmailStep(); break;
                case 'back':     selectedMethod = ''; goStep('pay-step1'); break;
            }
        });
        $('pay-bank-copy').addEventListener('click', function () {
            var acc = (cfg && cfg.bank && cfg.bank.account) || '';
            if (acc) copyText(acc, $('pay-bank-copy'));
        });
        $('pay-form').addEventListener('submit', sendDownload);
        $('renew-form').addEventListener('submit', renew);

        await loadConfig();
        if (window.location.hash === '#renew') {
            var d = $('renew'); if (d) d.open = true;
        }
    }

    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init); else init();
})();
