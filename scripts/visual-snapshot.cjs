// 페이지 전체 스크린샷을 찍어 저장하고, 두 번째 실행 때 픽셀 단위로 비교한다.
//
// 인라인 style 을 CSS 클래스로 옮기는 작업은 "동작은 되는데 모양이 틀어지는" 실수가
// 나기 쉽다. 콘솔 에러도 안 나고 링크도 멀쩡해서 자동 점검으로는 안 잡힌다.
// → 작업 전 화면을 기준으로 저장해 두고, 작업 후 같은 화면과 비교한다.
//
// 사용법:
//   node scripts/visual-snapshot.cjs <BASE_URL> <출력폴더> [비교할_기준폴더]
const path = require('path');
const fs = require('fs');
const puppeteer = require(path.join(process.env.APPDATA, 'npm', 'node_modules', 'puppeteer'));

const BASE = (process.argv[2] || 'https://waat.community').replace(/\/$/, '');
const OUT = process.argv[3];
const BASELINE = process.argv[4] || null;

if (!OUT) {
    console.error('사용법: node scripts/visual-snapshot.cjs <BASE_URL> <출력폴더> [기준폴더]');
    process.exit(2);
}
fs.mkdirSync(OUT, { recursive: true });

const PAGES = ['/index.html', '/speakup.html', '/privacy.html', '/terms.html',
               '/unsubscribe.html', '/profile.html', '/admin.html'];
const VIEWPORTS = [{ name: 'desktop', width: 1280, height: 900 },
                   { name: 'mobile', width: 390, height: 844 }];

// PNG 를 원시 바이트로 비교한다. 같은 브라우저·같은 뷰포트라 렌더링이 결정적이면
// 완전히 일치한다. 다르면 어디가 달라졌는지는 사람이 두 이미지를 보고 판단한다.
function compare(a, b) {
    if (!fs.existsSync(a) || !fs.existsSync(b)) return 'missing';
    const x = fs.readFileSync(a), y = fs.readFileSync(b);
    if (x.length !== y.length) return `크기 다름 (${x.length} vs ${y.length} bytes)`;
    return x.equals(y) ? 'same' : `내용 다름 (${x.length} bytes)`;
}

(async () => {
    const browser = await puppeteer.launch({ headless: 'new' });
    const page = await browser.newPage();
    const diffs = [];

    // 스크롤 연출(GSAP ScrollTrigger 등)이 매번 다르게 잡히지 않도록 모션을 줄인다.
    await page.emulateMediaFeatures([{ name: 'prefers-reduced-motion', value: 'reduce' }]);

    for (const vp of VIEWPORTS) {
        await page.setViewport({ width: vp.width, height: vp.height });
        for (const p of PAGES) {
            const name = `${vp.name}${p.replace(/\//g, '_').replace('.html', '')}.png`;
            const file = path.join(OUT, name);
            try {
                await page.goto(BASE + p, { waitUntil: 'networkidle2', timeout: 45000 });
                // 애니메이션이 끝난 뒤를 찍어야 매번 같은 그림이 나온다.
                //
                // ⚠️ 예전엔 addStyleTag 로 animation:none 을 주입했는데, 2026-09-02
                //    CSP 에서 style-src-elem 의 'unsafe-inline' 을 빼면서 그 주입이
                //    차단된다("Could not load style"). 사이트가 아니라 이 스크립트가
                //    막힌 것이다 — CSP 가 실제로 동작한다는 뜻이기도 하다.
                //    → 스타일을 주입하지 않고, 모션 감소를 흉내 낸 뒤 충분히 기다린다.
                await new Promise(r => setTimeout(r, 4500));
                await page.screenshot({ path: file, fullPage: true });
            } catch (e) {
                console.log(`  촬영 실패 ${name}: ${String(e.message || e).slice(0, 60)}`);
                continue;
            }
            if (BASELINE) {
                const r = compare(path.join(BASELINE, name), file);
                if (r !== 'same') diffs.push(`${name} — ${r}`);
                console.log(`  ${r === 'same' ? 'OK  ' : 'DIFF'} ${name}${r === 'same' ? '' : ' — ' + r}`);
            } else {
                console.log(`  저장 ${name}`);
            }
        }
    }
    await browser.close();

    if (BASELINE) {
        console.log(`\n===== 달라진 화면 ${diffs.length}건 =====`);
        diffs.forEach(d => console.log('  · ' + d));
        console.log('\n[읽는 법] 달라졌다고 곧 회귀는 아니다.');
        console.log(' 2026-09-02 에 같은 버전을 두 번 찍어 대조군을 만들어 본 결과,');
        console.log(' index / speakup / profile 의 desktop·mobile 5장은 아무것도 바꾸지 않아도');
        console.log(' 매번 수십 바이트씩 달라진다 (조회수 증가, 애니메이션 타이밍).');
        console.log(' 나머지 9장은 완전히 일치했다 — 그쪽이 달라지면 진짜 회귀를 의심할 것.');
        console.log(' 확신이 서지 않으면 같은 버전을 두 번 찍어 대조군부터 만들어라.');
    }
})().catch(e => { console.error('스냅샷 오류:', e); process.exit(3); });
