/**
 * 출시 통지(결제 안내) 도구 — PO 결정 2026-09-22 "B: 예약자에게 결제 안내 발송"
 * 출시 알림 예약자(Reservations 시트 status=RESERVED) 전원에게 "출시되었습니다 — 결제 안내" 이메일을 1회 보내고
 * Reservations 에 notifiedAt · status=NOTIFIED_PAY 를 기록한다(중복 발송 방지). 다운로드 링크·라이선스 키는 보내지 않는다
 * (결제 후 판매 페이지에서 이메일을 입력하면 그때 발송된다 — 기존 confirm-payment 흐름).
 *
 * ★ 실행은 PO 신호가 있을 때만. 기본은 dry-run(대상 목록만). 실제 발송은 --send.
 *
 * 사용법 (저장소 루트에서):
 *   npx vercel env pull .env.local                  # 시트·이메일 환경변수 임시 확보 (끝나면 .env.local 삭제)
 *   node scripts/notify-reservers-payment.js                    # dry-run: 대상 목록·제외 목록 출력, 발송 없음
 *   node scripts/notify-reservers-payment.js --send             # 실제 발송 + 시트 갱신
 *   node scripts/notify-reservers-payment.js --send --only=a@b.com   # 1명만(테스트)
 *   node scripts/notify-reservers-payment.js --send --limit=3        # 앞에서 N명만
 *   --exclude=a@b.com,c@d.com   테스트 주소 제외(쉼표). 환경변수 NOTIFY_EXCLUDE 도 같은 형식. example.com / test@ / +test 주소는 항상 제외
 *
 * 환경변수: GOOGLE_SERVICE_ACCOUNT, SPREADSHEET_ID, GMAIL_USER, GMAIL_APP_PASSWORD, BASE_URL(선택)
 */

const fs = require('fs');
const path = require('path');

['.env', '.env.local'].forEach(function (f) {
    const envPath = path.join(__dirname, '..', f);
    if (!fs.existsSync(envPath)) return;
    fs.readFileSync(envPath, 'utf8').replace(/^﻿/, '').split(/\r?\n/).forEach(function (line) {
        const mm = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
        if (mm && !process.env[mm[1]]) process.env[mm[1]] = mm[2].replace(/^["']|["']$/g, '');
    });
});

const args = process.argv.slice(2);
const SEND = args.indexOf('--send') !== -1;
const only = (args.find(a => a.indexOf('--only=') === 0) || '').slice(7).trim().toLowerCase();
const limit = parseInt((args.find(a => a.indexOf('--limit=') === 0) || '').slice(8), 10) || 0;
const excludeArg = (args.find(a => a.indexOf('--exclude=') === 0) || '').slice(10);
const EXCLUDE = new Set((excludeArg + ',' + (process.env.NOTIFY_EXCLUDE || '')).split(',').map(s => s.trim().toLowerCase()).filter(Boolean));
function isTestAddress(email) {
    const e = String(email || '').trim().toLowerCase();
    if (!e || EXCLUDE.has(e)) return true;
    return /@example\.(com|net|org)$/.test(e) || /^test@/.test(e) || /\+test@/.test(e) || /@test\./.test(e);
}

const { getReservations, updateReservation, saveEmailLog } = require('../api/lib/sheets.js');
const { sendLaunchPaymentEmail } = require('../api/lib/mailer.js');
const m = require('../api/lib/market.js');

(async function main() {
    const need = ['GOOGLE_SERVICE_ACCOUNT', 'SPREADSHEET_ID'].concat(SEND ? ['GMAIL_USER', 'GMAIL_APP_PASSWORD'] : []);
    const missing = need.filter(k => !process.env[k]);
    if (missing.length) { console.error('환경변수 없음: ' + missing.join(', ')); process.exit(1); }

    const base = m.clean(process.env.BASE_URL) || 'https://www.waat.community';
    const cfg = m.publicConfig();
    const pay = { price: cfg.product.price, kakaopayLink: cfg.kakaopayLink, bank: cfg.bank, expiryHours: cfg.expiryHours, maxDownloads: cfg.maxDownloads };

    const all = await getReservations();
    const reserved = all.filter(r => r.status === 'RESERVED');
    const skippedTest = reserved.filter(r => isTestAddress(r.email));
    let targets = reserved.filter(r => !isTestAddress(r.email));
    if (only) targets = targets.filter(r => r.email.trim().toLowerCase() === only);
    if (limit > 0) targets = targets.slice(0, limit);

    console.log(`예약 전체 ${all.length}명 · RESERVED ${reserved.length}명 · 이미 결제안내 보냄(NOTIFIED_PAY) ${all.filter(r => r.status === 'NOTIFIED_PAY').length}명 · 테스트 주소 제외 ${skippedTest.length}명 · 이번 대상 ${targets.length}명` + (SEND ? '  [실제 발송]' : '  [dry-run: 발송 안 함]'));
    skippedTest.forEach(r => console.log(`  (제외) ${r.reserveId}  ${r.email}`));
    targets.forEach((r, i) => console.log(`  ${i + 1}. ${r.reserveId}  ${r.email}  ${r.name || '-'}  (${r.createdAt})`));
    if (!SEND || !targets.length) return;

    const failed = [];
    for (let i = 0; i < targets.length; i++) {
        const r = targets[i];
        const email = r.email.trim();
        try {
            await sendLaunchPaymentEmail({ name: r.name, email, reserveId: r.reserveId, salesLink: `${base}/market/onemacs`, installLink: `${base}/market/onemacs/install`, pay });
            await updateReservation(r, { status: 'NOTIFIED_PAY', notifiedAt: new Date().toISOString() });
            try { if (saveEmailLog) await saveEmailLog({ orderId: r.reserveId, email, type: 'launch_payment', status: 'SENT' }); } catch (_) {}
            console.log(`  ✓ ${i + 1}/${targets.length} ${email}`);
        } catch (e) {
            failed.push({ email, error: e.message });
            console.error(`  ✗ ${i + 1}/${targets.length} ${email} — ${e.message}`);
        }
        await new Promise(res => setTimeout(res, 800)); // Gmail 발송 간격
    }
    console.log(`\n완료: 성공 ${targets.length - failed.length}명 · 실패 ${failed.length}명`);
    if (failed.length) { console.log('실패 목록:'); failed.forEach(f => console.log(`  ${f.email}: ${f.error}`)); process.exit(2); }
})().catch(e => { console.error('오류:', e.message); process.exit(1); });
