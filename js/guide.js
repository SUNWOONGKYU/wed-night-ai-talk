// ========== 사용법(/market/onemacs/guide) — 문서 틀 동작: 화면 밝기 버튼 · 맨 위로 ==========
// 저장값 적용은 js/theme.js(head 동기)가 한다. 여기서는 헤더 버튼과 맨 위로 버튼만.
(function () {
    'use strict';
    var KEY = 'waat-theme', root = document.documentElement;
    function cur() { var a = root.getAttribute('data-theme'); if (a === 'light' || a === 'dark') return a; return (window.matchMedia && window.matchMedia('(prefers-color-scheme: light)').matches) ? 'light' : 'dark'; }
    var b = document.getElementById('tb');
    function lab() { if (!b) return; b.textContent = cur() === 'light' ? '🌙' : '☀'; b.setAttribute('aria-label', cur() === 'light' ? '어두운 화면으로 바꾸기' : '밝은 화면으로 바꾸기'); }
    lab();
    if (b) b.addEventListener('click', function () { var n = cur() === 'light' ? 'dark' : 'light'; root.setAttribute('data-theme', n); try { localStorage.setItem(KEY, n); } catch (e) { /* ignore */ } lab(); });
    var t = document.getElementById('totop');
    function tt() { if (t) t.classList.toggle('on', window.scrollY > 400); }
    window.addEventListener('scroll', tt, { passive: true }); tt();
    if (t) t.addEventListener('click', function (e) { e.preventDefault(); window.scrollTo({ top: 0, behavior: 'smooth' }); });
})();
