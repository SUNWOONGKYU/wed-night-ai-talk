/**
 * 구매 후 설치까지 5단계 안내 — 문안 정본 (PO 확정 2026-09-25)
 *
 * 이 파일 하나만 문안을 가진다. 세 곳이 이것을 읽는다.
 *   · 카탈로그 market/<id>.html  — <script src="/js/install-steps.js"> , <section id="install" data-product="<id>">
 *   · 구매 확인 이메일 api/lib/mailer.js          — require('../../js/install-steps.js').emailHtml(id, {supportEmail})
 *   · 내려받기 페이지 api/download/[token].js     — require('../../js/install-steps.js').downloadHtml(id)
 * 문안을 고칠 때는 여기만 고친다. 상품별 줄은 그 상품에만 나온다.
 *
 * 글 표기: `...` 는 코드(경로·입력할 글자)로 그린다.
 * 사이트 CSP 가 <style> 요소를 막으므로(style-src-elem 'self') 화면 모양은 style 속성으로만 준다.
 */
(function (root) {
    'use strict';

    var TITLE = '구매 후 설치까지 5단계 안내';
    var IDS = ['onemacs', 'StockTradeAutoSystem', 'ReportWritingAgent'];

    /** 상품별 줄 */
    var PER = {
        onemacs: {
            unzip: '그대로 「압축 풀기」를 누르십시오. 설치할 때 `C:\\OneMACS` 폴더가 저절로 만들어집니다.',
            cmd: 'One MACS 폴더의 CLAUDE_CODE_지시문.md 를 읽고 그대로 수행해서 설치해줘.',
            login: '로그인은 Claude Code가 대신하지 않습니다. 물어보면 본인이 직접 하십시오.',
            done: '마지막에 One MACS 연결 코드(영문과 숫자 8자리)가 나옵니다. 휴대폰에서 One MACS 모바일 앱을 열고 이 코드를 넣으면 PC와 연결됩니다.'
        },
        StockTradeAutoSystem: {
            unzip: '풀 곳에 `C:\\`를 적고 「압축 풀기」를 누르십시오. `C:\\StockTradeAutoSystem` 폴더가 생깁니다.',
            cmd: 'StockTradeAutoSystem 폴더의 CLAUDE_CODE_지시문.md 를 읽고 그대로 수행해서 설치해줘.',
            login: '로그인, 증권사 키 값, 텔레그램 토큰은 Claude Code가 대신 넣지 않습니다. 물어보면 본인이 직접 넣으십시오.',
            done: 'Claude Code가 「설치 완료 — 매매 자동화 봇 (모의투자 모드)」라고 알려 줍니다. 처음에는 모의투자로 시작합니다. 거래일 아침에는 텔레그램으로 「📋 오늘 매매 시작할까요?」가 오고, 살 시점이 오면 매수 승인 요청이 옵니다. 모의투자에서는 승인해도 실제 돈이 아닌 증권사 모의투자 계좌(가상 돈)로 주문이 나갑니다.'
        },
        ReportWritingAgent: {
            unzip: '그대로 「압축 풀기」를 누르십시오.',
            cmd: 'ReportWritingAgent 폴더의 CLAUDE_CODE_지시문.md 를 읽고 그대로 수행해서 설치해줘.',
            login: '로그인은 Claude Code가 대신하지 않습니다. 물어보면 본인이 직접 하십시오.',
            done: '브라우저에 보고서 작성 에이전트의 GUI 화면이 열립니다.'
        }
    };

    /** 공통 문장 — variant: 'web'(카탈로그) | 'email'(구매 확인 이메일) | 'download'(내려받기 페이지) */
    var S1_WEB = '결제를 하고 나면 구매 확인 이메일이 옵니다. 이메일에 있는 「패키지 내려받기」 버튼을 누르면 압축 파일(zip) 한 개가 내려옵니다. 이 버튼으로 다섯 번까지 내려받으실 수 있습니다.';
    var S1_EMAIL = '위의 「패키지 내려받기」 버튼을 누르면 압축 파일(zip) 한 개가 내려옵니다. 이 버튼으로 다섯 번까지 내려받으실 수 있습니다.';
    var DOWNLOAD_LEAD = '지금 내려받은 압축 파일로 2단계부터 하십시오.';

    /**
     * 상품 하나의 5단계. 블록: {p:글} | {pick:상품별 줄} | {cmd:붙여 넣을 한 줄}
     * @param {string} id
     * @param {{variant?:string, supportEmail?:string}} [opt]
     */
    function steps(id, opt) {
        opt = opt || {};
        var v = opt.variant || 'web';
        var P = PER[id];
        if (!P) return null;
        var ask3 = (v === 'email' && opt.supportEmail)
            ? '3) 그래도 안 되면 ' + opt.supportEmail + '로 주문번호와 이름을 적어서 연락해 주십시오.'
            : '3) 그래도 안 되면 구매 확인 이메일에 적힌 문의처로 주문번호와 이름을 적어서 연락해 주십시오.';
        return [
            { n: 1, title: '패키지 내려받기', blocks: [{ p: v === 'email' ? S1_EMAIL : S1_WEB }] },
            { n: 2, title: '압축 풀기', blocks: [
                { p: '내려받은 압축 파일(보통 「다운로드」 폴더에 있습니다)을 마우스 오른쪽 버튼으로 누르고 「압축 풀기」를 선택하십시오. 어디에 풀지 묻는 창이 뜨면 아래처럼 하십시오.' },
                { pick: P.unzip },
                { p: '압축이 풀린 폴더는 그 안의 파일을 골라서 옮기지 말고, 폴더째 그대로 두십시오.' }
            ] },
            { n: 3, title: 'Claude Code에게 설치 맡기기', blocks: [
                { p: '압축을 푼 폴더를 열고, 빈 곳에서 마우스 오른쪽 버튼을 눌러 「터미널에서 열기」를 선택하십시오. 검은 창에 `claude`를 입력하고 Enter를 누르십시오. Claude Code가 켜지면 아래 한 줄을 그대로 붙여 넣고 Enter를 누르십시오.' },
                { cmd: P.cmd },
                { p: '설치는 Claude Code가 합니다. 중간에 몇 가지를 물으면 답만 하시면 됩니다. ' + P.login }
            ] },
            { n: 4, title: '설치 확인', blocks: [
                { p: '아래 화면이 보이면 설치가 끝난 것입니다.' },
                { pick: P.done }
            ] },
            { n: 5, title: '막혔을 때', blocks: [
                { p: '설치 중에 막히면 아래 순서로 해 보십시오.' },
                { p: '1) 그 자리에서 Claude Code에게 물어보십시오. 오류 메시지를 그대로 붙여 넣고 「왜 안 되는지 알려줘」라고 하면 됩니다.' },
                { p: '2) 압축을 푼 폴더 안의 설명서(파일 한 개)를 열어 보십시오. 막히기 쉬운 곳과 푸는 방법이 적혀 있습니다.' },
                { p: ask3 }
            ] }
        ];
    }

    function esc(s) {
        return String(s == null ? '' : s)
            .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
    }
    /** 글 → HTML. `...` 는 codeStyle 로 감싼다 */
    function inline(text, codeStyle) {
        return String(text).split('`').map(function (part, i) {
            return i % 2 ? '<code style="' + codeStyle + '">' + esc(part) + '</code>' : esc(part);
        }).join('');
    }

    /* ---------------- 이메일·내려받기 페이지용 (인라인 스타일, 밝은 바탕 고정) ---------------- */
    var E = {
        code: 'font-family:Consolas,\'JetBrains Mono\',monospace;font-size:13px;background:#F6F4EF;border-radius:4px;padding:1px 5px;color:#1A2238;',
        box: 'display:inline-block;margin:6px 0;padding:8px 12px;background:#F6F4EF;border-radius:8px;font-size:13px;color:#1A2238;font-family:Consolas,\'JetBrains Mono\',monospace;word-break:break-all;',
        stepTitle: 'font-size:14px;font-weight:800;color:#1A2238;margin:0;',
        p: 'margin:4px 0 0;color:#4A5670;font-size:14px;line-height:1.8;',
        pick: 'margin:6px 0 0;color:#1A2238;font-size:14px;line-height:1.8;border-left:3px solid #C9A961;padding-left:10px;'
    };
    function stepsInlineHtml(list) {
        return list.map(function (s) {
            var body = s.blocks.map(function (b) {
                if (b.cmd) return '<div style="' + E.box + '">' + esc(b.cmd) + '</div>';
                if (b.pick) return '<p style="' + E.pick + '">' + inline(b.pick, E.code) + '</p>';
                return '<p style="' + E.p + '">' + inline(b.p, E.code) + '</p>';
            }).join('');
            return '<div style="margin:0 0 16px;"><p style="' + E.stepTitle + '">' + s.n + '. ' + esc(s.title) + '</p>' + body + '</div>';
        }).join('');
    }

    /**
     * 구매 확인 이메일 안의 한 상품 블록 (기존 이메일의 흰 상자 모양)
     * @param {string} id
     * @param {{supportEmail?:string, heading?:string}} [opt]  heading 이 있으면 제목 앞에 붙인다(한 주문에 상품이 둘 이상일 때 상품 이름)
     */
    function emailHtml(id, opt) {
        opt = opt || {};
        var list = steps(id, { variant: 'email', supportEmail: opt.supportEmail });
        if (!list) return '';
        return '<div style="background:#fff;border:1px solid #EAEAEC;padding:18px 20px;border-radius:12px;margin-bottom:18px;">' +
            '<h3 style="font-size:15px;margin:0 0 12px;">' + (opt.heading ? esc(opt.heading) + ' — ' : '') + esc(TITLE) + '</h3>' +
            stepsInlineHtml(list) + '</div>';
    }

    /** 내려받기 페이지용 — 2~5단계 */
    function downloadHtml(id) {
        var list = steps(id, { variant: 'download' });
        if (!list) return '';
        return '<div style="text-align:left;">' +
            '<p style="font-size:15px;font-weight:800;color:#1A2238;margin:0 0 6px;">' + esc(TITLE) + '</p>' +
            '<p style="' + E.p + 'margin:0 0 12px;">' + esc(DOWNLOAD_LEAD) + '</p>' +
            stepsInlineHtml(list.slice(1)) + '</div>';
    }

    /* ---------------- 카탈로그 (브라우저) — 사이트 테마 변수로 다크/라이트 둘 다 ---------------- */
    var W = {
        stack: 'margin-top:18px;display:flex;flex-direction:column;gap:14px;',
        step: 'background:var(--card);border:1px solid var(--line);border-radius:16px;padding:18px;',
        row: 'display:flex;gap:12px;align-items:flex-start;',
        body: 'flex:1;min-width:0;',
        h3: 'margin:0 0 6px;',
        p: 'font-size:15px;line-height:1.7;color:var(--fg2);margin:6px 0 0;',
        pick: 'font-size:15px;line-height:1.7;color:var(--fg);margin:8px 0 0;border-left:3px solid var(--accent);padding-left:10px;',
        code: 'font-family:Consolas,\'JetBrains Mono\',monospace;font-size:.92em;background:var(--code-bg);color:var(--code-fg);border:1px solid var(--line);border-radius:6px;padding:1px 6px;',
        cmd: 'display:flex;flex-wrap:wrap;gap:8px;align-items:stretch;margin:10px 0 6px;background:var(--code-bg);border:1px solid var(--accent);border-radius:12px;padding:10px 12px;',
        cmdCode: 'flex:1 1 220px;font-family:Consolas,\'JetBrains Mono\',monospace;font-size:14px;color:var(--code-fg);word-break:break-all;line-height:1.5;align-self:center;background:none;border:0;padding:0;',
        copy: 'flex:none;background:var(--accent);color:var(--btn-fg);border:0;border-radius:9px;padding:0 14px;font-weight:700;font-size:13px;cursor:pointer;font-family:inherit;min-height:36px;'
    };
    function webHtml(id) {
        var list = steps(id, { variant: 'web' });
        if (!list) return '';
        return '<h2>' + esc(TITLE) + '</h2><div style="' + W.stack + '">' + list.map(function (s) {
            var body = s.blocks.map(function (b) {
                if (b.cmd) {
                    return '<div style="' + W.cmd + '"><code style="' + W.cmdCode + '">' + esc(b.cmd) + '</code>' +
                        '<button type="button" data-install-copy="' + esc(b.cmd) + '" style="' + W.copy + '">복사</button></div>';
                }
                if (b.pick) return '<p style="' + W.pick + '">' + inline(b.pick, W.code) + '</p>';
                return '<p style="' + W.p + '">' + inline(b.p, W.code) + '</p>';
            }).join('');
            return '<div style="' + W.step + '"><div style="' + W.row + '"><span class="num">' + s.n + '</span>' +
                '<div style="' + W.body + '"><h3 style="' + W.h3 + '">' + esc(s.title) + '</h3>' + body + '</div></div></div>';
        }).join('') + '</div>';
    }

    /** 페이지의 [data-product] 설치 섹션을 채운다. 안의 [data-install-steps] 가 있으면 거기에, 없으면 .wrap 끝에 */
    function mount(doc) {
        doc = doc || (typeof document !== 'undefined' ? document : null);
        if (!doc) return;
        var secs = doc.querySelectorAll('section#install[data-product], [data-install-product]');
        Array.prototype.forEach.call(secs, function (sec) {
            var id = sec.getAttribute('data-product') || sec.getAttribute('data-install-product');
            var html = webHtml(id);
            if (!html) return;
            var slot = sec.querySelector('[data-install-steps]') || sec.querySelector('.wrap') || sec;
            var holder = doc.createElement('div');
            holder.innerHTML = html;
            while (holder.firstChild) slot.appendChild(holder.firstChild);
        });
        Array.prototype.forEach.call(doc.querySelectorAll('[data-install-copy]'), function (btn) {
            btn.addEventListener('click', function () {
                var text = btn.getAttribute('data-install-copy');
                try {
                    var nav = doc.defaultView && doc.defaultView.navigator;
                    if (!nav || !nav.clipboard || !nav.clipboard.writeText) return;
                    nav.clipboard.writeText(text).then(function () {
                        btn.textContent = '복사됨';
                        btn.style.background = 'var(--ok)';
                        btn.style.color = 'var(--on-ok)';
                        setTimeout(function () {
                            btn.textContent = '복사';
                            btn.style.background = 'var(--accent)';
                            btn.style.color = 'var(--btn-fg)';
                        }, 1600);
                    }, function () { /* 실패하면 조용히 무시 */ });
                } catch (e) { /* 조용히 무시 */ }
            });
        });
    }

    var API = { TITLE: TITLE, IDS: IDS, steps: steps, emailHtml: emailHtml, downloadHtml: downloadHtml, webHtml: webHtml, mount: mount };

    if (typeof module === 'object' && module.exports) {
        module.exports = API;
    } else {
        root.InstallSteps = API;
        if (root.document) {
            if (root.document.readyState === 'loading') root.document.addEventListener('DOMContentLoaded', function () { mount(root.document); });
            else mount(root.document);
        }
    }
})(this);
