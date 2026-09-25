// ========== 툴 공통 "툴 정보" 블록 — 상단 요약 줄(카드·상세) + 상세 "툴 정보" 표 ==========
// 데이터: js/market-apps.js 의 APPS 항목 필드(실제 값만 — 없는 필드는 항목 숨김) + API(단일 소스):
//   /api/market-config(version·updated·mode) · /api/market-stats(downloads·sizeLabel) · /api/reserve-count · /api/reviews?summary=1
// 상세: <div data-appinfo-summary> (요약 줄) · <div id="appinfo"> (표). 홈: market-home.js 가 summaryHtml() 을 사용한다.
// 설계: 브릿지 2026_09_21__PC2안_마켓리뷰댓글_시안.md 부록(PC3 검토 통과 · 수정 4건 반영)
(function () {
    'use strict';
    function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
    function num(n) { return Number(n || 0).toLocaleString('ko-KR'); }
    async function getJson(url) { try { var r = await fetch(url); return r.ok ? await r.json() : null; } catch (e) { return null; } }

    /** 툴 하나의 실시간 값 — {mode, version, updated, downloads, sizeLabel, reserveCount, reviewCount, avg} (없으면 null) */
    async function loadStats(app) {
        var out = { mode: 'reserve', version: null, updated: null, downloads: null, sizeLabel: null, reserveCount: null, reviewCount: 0, avg: null };
        var cfg = window.MARKET_CONFIG || await getJson('/api/market-config');
        if (cfg) { out.mode = cfg.mode === 'sale' ? 'sale' : 'reserve'; if (cfg.product) { out.version = cfg.product.version || null; out.updated = cfg.product.updated || null; } }
        var rs = await Promise.all([getJson('/api/market-stats?app=' + encodeURIComponent(app)), getJson('/api/reviews?app=' + encodeURIComponent(app) + '&summary=1'), out.mode === 'reserve' ? getJson('/api/reserve-count') : null]);
        if (rs[0]) { out.downloads = rs[0].downloads == null ? null : Number(rs[0].downloads); out.sizeLabel = rs[0].sizeLabel || null; }
        if (rs[1]) { out.reviewCount = Number(rs[1].count || 0); out.avg = rs[1].avg == null ? null : Number(rs[1].avg); }
        if (rs[2]) out.reserveCount = Number(rs[2].count || 0);
        return out;
    }

    /** 요약 줄 HTML — ★평점(리뷰 N) · 다운로드 N회(예약 모드: 예약 N명) · 연령 · 용량. 값 없는 칸은 뺀다 */
    function summaryHtml(app, st, opts) {
        var cells = [];
        var rvUrl = (opts && opts.url ? opts.url : '/market/' + app) + '/reviews';
        if (st.reviewCount > 0 && st.avg != null) cells.push('<a href="' + esc(rvUrl) + '"><b><span class="star">★</span> ' + esc(st.avg.toFixed(1)) + '</b><small>리뷰 ' + num(st.reviewCount) + '</small></a>');
        else cells.push('<a href="' + esc(rvUrl) + '"><b>-</b><small>아직 리뷰 없음</small></a>');
        if (st.mode === 'reserve') { if (st.reserveCount != null) cells.push('<div><b>' + num(st.reserveCount) + '명</b><small>예약</small></div>'); }
        else if (st.downloads != null) cells.push('<div><b>' + num(st.downloads) + '회</b><small>다운로드</small></div>');
        if (opts && opts.age) cells.push('<div><b>' + esc(opts.age) + '</b><small>연령</small></div>');
        if (st.sizeLabel) cells.push('<div><b>' + esc(st.sizeLabel) + '</b><small>용량</small></div>');
        return '<div class="sumline" style="grid-template-columns:repeat(' + cells.length + ',1fr)">' + cells.join('') + '</div>';
    }

    function item(k, v, wide) { return v ? '<div class="it' + (wide ? ' wide' : '') + '"><div class="k">' + esc(k) + '</div><div class="v">' + v + '</div></div>' : ''; }
    function list(arr) { return '<ul>' + arr.map(function (x) { return '<li>' + x + '</li>'; }).join('') + '</ul>'; }

    /** 상세 "툴 정보" 표 HTML (15항목 — 값이 없는 항목은 자동 숨김) */
    function tableHtml(a, st) {
        var h = '';
        h += item('버전', st.version ? esc(String(st.version).replace(/^v/i, '')) : '');
        h += item('업데이트 날짜', st.updated ? esc(st.updated) : '');
        h += item('출시 날짜', a.released ? esc(a.released) : (st.mode === 'reserve' ? '출시 예정' : ''));
        h += item('다운로드 크기', st.sizeLabel ? esc(st.sizeLabel) : '');
        h += item('필요한 Android 버전', a.android ? 'Android ' + esc(a.android) + ' 이상' : '');
        h += item('제공 형태', a.delivery ? esc(a.delivery.type) + (a.delivery.note ? '<small>' + esc(a.delivery.note) + '</small>' : '') : '');
        h += item('함께 필요한 것', a.needs && a.needs.length ? list(a.needs.map(esc)) : '', true);
        h += item('권한 ' + (a.permissions ? a.permissions.length + '개' : ''), a.permissions && a.permissions.length ? list(a.permissions.map(function (p) { return '<b>' + esc(p.name) + '</b> — ' + esc(p.why); })) : '', true);
        if (a.dataSafety) {
            var d = a.dataSafety, rows = [];
            if (d.summary) rows.push(esc(d.summary)); else {
            if (d.collect && d.collect.length) rows.push('<b>수집</b> — ' + d.collect.map(esc).join(' · '));
            if (d.onDevice && d.onDevice.length) rows.push('<b>툴 안에만 저장</b> — ' + d.onDevice.map(esc).join(' · '));
            if (d.share) rows.push('<b>제3자 공유</b> — ' + esc(d.share));
            if (d.deleteEmail) rows.push('<b>삭제 요청</b> — <a href="mailto:' + esc(d.deleteEmail) + '">' + esc(d.deleteEmail) + '</a>');
            }
            h += item('데이터 안전', (d.summary ? rows[0] : list(rows)) + (d.policy ? '<small><a href="' + esc(d.policy) + '">개인정보처리방침 보기</a></small>' : ''), true);
        }
        if (a.changelog && a.changelog.length) {
            var latest = a.changelog.slice(0, 3), older = a.changelog.slice(3);
            var ch = function (c) { return '<div class="ver">' + esc(c.ver) + (c.date ? '<small>' + esc(c.date) + '</small>' : '') + '</div>' + (c.notes && c.notes.length ? list(c.notes.map(esc)) : ''); };
            h += item('새로운 기능', '<div class="chg">' + latest.map(ch).join('') + (older.length ? '<details><summary>이전 버전 보기</summary>' + older.map(ch).join('') + '</details>' : '') + '</div>', true);
        }
        h += item('언어', a.lang ? esc(a.lang) : '');
        h += item('카테고리', a.cat ? esc(a.cat) : '');
        h += item('인앱 구매', a.iap === false ? '없음' : (a.iap === true ? '있음' : ''));
        h += item('가격', a.price === 0 ? '무료' : (a.price ? num(a.price) + '원 (1회)' : ''));
        h += item('판매자', a.seller ? esc(a.seller.name) + (a.seller.link ? ' · <a href="' + esc(a.seller.link) + '">판매자 정보 보기</a>' : '') : '');
        h += item('호환(태블릿)', a.tablet ? esc(a.tablet) : '');   // 실기기 미확인이면 필드 없음 → 숨김
        h += item('신고', a.reportEmail ? '<a href="mailto:' + esc(a.reportEmail) + '?subject=' + encodeURIComponent('[WAAT AI 툴 마켓] 부적절한 툴 신고 - ' + a.id) + '">부적절한 툴 신고</a>' : '');
        return '<div class="info">' + h + '</div>';
    }

    async function initDetail() {
        var host = document.querySelector('[data-appinfo-summary]'), table = document.getElementById('appinfo');
        if (!host && !table) return;
        var app = document.body.getAttribute('data-app') || 'onemacs';
        var a = (window.MARKET_APPS || []).filter(function (x) { return x.id === app; })[0] || { id: app };
        var st = await loadStats(app);
        if (host) host.innerHTML = summaryHtml(app, st, { age: a.age, url: a.url });
        if (table) table.innerHTML = tableHtml(a, st);
        var sz = document.querySelector('[data-appinfo="size"]'); if (sz && st.sizeLabel) sz.textContent = st.sizeLabel;
        var tab = document.getElementById('rv-tab-count'); if (tab) tab.textContent = st.reviewCount ? String(st.reviewCount) : '';
    }

    window.MarketAppInfo = { loadStats: loadStats, summaryHtml: summaryHtml, tableHtml: tableHtml };
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', initDetail); else initDetail();
})();
