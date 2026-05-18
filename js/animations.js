// ========== Animation & Design Upgrade ==========
// GSAP ScrollTrigger + Canvas Particle System
// =============================================

(function () {
    'use strict';

    const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const isMobile = /Android|iPhone|iPad|iPod/i.test(navigator.userAgent) || window.innerWidth < 768;

    // ========== 2. Typing Effect ==========
    function initTypingEffect() {
        const subtitle = document.querySelector('.hero-subtitle');
        if (!subtitle) return;

        const originalHTML = subtitle.innerHTML;
        const text = subtitle.textContent;
        subtitle.textContent = '';
        subtitle.style.opacity = '1';
        subtitle.classList.add('typing-active');

        let idx = 0;
        const speed = 30;

        function type() {
            if (idx < text.length) {
                subtitle.textContent += text.charAt(idx);
                idx++;
                setTimeout(type, speed);
            } else {
                subtitle.innerHTML = originalHTML;
                subtitle.classList.remove('typing-active');
            }
        }

        setTimeout(type, 1200);
    }

    // ========== GSAP Scroll Animations ==========
    // NOTE: NO opacity animations — only transform (y, x, scale, rotation).
    // This guarantees elements are always visible even if GSAP/ScrollTrigger fails.
    function initScrollAnimations() {
        gsap.registerPlugin(ScrollTrigger);

        // -- Section slide-up + scale --
        gsap.utils.toArray('section:not(.hero)').forEach(section => {
            gsap.from(section, {
                scrollTrigger: {
                    trigger: section,
                    start: 'top 85%',
                    end: 'top 50%',
                    toggleActions: 'play none none none'
                },
                y: 40,
                scale: 0.98,
                duration: 0.8,
                ease: 'power3.out'
            });
        });

        // -- Section labels & titles --
        gsap.utils.toArray('.section-label, .section-title, .section-desc').forEach(el => {
            gsap.from(el, {
                scrollTrigger: {
                    trigger: el,
                    start: 'top 85%',
                    toggleActions: 'play none none none'
                },
                y: 20,
                duration: 0.6,
                ease: 'power2.out'
            });
        });

        // -- Activity cards stagger --
        gsap.utils.toArray('.activities-grid').forEach(grid => {
            const cards = grid.querySelectorAll('.activity-card');
            gsap.from(cards, {
                scrollTrigger: {
                    trigger: grid,
                    start: 'top 80%',
                    toggleActions: 'play none none none'
                },
                y: 30,
                stagger: 0.08,
                duration: 0.5,
                ease: 'power2.out'
            });
        });

        // -- Member type cards stagger --
        gsap.utils.toArray('.member-types').forEach(grid => {
            const cards = grid.querySelectorAll('.member-type');
            gsap.from(cards, {
                scrollTrigger: {
                    trigger: grid,
                    start: 'top 80%',
                    toggleActions: 'play none none none'
                },
                y: 30,
                stagger: 0.08,
                duration: 0.5,
                ease: 'power2.out'
            });
        });

        // -- Schedule card --
        gsap.utils.toArray('.schedule-card').forEach(card => {
            gsap.from(card, {
                scrollTrigger: {
                    trigger: card,
                    start: 'top 80%',
                    toggleActions: 'play none none none'
                },
                y: 30,
                scale: 0.96,
                duration: 0.8,
                ease: 'power3.out'
            });
        });

        // -- Timeline items stagger --
        gsap.utils.toArray('.timeline').forEach(tl => {
            const items = tl.querySelectorAll('.timeline-item');
            gsap.from(items, {
                scrollTrigger: {
                    trigger: tl,
                    start: 'top 80%',
                    toggleActions: 'play none none none'
                },
                x: -20,
                stagger: 0.15,
                duration: 0.6,
                ease: 'power2.out'
            });
        });

        // -- Location cards --
        gsap.utils.toArray('.location-grid').forEach(grid => {
            const cards = grid.querySelectorAll('.location-card');
            gsap.from(cards, {
                scrollTrigger: {
                    trigger: grid,
                    start: 'top 80%',
                    toggleActions: 'play none none none'
                },
                y: 30,
                stagger: 0.15,
                duration: 0.7,
                ease: 'power2.out'
            });
        });

        // -- About grid --
        gsap.utils.toArray('.about-grid').forEach(grid => {
            const aboutText = grid.querySelector('.about-text');
            const aboutValues = grid.querySelector('.about-values');
            if (aboutText) {
                gsap.from(aboutText, {
                    scrollTrigger: {
                        trigger: grid,
                        start: 'top 80%',
                        toggleActions: 'play none none none'
                    },
                    x: -30,
                    duration: 0.8,
                    ease: 'power3.out'
                });
            }
            if (aboutValues) {
                gsap.from(aboutValues, {
                    scrollTrigger: {
                        trigger: grid,
                        start: 'top 80%',
                        toggleActions: 'play none none none'
                    },
                    x: 30,
                    duration: 0.8,
                    delay: 0.2,
                    ease: 'power3.out'
                });
            }
        });

        // -- Value items stagger --
        gsap.utils.toArray('.about-values').forEach(vals => {
            const items = vals.querySelectorAll('.value-item');
            gsap.from(items, {
                scrollTrigger: {
                    trigger: vals,
                    start: 'top 80%',
                    toggleActions: 'play none none none'
                },
                x: 20,
                stagger: 0.1,
                duration: 0.5,
                ease: 'power2.out'
            });
        });
    }

    // ========== 6. Parallax ==========
    function initParallax() {
        gsap.utils.toArray('.bg-orb').forEach((orb, i) => {
            const speed = 0.3 + i * 0.15;
            gsap.to(orb, {
                y: () => window.innerHeight * speed,
                ease: 'none',
                scrollTrigger: {
                    trigger: document.body,
                    start: 'top top',
                    end: 'bottom bottom',
                    scrub: 1
                }
            });
        });
    }

    // ========== 7. Card 3D Tilt ==========
    function initCardTilt() {
        if (isMobile) return;

        const cards = document.querySelectorAll('.activity-card, .value-item, .location-card, .member-type');

        cards.forEach(card => {
            card.addEventListener('mouseenter', () => {
                card.style.transition = 'transform 0.1s ease-out';
            });

            card.addEventListener('mousemove', (e) => {
                const rect = card.getBoundingClientRect();
                const x = e.clientX - rect.left;
                const y = e.clientY - rect.top;
                const centerX = rect.width / 2;
                const centerY = rect.height / 2;

                const rotateX = ((y - centerY) / centerY) * -6;
                const rotateY = ((x - centerX) / centerX) * 6;

                card.style.transform = `perspective(800px) rotateX(${rotateX}deg) rotateY(${rotateY}deg) translateY(-4px)`;
            });

            card.addEventListener('mouseleave', () => {
                card.style.transition = 'transform 0.4s ease-out';
                card.style.transform = '';
            });
        });
    }

    // ========== 8. Count-Up ==========
    function initCountUp() {
        const stats = document.querySelectorAll('.hero-stat .number');

        stats.forEach(stat => {
            const text = stat.textContent.trim();
            const match = text.match(/^(\d+)/);
            if (!match) return;

            const target = parseInt(match[1]);
            const suffix = text.replace(/^\d+/, '');

            stat.textContent = '0' + suffix;

            gsap.to({ val: 0 }, {
                val: target,
                duration: 2,
                ease: 'power2.out',
                scrollTrigger: {
                    trigger: stat,
                    start: 'top 90%',
                    once: true
                },
                onUpdate: function () {
                    stat.textContent = Math.round(this.targets()[0].val) + suffix;
                }
            });
        });
    }

    // ========== 9. Scroll Progress Bar ==========
    function initProgressBar() {
        const bar = document.querySelector('.scroll-progress-fill');
        if (!bar) return;

        gsap.to(bar, {
            scaleX: 1,
            ease: 'none',
            scrollTrigger: {
                trigger: document.body,
                start: 'top top',
                end: 'bottom bottom',
                scrub: 0.3
            }
        });
    }

    // ========== 10. Nav Scroll Response ==========
    function initNavScroll() {
        const nav = document.querySelector('nav');
        if (!nav) return;

        ScrollTrigger.create({
            trigger: document.body,
            start: 'top top',
            end: 'bottom bottom',
            onUpdate: (self) => {
                if (self.scroll() > 50) {
                    nav.style.background = 'var(--bg-nav-scroll)';
                    nav.style.webkitBackdropFilter = 'blur(30px)';
                    nav.style.backdropFilter = 'blur(30px)';
                    nav.style.borderBottomColor = 'rgba(26, 34, 56, 0.1)';
                } else {
                    nav.style.background = 'var(--bg-nav)';
                    nav.style.webkitBackdropFilter = 'blur(20px)';
                    nav.style.backdropFilter = 'blur(20px)';
                    nav.style.borderBottomColor = 'rgba(10, 74, 138, 0.5)';
                }
            }
        });
    }

    // ========== Init Everything ==========
    function init() {
        // Remove any leftover .reveal classes
        document.querySelectorAll('.reveal').forEach(el => {
            el.classList.remove('reveal');
        });

        if (prefersReducedMotion) {
            return;
        }

        // hero 배경은 정적 SVG 말풍선(.hero-bubbles)으로 처리 — JS 애니메이션 없음

        // Typing effect
        initTypingEffect();

        // GSAP animations (check if GSAP is loaded)
        if (typeof gsap !== 'undefined' && typeof ScrollTrigger !== 'undefined') {
            initScrollAnimations();
            initParallax();
            initCountUp();
            initProgressBar();
            initNavScroll();
        }

        // Card tilt (no GSAP dependency)
        initCardTilt();
    }

    // Wait for DOM
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }

})();
