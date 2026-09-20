// ========== /console — 복사 버튼 · 폰 안내 ==========
(function () {
    'use strict';

    function isPhone() {
        return /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent) || window.innerWidth <= 600;
    }

    var notice = document.getElementById('cs-phone-notice');
    if (notice && isPhone()) notice.removeAttribute('hidden');

    function fallbackCopy(text) {
        var ta = document.createElement('textarea');
        ta.value = text; ta.setAttribute('readonly', '');
        ta.style.position = 'fixed'; ta.style.top = '-1000px';
        document.body.appendChild(ta); ta.select();
        try { document.execCommand('copy'); } catch (e) { /* ignore */ }
        document.body.removeChild(ta);
    }

    document.addEventListener('click', function (e) {
        var btn = e.target.closest('.cs-copy');
        if (!btn) return;
        var text = btn.getAttribute('data-copy') || '';
        var done = function () {
            var orig = btn.textContent;
            btn.textContent = '복사됨';
            btn.classList.add('is-done');
            setTimeout(function () { btn.textContent = orig; btn.classList.remove('is-done'); }, 1500);
        };
        if (navigator.clipboard && navigator.clipboard.writeText) {
            navigator.clipboard.writeText(text).then(done).catch(function () { fallbackCopy(text); done(); });
        } else { fallbackCopy(text); done(); }
    });
})();
