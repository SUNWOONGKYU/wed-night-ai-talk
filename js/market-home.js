// ========== WAAT AI 툴 마켓 홈 (market.html) — 툴 목록 렌더 (목록 하나, 툴마다 배너형) ==========
// 데이터: js/market-apps.js (window.MARKET_APPS / window.MARKET_CATS). CSP 가 인라인 스크립트·onclick 을 막으므로 전부 여기서 이벤트를 단다.
// 옛 링크 호환: /market#buy · /market#renew · /market#faq (카탈로그·메일·콘솔 페이지) → 상품 상세 /market/onemacs 로 보낸다.

(function () {
    'use strict';

    // ---------- 옛 링크 → 상세 ----------
    var h = window.location.hash;
    if (h === '#buy' || h === '#renew' || h === '#faq' || h === '#bot') {
        window.location.replace('/market/onemacs' + (h === '#bot' ? '#buy' : h));  // 봇 섹션은 상세에서 제거됨(포함 구성으로 통합) → 결제 블록으로
        return;
    }

    var APPS = window.MARKET_APPS || [];
    var CATS = window.MARKET_CATS || ['전체'];
    var cat = '전체', q = '';
    // 출시 모드 — GET /api/market-config 의 mode ('reserve' | 'sale'). 기본·fetch 실패 = reserve. launch:'config' 인 툴에만 적용.
    var mode = 'reserve', reserveCount = 0, stats = {};   // stats[app.id] = MarketAppInfo.loadStats 결과(요약 줄)
    var $ = function (id) { return document.getElementById(id); };

    function esc(s) {
        return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
            return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
        });
    }
    function won(n) { return n === null || n === undefined ? '' : (n === 0 ? '무료' : Number(n).toLocaleString('ko-KR') + '원'); }
    function pill(t) {
        var cls = 'pill' + (t === '무료' ? ' free' : '') + (t === '출시 예정' ? ' soon' : '');
        return '<span class="' + cls + '">' + esc(t) + '</span>';
    }

    function renderCats() {
        $('cats').innerHTML = CATS.map(function (c) {
            return '<button type="button" class="cat' + (c === cat ? ' on' : '') + '" data-cat="' + esc(c) + '">' + esc(c) + '</button>';
        }).join('');
    }

    // 툴 1개 = 배너형 카드 (로고 · 이름 2행 · 주제 · 부제 · 포함 구성 · 판매자 · 가격 · 버튼). 목록은 이것 하나뿐 — 별도 "판매 중인 툴" 그리드 없음(PO 2026-09-21)
    function feat(f) {
        var link = f.url ? esc(f.url) : '';
        var logo = f.img
            ? '<img class="logo" src="' + esc(f.img) + '" alt="" width="64" height="64">'
            : '<div class="logo" style="background:' + esc(f.color) + '">' + esc(f.icon) + '</div>';
        var reserve = f.launch === 'config' && mode === 'reserve' && !f.soon;   // 출시 전: 예약 카드
        var price = f.soon
            ? '<div class="price"><span class="pill soon">' + esc(f.soonText || '출시 예정') + '</span></div>'
            : reserve
            ? '<div class="price">' + esc(won(f.price)) + '<small>출시 가격 · VAT 포함</small><span class="pill soon">출시 예정 · 예약 받는 중</span>' +
              (reserveCount > 0 ? '<span class="rs-count">지금까지 ' + esc(reserveCount.toLocaleString('ko-KR')) + '명 예약</span>' : '') + '</div>'
            : '<div class="price">' + esc(won(f.price)) + '<small>' + (f.price ? 'VAT 포함 · 1회' : '누구나') + '</small></div>';
        var cta = link
            ? '<div class="cta">' + (f.soon ? '' : reserve
                  ? '<a class="btn" href="' + link + '#reserve">예약하기</a>'
                  : '<a class="btn" href="' + link + '#buy">' + esc(won(f.price)) + '에 받기</a>') +
              '<a class="btn ghost" href="' + link + '">상세 보기</a></div>'
            : '';
        return '<div class="feat' + (f.soon ? ' soon' : '') + '"><div class="in">' + logo + '<div>' +
            '<span class="tag">' + esc(f.cat) + '</span>' +
            '<h2>' + esc(f.name) + (f.fullname ? '<small>' + esc(f.fullname) + '</small>' : '') + '</h2>' +
            '<p class="topic">' + esc(f.desc) + '</p>' + (f.sub ? '<p class="sub">' + esc(f.sub) + '</p>' : '') +
            (f.bundle && f.bundle.length ? '<p class="bundle">포함 구성: ' + esc(f.bundle.join(' · ')) + '</p>' : '') +
            (f.seller ? '<p class="seller-line">판매자: ' + esc(typeof f.seller === 'string' ? f.seller : (f.seller.name || '')) + '</p>' : '') +
            '</div>' + price + '</div>' + (stats[f.id] && window.MarketAppInfo ? window.MarketAppInfo.summaryHtml(f.id, stats[f.id], { age: f.age, url: f.url }) : '') + cta + '<div class="bar"></div></div>';
    }

    function renderList() {
        var list = APPS.filter(function (a) {
            var okCat = cat === '전체' || a.cat === cat;
            var hay = (a.name + ' ' + (a.fullname || '') + ' ' + a.sub + ' ' + a.desc + ' ' + (a.tags || []).join(' ') + ' ' + (a.bundle || []).join(' ')).toLowerCase();
            return okCat && (!q || hay.indexOf(q) !== -1);
        });
        // 캐시된 옛 market.html(#feat/#grid 구조)에서도 목록이 비지 않도록 #list 없으면 #feat 에 그린다
        var host = $('list') || $('feat');
        if (!host) return;
        var g = $('grid'); if (g) g.innerHTML = ''; var c = $('cnt'); if (c) c.textContent = '';
        host.innerHTML = list.length ? list.map(feat).join('') : '<p class="empty">검색 결과가 없습니다.</p>';
    }

    function render() { renderCats(); renderList(); }

    // 출시 모드·예약 수 — 받는 대로 다시 그린다 (첫 렌더는 기본 reserve 로 즉시)
    function loadLaunch() {
        if (!APPS.some(function (a) { return a.launch === 'config'; })) return;
        fetch('/api/market-config', { cache: 'no-store' }).then(function (r) { return r.ok ? r.json() : null; }).then(function (c) {
            var m = c && c.mode === 'sale' ? 'sale' : 'reserve';
            if (m !== mode) { mode = m; renderList(); }
            if (mode === 'reserve') {
                return fetch('/api/reserve-count').then(function (r) { return r.ok ? r.json() : null; }).then(function (d) {
                    var n = d && parseInt(d.count, 10) || 0;
                    if (n !== reserveCount) { reserveCount = n; renderList(); }
                });
            }
        }).catch(function (e) { console.warn('market-config 실패 (정적 미리보기?) — reserve 로 표시:', e); });
        // 요약 줄(★평점·다운로드/예약·연령·용량) — 실제 값만. js/market-appinfo.js
        if (window.MarketAppInfo) {
            APPS.filter(function (a) { return a.launch === 'config'; }).forEach(function (a) {
                window.MarketAppInfo.loadStats(a.id).then(function (st) { stats[a.id] = st; renderList(); }).catch(function () { /* 없으면 요약 줄 생략 */ });
            });
        }
    }

    function init() {
        $('cats').addEventListener('click', function (e) {
            var el = e.target.closest('[data-cat]');
            if (!el) return;
            cat = el.getAttribute('data-cat'); render();
        });
        $('q').addEventListener('input', function (e) { q = e.target.value.trim().toLowerCase(); renderList(); });
        render();
        loadLaunch();
    }

    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init); else init();
})();
