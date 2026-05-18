// ========== Animation & Design Upgrade ==========
// GSAP ScrollTrigger + Canvas Particle System
// =============================================

(function () {
    'use strict';

    const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const isMobile = /Android|iPhone|iPad|iPod/i.test(navigator.userAgent) || window.innerWidth < 768;

    // ========== 1. Hero Canvas — Constellation Particle System ==========
    class HeroCanvas {
        constructor(canvas) {
            this.canvas = canvas;
            this.ctx = canvas.getContext('2d');
            this.particles = [];
            this.mouse = { x: -9999, y: -9999 };
            this.isActive = true;
            this.particleCount = isMobile ? 24 : 50;
            this.mouseRadius = 200;

            this.resize();
            this.createParticles();
            this.bindEvents();
            this.animate();
        }

        resize() {
            const hero = this.canvas.parentElement;
            this.canvas.width = hero.offsetWidth;
            this.canvas.height = hero.offsetHeight;
        }

        createParticles() {
            this.particles = [];
            this.frame = 0;
            for (let i = 0; i < this.particleCount; i++) {
                this.particles.push({
                    x: Math.random() * this.canvas.width,
                    y: Math.random() * this.canvas.height,
                    vx: (Math.random() - 0.5) * 0.5,
                    vy: (Math.random() - 0.5) * 0.5,
                    radius: Math.random() * 2 + 1,
                    baseOpacity: Math.random() * 0.4 + 0.3,
                    // twinkle: 각 입자마다 다른 속도·위상으로 깜빡임
                    twinkleSpeed: Math.random() * 0.05 + 0.02,
                    twinklePhase: Math.random() * Math.PI * 2,
                    // 약 55%는 gold, 나머지는 navy — 흰 배경 + 테마 일치
                    gold: Math.random() < 0.55
                });
            }
        }

        bindEvents() {
            window.addEventListener('resize', () => {
                this.resize();
                this.createParticles();
            });

            if (!isMobile) {
                this.canvas.parentElement.addEventListener('mousemove', (e) => {
                    const rect = this.canvas.getBoundingClientRect();
                    this.mouse.x = e.clientX - rect.left;
                    this.mouse.y = e.clientY - rect.top;
                });

                this.canvas.parentElement.addEventListener('mouseleave', () => {
                    this.mouse.x = -9999;
                    this.mouse.y = -9999;
                });
            }

            document.addEventListener('visibilitychange', () => {
                this.isActive = !document.hidden;
                if (this.isActive) this.animate();
            });
        }

        drawParticles() {
            this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
            this.frame++;

            const GOLD = '201, 169, 97';
            const NAVY = '46, 58, 95';

            for (let i = 0; i < this.particles.length; i++) {
                const p = this.particles[i];

                p.x += p.vx;
                p.y += p.vy;

                if (p.x < 0 || p.x > this.canvas.width) p.vx *= -1;
                if (p.y < 0 || p.y > this.canvas.height) p.vy *= -1;

                const dx = p.x - this.mouse.x;
                const dy = p.y - this.mouse.y;
                const dist = Math.sqrt(dx * dx + dy * dy);
                if (dist < this.mouseRadius) {
                    const force = (this.mouseRadius - dist) / this.mouseRadius;
                    p.vx += (dx / dist) * force * 0.3;
                    p.vy += (dy / dist) * force * 0.3;
                }

                p.vx *= 0.99;
                p.vy *= 0.99;

                // twinkle: 0~1 사인파 → 밝기·크기·글로우에 반영
                const tw = 0.5 + 0.5 * Math.sin(this.frame * p.twinkleSpeed + p.twinklePhase);
                const opacity = p.baseOpacity * (0.25 + 0.75 * tw);
                const color = p.gold ? GOLD : NAVY;
                const r = p.radius * (0.8 + 0.5 * tw);

                // gold 입자는 반짝일 때 글로우 — 별처럼 보이게
                if (p.gold) {
                    this.ctx.shadowBlur = 8 * tw;
                    this.ctx.shadowColor = `rgba(${GOLD}, ${opacity})`;
                } else {
                    this.ctx.shadowBlur = 0;
                }
                this.ctx.beginPath();
                this.ctx.arc(p.x, p.y, r, 0, Math.PI * 2);
                this.ctx.fillStyle = `rgba(${color}, ${opacity})`;
                this.ctx.fill();
                this.ctx.shadowBlur = 0;
            }
        }

        animate() {
            if (!this.isActive) return;
            this.drawParticles();
            requestAnimationFrame(() => this.animate());
        }
    }

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

    // ========== 4. Gradient Pulse ==========
    function initGradientPulse() {
        const hero = document.querySelector('.hero');
        if (!hero) return;

        let hue = 0;
        function pulse() {
            hue = (hue + 0.1) % 360;
            const c1 = `hsla(${185 + Math.sin(hue * 0.02) * 15}, 100%, 50%, 0.03)`;
            const c2 = `hsla(${240 + Math.sin(hue * 0.015) * 20}, 80%, 60%, 0.02)`;
            hero.style.background = `radial-gradient(ellipse at 30% 50%, ${c1} 0%, transparent 60%),
                                     radial-gradient(ellipse at 70% 80%, ${c2} 0%, transparent 50%)`;
            requestAnimationFrame(pulse);
        }
        pulse();
    }

    // ========== 5. GSAP Scroll Animations ==========
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
                    nav.style.borderBottomColor = 'rgba(0, 229, 255, 0.1)';
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

        // Canvas
        const heroCanvas = document.getElementById('hero-canvas');
        if (heroCanvas) {
            new HeroCanvas(heroCanvas);
        }

        // Floating keywords — 미니멀 배경을 위해 비활성화
        // (떠다니는 영어 단어가 깔끔한 흰 배경과 어울리지 않음)

        // Typing effect
        initTypingEffect();

        // Gradient pulse
        initGradientPulse();

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
