// ========== 원맥스 One MACS 상품 상세 (market/onemacs.html) — 하단 고정 CTA ==========
// 히어로의 "9,900원에 받기" 버튼이 화면 위로 지나가면 하단 고정 CTA 를 보인다. (카탈로그 v3 인라인 스크립트 → CSP 때문에 파일로)
(function () {
    'use strict';
    var s = document.getElementById('sticky'), h = document.getElementById('heroCta');
    if (!s) return;
    if (!h || !('IntersectionObserver' in window)) { s.classList.add('on'); return; }
    new IntersectionObserver(function (e) {
        s.classList.toggle('on', !e[0].isIntersecting && e[0].boundingClientRect.top < 0);
    }, { threshold: 0 }).observe(h);
})();
