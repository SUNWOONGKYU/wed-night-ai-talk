const path = require('path');
const puppeteer = require(path.join(process.env.APPDATA, 'npm', 'node_modules', 'puppeteer'));

(async () => {
    const b = await puppeteer.launch({ headless: 'new' });
    const p = await b.newPage();
    await p.setViewport({ width: 1280, height: 820, deviceScaleFactor: 2 });
    await p.goto('https://wed-night-ai-talk.vercel.app/', { waitUntil: 'networkidle2' });
    await new Promise(r => setTimeout(r, 2500));
    const v = await p.evaluate(() => {
        const u = document.querySelectorAll('.hero-bubbles use');
        return { count: u.length, opacities: [...u].map(x => x.getAttribute('opacity')) };
    });
    console.log('말풍선:', v.count, '개');
    console.log('opacity:', v.opacities.join(', '));
    const h = await p.$('.hero');
    if (h) await h.screenshot({ path: path.join(__dirname, '..', 'tmp', 'deployed_hero.png') });
    // 모바일
    const m = await b.newPage();
    await m.setViewport({ width: 393, height: 852, deviceScaleFactor: 2, isMobile: true });
    await m.goto('https://wed-night-ai-talk.vercel.app/', { waitUntil: 'networkidle2' });
    await new Promise(r => setTimeout(r, 2500));
    const mh = await m.$('.hero');
    if (mh) await mh.screenshot({ path: path.join(__dirname, '..', 'tmp', 'deployed_hero_mobile.png') });
    await b.close();
    console.log('Saved deployed_hero.png / deployed_hero_mobile.png');
})().catch(e => { console.error(e); process.exit(1); });
