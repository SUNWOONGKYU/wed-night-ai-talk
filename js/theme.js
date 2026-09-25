// ========== AI 툴 마켓 다크/라이트 전환 (2026-09-21) ==========
// <head> 최상단에서 동기 로드(CSP 가 인라인 스크립트를 막으므로 외부 파일). 저장값(localStorage 'waat-theme')을
// 첫 그리기 전에 html[data-theme] 에 적용해 깜빡임이 없다. 저장값이 없으면 시스템 설정(prefers-color-scheme)을 css/theme.css 가 따른다.
// 헤더에 ☀/🌙 버튼을 넣어 수동 전환 · 저장. 색은 css/theme.css 토큰만 바뀐다.
(function () {
    'use strict';
    var KEY = 'waat-theme';
    var root = document.documentElement;
    var saved = null;
    try { saved = localStorage.getItem(KEY); } catch (e) { saved = null; }
    if (saved === 'light' || saved === 'dark') root.setAttribute('data-theme', saved);

    function current() {
        var a = root.getAttribute('data-theme');
        if (a === 'light' || a === 'dark') return a;
        return (window.matchMedia && window.matchMedia('(prefers-color-scheme: light)').matches) ? 'light' : 'dark';
    }
    function label(btn) {
        var c = current();
        btn.textContent = c === 'light' ? '🌙' : '☀';
        btn.setAttribute('aria-label', c === 'light' ? '어두운 화면으로 바꾸기' : '밝은 화면으로 바꾸기');
        btn.title = btn.getAttribute('aria-label');
    }
    function mount() {
        var inner = document.querySelector('nav.site-nav .nav-inner');
        if (!inner || inner.querySelector('.theme-btn')) return;
        var btn = document.createElement('button');
        btn.type = 'button'; btn.className = 'theme-btn';
        label(btn);
        btn.addEventListener('click', function () {
            var next = current() === 'light' ? 'dark' : 'light';
            root.setAttribute('data-theme', next);
            try { localStorage.setItem(KEY, next); } catch (e) { /* 저장 불가 환경 — 이번 화면만 바뀜 */ }
            label(btn);
        });
        var menu = inner.querySelector('.mobile-menu-btn');
        if (menu) inner.insertBefore(btn, menu); else inner.appendChild(btn);
        if (window.matchMedia) {
            try { window.matchMedia('(prefers-color-scheme: light)').addEventListener('change', function () { label(btn); }); } catch (e) { /* 구형 */ }
        }
    }
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', mount); else mount();
})();
