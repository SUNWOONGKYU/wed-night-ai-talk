// ========== WAAT 앱마켓 홈 (market.html) — 카드 렌더 ==========
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

    function renderFeat() {
        var f = null;
        for (var i = 0; i < APPS.length; i++) if (APPS[i].featured) { f = APPS[i]; break; }
        if (!f) { $('feat').innerHTML = ''; return; }
        var link = f.url ? esc(f.url) : '#';
        $('feat').innerHTML =
            '<div class="in"><div><span class="tag">추천 · ' + esc(f.cat) + '</span>' +
            '<h2>' + esc(f.name) + (f.fullname ? '<small>' + esc(f.fullname) + '</small>' : '') + '</h2>' +
            '<p class="topic">' + esc(f.desc) + '</p>' + (f.sub ? '<p class="sub">' + esc(f.sub) + '</p>' : '') + '</div>' +
            '<div class="price">' + esc(won(f.price)) + '<small>VAT 포함 · 1회</small></div></div>' +
            '<div class="cta"><a class="btn" href="' + link + '#buy">' + esc(won(f.price)) + '에 받기</a>' +
            '<a class="btn ghost" href="' + link + '">자세히 보기</a></div><div class="bar"></div>';
    }

    function card(a) {
        var body =
            (a.img ? '<div class="ic" style="background:#131826;padding:0;overflow:hidden"><img src="' + esc(a.img) + '" alt="" width="56" height="56" style="width:100%;height:100%;display:block"></div>' : '<div class="ic" style="background:' + esc(a.color) + '">' + esc(a.icon) + '</div>') +
            '<div class="body"><b>' + esc(a.name) + '</b>' + (a.fullname ? '<small class="fullname">' + esc(a.fullname) + '</small>' : '') + '<p class="topic">' + esc(a.desc) + '</p>' + (a.sub ? '<small class="sub">' + esc(a.sub) + '</small>' : '') +
            '<div class="meta">' + (a.tags || []).map(pill).join('') + '</div>' +
            (a.bundle && a.bundle.length ? '<div class="bundle">포함 구성: ' + esc(a.bundle.join(' · ')) + '</div>' : '') +
            (a.maker ? '<div class="maker-line">만든 곳: ' + esc(a.maker) + '</div>' : '') + '</div>' +
            '<div class="pr">' + (a.soon
                ? '<span class="pill soon">' + esc(a.soonText || '출시 예정') + '</span>'
                : '<b>' + esc(won(a.price)) + '</b><small>' + (a.price ? 'VAT 포함' : '누구나') + '</small>') + '</div>';
        var cls = 'app' + (a.soon ? ' soon' : '');
        return a.url
            ? '<a class="' + cls + '" href="' + esc(a.url) + '">' + body + '</a>'
            : '<div class="' + cls + '" aria-disabled="true">' + body + '</div>';
    }

    function renderGrid() {
        var list = APPS.filter(function (a) {
            var okCat = cat === '전체' || a.cat === cat;
            var hay = (a.name + ' ' + a.sub + ' ' + a.desc + ' ' + (a.tags || []).join(' ') + ' ' + (a.bundle || []).join(' ')).toLowerCase();
            return okCat && (!q || hay.indexOf(q) !== -1);
        });
        $('cnt').textContent = list.length + '개';
        $('grid').innerHTML = list.length ? list.map(card).join('') : '<p class="empty">검색 결과가 없습니다.</p>';
    }

    function render() { renderCats(); renderFeat(); renderGrid(); }

    function init() {
        $('cats').addEventListener('click', function (e) {
            var el = e.target.closest('[data-cat]');
            if (!el) return;
            cat = el.getAttribute('data-cat'); render();
        });
        $('q').addEventListener('input', function (e) { q = e.target.value.trim().toLowerCase(); renderGrid(); });
        render();
    }

    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init); else init();
})();
