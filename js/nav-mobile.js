// 모바일 메뉴 토글 (privacy.html, terms.html 등 단순 정적 페이지용)
//
// 2026-09-02 CSP 에서 script-src 의 'unsafe-inline' 을 제거하면서 인라인
// <script> 블록을 이 파일로 옮겼다.

(function () {
    'use strict';
    var btn = document.querySelector('.mobile-menu-btn');
    var links = document.querySelector('.nav-links');
    if (!btn || !links) return;
    btn.addEventListener('click', function () {
        links.classList.toggle('show');
    });
})();
