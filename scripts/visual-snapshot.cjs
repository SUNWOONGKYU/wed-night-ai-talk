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

    for (const vp of VIEWPORTS) {
        await page.setViewport({ width: vp.width, height: vp.height });
        for (const p of PAGES) {
            const name = `${vp.name}${p.replace(/\//g, '_').replace('.html', '')}.png`;
            const file = path.join(OUT, name);
            try {
                await page.goto(BASE + p, { waitUntil: 'networkidle2', timeout: 45000 });
                await new Promise(r => setTimeout(r, 3000));
                // 애니메이션·전환을 멈춰 매번 같은 그림이 나오게 한다
                await page.addStyleTag({ content: '*,*::before,*::after{animation:none!important;transition:none!important;}' });
                await new Promise(r => setTimeout(r, 500));
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
        console.log('\n(달라졌다고 반드시 잘못된 건 아니다 — 게시글 조회수처럼 매번 바뀌는 값이 있으면');
        console.log(' 차이가 난다. 두 이미지를 직접 비교해 판단할 것.)');
    }
})().catch(e => { console.error('스냅샷 오류:', e); process.exit(3); });
