// 구버전 랜딩 페이지 공용 스크립트 (ai-study-circle.html, v0/index.html)
//
// 두 파일은 현행 사이트에서 어디에도 링크되지 않는 예전 버전이다. 다만 배포에는
// 남아 있어 주소를 직접 치면 열린다. 2026-09-02 CSP 에서 script-src 의
// 'unsafe-inline' 을 제거하면서, 이 페이지들에 들어 있던 동일한 인라인 스크립트를
// 이 파일로 옮겼다 (두 파일의 내용이 완전히 같아 하나로 합쳤다).

(function () {
    'use strict';

    var reveals = document.querySelectorAll('.reveal');
    if (reveals.length) {
        var observer = new IntersectionObserver(function (entries) {
            entries.forEach(function (entry) {
                if (entry.isIntersecting) {
                    entry.target.classList.add('visible');
                }
            });
        }, {
            threshold: 0.1,
            rootMargin: '0px 0px -50px 0px'
        });
        reveals.forEach(function (el) { observer.observe(el); });
    }

    // Stagger children animations
    document.querySelectorAll('.activities-grid .activity-card, .member-types .member-type')
        .forEach(function (el, i) {
            el.style.transitionDelay = (i * 0.08) + 's';
        });

    // 모바일 메뉴 토글 (예전엔 버튼에 인라인 onclick 으로 붙어 있었다)
    var navBtn = document.querySelector('[data-action="toggle-nav"]');
    if (navBtn) {
        navBtn.addEventListener('click', function () {
            var links = document.querySelector('.nav-links');
            if (links) links.classList.toggle('show');
        });
    }

    // Smooth nav background on scroll
    window.addEventListener('scroll', function () {
        var nav = document.querySelector('nav');
        if (!nav) return;
        nav.style.background = window.scrollY > 50
            ? 'rgba(10, 10, 15, 0.95)'
            : 'rgba(10, 10, 15, 0.8)';
    });
})();
