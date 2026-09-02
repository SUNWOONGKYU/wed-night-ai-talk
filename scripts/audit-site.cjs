// 사이트 전수 점검 — 죽은 링크 / 클릭 안 되는 버튼 / 콘솔 오류
//
// CLAUDE.md UI 검증 철칙: "curl 200 ≠ 동작함".
// href 없는 <a>, 아무 동작도 없는 <button>, 404 로 가는 링크를 정적으로 잡아낸다.
//
// 사용법: node scripts/audit-site.cjs [BASE_URL]
const path = require('path');
const puppeteer = require(path.join(process.env.APPDATA, 'npm', 'node_modules', 'puppeteer'));

const BASE = (process.argv[2] || 'https://waat.community').replace(/\/$/, '');
const PAGES = ['/index.html', '/speakup.html', '/profile.html', '/admin.html',
               '/privacy.html', '/terms.html', '/unsubscribe.html'];

(async () => {
    const browser = await puppeteer.launch({ headless: 'new' });
    const page = await browser.newPage();
    const findings = [];
    const checked = new Map();   // url → status

    async function statusOf(url) {
        if (checked.has(url)) return checked.get(url);
        let st = 0;
        try {
            const r = await page.evaluate(async (u) => {
                try {
                    const res = await fetch(u, { method: 'GET', redirect: 'follow' });
                    return res.status;
                } catch (e) { return -1; }
            }, url);
            st = r;
        } catch (e) { st = -1; }
        checked.set(url, st);
        return st;
    }

    for (const p of PAGES) {
        const errs = [];
        page.removeAllListeners('pageerror');
        page.on('pageerror', e => errs.push(String(e.message || e)));

        await page.goto(BASE + p, { waitUntil: 'networkidle2', timeout: 45000 });
        await new Promise(r => setTimeout(r, 2500));

        const info = await page.evaluate(() => {
            const abs = (h) => { try { return new URL(h, location.href).href; } catch { return null; } };
            const links = [];
            document.querySelectorAll('a').forEach(a => {
                const h = a.getAttribute('href');
                const label = (a.textContent || '').trim().slice(0, 30);
                if (h === null || h === '' ) { links.push({ kind: 'no-href', label }); return; }
                if (h === '#' || h.startsWith('javascript:')) { links.push({ kind: 'placeholder', label, href: h }); return; }
                if (h.startsWith('#') || h.startsWith('mailto:') || h.startsWith('tel:')) return;
                const u = abs(h);
                if (u && u.startsWith(location.origin)) links.push({ kind: 'internal', label, href: u });
            });
            // 아무 핸들러도 없어 보이는 버튼.
            //
            // 클릭 동작이 붙는 방식이 여러 가지라 정적으로는 단정할 수 없다:
            //   ① data-action 위임  ② id 로 직접 바인딩  ③ type=submit
            //   ④ 클래스 선택자로 바인딩/위임 (querySelectorAll('.x') 또는 closest('.x'))
            // ④는 마크업만 봐선 알 수 없어서, 2026-09-02 에 코드로 리스너 존재를 하나씩
            // 확인한 클래스를 아래에 적어 둔다. 여기 없는 새 버튼만 보고된다.
            const VERIFIED = [
                'ev-slot-del',      // admin.js:358  addEventListener
                'fmt-btn',          // speakup.js:1135 closest 위임
                'post-more-btn',    // speakup.js:628 addEventListener (변수로 바인딩)
                'waat-slot-btn',    // main.js:1204 querySelectorAll 후 바인딩
                'reaction-btn',     // speakup.js bindPostCardEvents
                'post-action-btn',  // speakup.js 게시글 수정·삭제
            ];
            const deadButtons = [];
            document.querySelectorAll('button').forEach(b => {
                const cls = String(b.className || '');
                const hasAction = b.hasAttribute('data-action') || b.hasAttribute('data-open-modal')
                    || b.hasAttribute('data-fmt') || b.type === 'submit' || b.id
                    || cls.includes('close') || cls.includes('tab') || cls.includes('menu')
                    || VERIFIED.some(v => cls.includes(v));
                if (!hasAction) deadButtons.push((b.textContent || '').trim().slice(0, 30) + ` [class=${cls}]`);
            });
            return { links, deadButtons };
        });

        for (const l of info.links) {
            if (l.kind === 'no-href') findings.push(`${p} — href 없는 <a>: "${l.label}"`);
            else if (l.kind === 'placeholder') {
                // href="#" 는 JS 로 여는 경우가 많아 정보성으로만 남긴다
            } else if (l.kind === 'internal') {
                const st = await statusOf(l.href);
                if (st >= 400 || st === -1) {
                    findings.push(`${p} — 깨진 링크(${st}): "${l.label}" → ${l.href.replace(BASE, '')}`);
                }
            }
        }
        for (const b of info.deadButtons) findings.push(`${p} — 동작 없는 <button> 의심: "${b}"`);
        for (const e of errs) findings.push(`${p} — JS 에러: ${e.slice(0, 120)}`);

        console.log(`  검사 완료 ${p}  (링크 ${info.links.length})`);
    }

    await browser.close();

    console.log('\n===== 발견 =====');
    if (findings.length === 0) console.log('  없음');
    else findings.forEach(f => console.log('  · ' + f));
    console.log(`\n총 ${findings.length}건`);
})().catch(e => { console.error('점검 오류:', e); process.exit(3); });
