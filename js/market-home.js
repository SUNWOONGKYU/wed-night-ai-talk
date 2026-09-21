// ========== WAAT 앱마켓 홈 (market.html) — 앱 목록 렌더 (목록 하나, 앱마다 배너형) ==========
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

    // 앱 1개 = 배너형 카드 (로고 · 이름 2행 · 주제 · 부제 · 포함 구성 · 만든 곳 · 가격 · 버튼). 목록은 이것 하나뿐 — 별도 "판매 중인 앱" 그리드 없음(PO 2026-09-21)
    function feat(f) {
        var link = f.url ? esc(f.url) : '';
        var logo = f.img
            ? '<img class="logo" src="' + esc(f.img) + '" alt="" width="64" height="64">'
            : '<div class="logo" style="background:' + esc(f.color) + '">' + esc(f.icon) + '</div>';
        var price = f.soon
            ? '<div class="price"><span class="pill soon">' + esc(f.soonText || '출시 예정') + '</span></div>'
            : '<div class="price">' + esc(won(f.price)) + '<small>' + (f.price ? 'VAT 포함 · 1회' : '누구나') + '</small></div>';
        var cta = link
            ? '<div class="cta">' + (f.soon ? '' : '<a class="btn" href="' + link + '#buy">' + esc(won(f.price)) + '에 받기</a>') +
              '<a class="btn ghost" href="' + link + '">상세 보기</a></div>'
            : '';
        return '<div class="feat' + (f.soon ? ' soon' : '') + '"><div class="in">' + logo + '<div>' +
            '<span class="tag">' + esc(f.cat) + '</span>' +
            '<h2>' + esc(f.name) + (f.fullname ? '<small>' + esc(f.fullname) + '</small>' : '') + '</h2>' +
            '<p class="topic">' + esc(f.desc) + '</p>' + (f.sub ? '<p class="sub">' + esc(f.sub) + '</p>' : '') +
            (f.bundle && f.bundle.length ? '<p class="bundle">포함 구성: ' + esc(f.bundle.join(' · ')) + '</p>' : '') +
            (f.maker ? '<p class="maker-line">만든 곳: ' + esc(f.maker) + '</p>' : '') +
            '</div>' + price + '</div>' + cta + '<div class="bar"></div></div>';
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

    function init() {
        $('cats').addEventListener('click', function (e) {
            var el = e.target.closest('[data-cat]');
            if (!el) return;
            cat = el.getAttribute('data-cat'); render();
        });
        $('q').addEventListener('input', function (e) { q = e.target.value.trim().toLowerCase(); renderList(); });
        render();
    }

    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init); else init();
})();
