const path = require('path');
const puppeteer = require(path.join(process.env.APPDATA, 'npm', 'node_modules', 'puppeteer'));

(async () => {
    const browser = await puppeteer.launch({ headless: 'new' });
    const page = await browser.newPage();
    await page.setCacheEnabled(false);
    const errors = [];
    page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
    page.on('pageerror', e => errors.push('PAGEERROR: ' + e.message));

    await page.goto('https://waat.community/speakup?_=' + Date.now(), { waitUntil: 'networkidle2', timeout: 60000 });
    await new Promise(r => setTimeout(r, 2500));

    const info = await page.evaluate(() => {
        const input = document.getElementById('post-image-input');
        const previews = document.getElementById('post-image-previews');
        const label = document.querySelector('.post-image-label');
        const jsHasUpload = typeof spUploadNewImages === 'function';
        const jsHasReset = typeof spResetImages === 'function';
        return {
            inputExists: !!input,
            inputAccept: input ? input.getAttribute('accept') : null,
            inputMultiple: input ? input.multiple : null,
            previewsExists: !!previews,
            labelText: label ? label.textContent.trim().slice(0, 30) : null,
            jsHasUpload, jsHasReset
        };
    });

    // 파일 선택 미리보기 동작(인증 불필요) — 가짜 파일 주입 후 change 발화
    const previewWorks = await page.evaluate(async () => {
        const input = document.getElementById('post-image-input');
        if (!input || typeof spNewImageFiles === 'undefined') return 'no-input';
        const dt = new DataTransfer();
        const bytes = new Uint8Array([0x89, 0x50, 0x4E, 0x47]);
        dt.items.add(new File([bytes], 'test.png', { type: 'image/png' }));
        input.files = dt.files;
        input.dispatchEvent(new Event('change', { bubbles: true }));
        await new Promise(r => setTimeout(r, 500));
        const thumbs = document.querySelectorAll('#post-image-previews .post-image-thumb').length;
        const img = document.querySelector('#post-image-previews .post-image-thumb img');
        const imgLoaded = !!(img && img.complete && img.naturalWidth > 0);
        const imgSrcScheme = img ? String(img.src).slice(0, 5) : null;
        return { pendingCount: spNewImageFiles.length, thumbs, imgLoaded, imgSrcScheme };
    });

    console.log(JSON.stringify({ info, previewWorks, consoleErrors: errors }, null, 2));
    await browser.close();
})().catch(e => { console.error('FAIL', e.message); process.exit(1); });
