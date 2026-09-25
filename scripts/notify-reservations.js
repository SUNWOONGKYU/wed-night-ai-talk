/**
 * 출시 첫날 도구 — 출시 알림 예약자(Reservations 시트 status=RESERVED) 전원에게
 * 다운로드 링크(JWT, send-download 와 같은 토큰) + 라이선스 키 이메일을 일괄 발송하고
 * Reservations 에 notifiedAt · status=NOTIFIED 를 기록한다.
 *
 * ★ 실행은 PO 지시가 있을 때만. 실행 전 Vercel 의 PRODUCT_MODE 를 sale 로 바꾸고 APK_DOWNLOAD_URL 이 살아 있는지 확인한다.
 *
 * 사용법 (저장소 루트에서):
 *   npx vercel env pull .env.local          # 시트·이메일·JWT 환경변수를 임시로 받는다 (검증 후 .env.local 삭제)
 *   node scripts/notify-reservations.js --dry-run   # 발송 없이 대상 목록만 출력
 *   node scripts/notify-reservations.js             # 실제 발송 + 시트 갱신
 *   node scripts/notify-reservations.js --only=a@b.com   # 특정 이메일 1명만(테스트용)
 *   node scripts/notify-reservations.js --limit=10       # 앞에서 N명만
 *
 * 동작:
 *   예약자마다 Orders 시트에 행을 하나 만든다 (orderId = 예약번호 RS-..., status RESERVATION, paymentMethod reserve, amount 0,
 *   licenseKey · downloadToken · product). /api/download/[token] 과 링크 재발급(/api/renew-download-link: 주문번호 자리에 예약번호)이
 *   그 행을 보고 동작하므로, 예약자도 구매자와 같은 다운로드·재발급 경로를 쓴다.
 *   이메일은 mailer.sendPurchaseEmail({ launch: true }) — 제목 "[One MACS · 원맥스] 출시되었습니다 — 다운로드 링크와 라이선스 키".
 *   이미 NOTIFIED 인 행은 건너뛴다(재실행 안전). 한 명 실패해도 다음 사람으로 계속 가고 끝에 실패 목록을 출력한다.
 *
 * 환경변수: GOOGLE_SERVICE_ACCOUNT, SPREADSHEET_ID, GMAIL_USER, GMAIL_APP_PASSWORD, JWT_SECRET, BASE_URL,
 *           APK_DOWNLOAD_URL(또는 APK_FILE_ID), DOWNLOAD_TOKEN_EXPIRY_HOURS(기본 24), MAX_DOWNLOAD_COUNT(기본 5)
 */

const fs = require('fs');
const path = require('path');

// .env / .env.local 간단 로더 (dotenv 의존성 없이 · 값의 BOM·따옴표 제거)
['.env', '.env.local'].forEach(function (f) {
    const envPath = path.join(__dirname, '..', f);
    if (!fs.existsSync(envPath)) return;
    fs.readFileSync(envPath, 'utf8').replace(/^﻿/, '').split(/\r?\n/).forEach(function (line) {
        const mm = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
        if (mm && !process.env[mm[1]]) process.env[mm[1]] = mm[2].replace(/^["']|["']$/g, '');
    });
});

const args = process.argv.slice(2);
const DRY = args.indexOf('--dry-run') !== -1;
const only = (args.find(a => a.indexOf('--only=') === 0) || '').slice(7).trim().toLowerCase();
const limit = parseInt((args.find(a => a.indexOf('--limit=') === 0) || '').slice(8), 10) || 0;

const { getReservations, updateReservation, saveOrder, getOrder, saveEmailLog } = require('../api/lib/sheets.js');
const { generateDownloadToken, expiryHours } = require('../api/lib/jwt.js');
const { sendPurchaseEmail } = require('../api/lib/mailer.js');
const m = require('../api/lib/market.js');

(async function main() {
    const need = ['GOOGLE_SERVICE_ACCOUNT', 'SPREADSHEET_ID'].concat(DRY ? [] : ['GMAIL_USER', 'GMAIL_APP_PASSWORD', 'JWT_SECRET']);
    const missing = need.filter(k => !process.env[k]);
    if (missing.length) { console.error('환경변수 없음: ' + missing.join(', ')); process.exit(1); }
    if (!DRY && !m.apkDownloadUrl()) { console.error('APK_DOWNLOAD_URL(또는 APK_FILE_ID) 이 없습니다 — 링크를 보내도 다운로드가 안 됩니다.'); process.exit(1); }

    const base = m.clean(process.env.BASE_URL) || 'https://www.waat.community';
    const all = await getReservations();
    let targets = all.filter(r => r.status === 'RESERVED');
    if (only) targets = targets.filter(r => r.email.trim().toLowerCase() === only);
    if (limit > 0) targets = targets.slice(0, limit);

    console.log(`예약 전체 ${all.length}명 · RESERVED ${all.filter(r => r.status === 'RESERVED').length}명 · NOTIFIED ${all.filter(r => r.status === 'NOTIFIED').length}명 · 이번 대상 ${targets.length}명` + (DRY ? '  [dry-run: 발송 안 함]' : ''));
    targets.forEach((r, i) => console.log(`  ${i + 1}. ${r.reserveId}  ${r.email}  ${r.name || '-'}  (${r.createdAt})`));
    if (DRY || !targets.length) return;

    const failed = [];
    for (let i = 0; i < targets.length; i++) {
        const r = targets[i];
        const email = r.email.trim();
        try {
            // Orders 행: 이미 있으면(재실행 중 중단된 경우) 그 라이선스 키를 다시 쓴다
            let order = await getOrder(r.reserveId);
            const licenseKey = (order && order.licenseKey) || m.generateLicenseKey();
            const downloadToken = generateDownloadToken({ orderId: r.reserveId, customerEmail: email });
            if (!order) {
                await saveOrder({
                    orderId: r.reserveId, paymentKey: '', amount: 0,
                    customerEmail: email, customerName: r.name, customerPhone: r.phone,
                    status: 'RESERVATION', paidAt: '', downloadToken,
                    paymentMethod: 'reserve', licenseKey, product: m.PRODUCT.label
                });
            }
            await sendPurchaseEmail({
                launch: true,
                name: r.name, email, orderId: r.reserveId, amount: 0, paymentMethod: 'reserve', licenseKey,
                downloadLink: `${base}/api/download/${downloadToken}`,
                consoleGuideLink: `${base}/console`,
                renewLink: `${base}/market/onemacs#renew`,
                expiryHours: expiryHours(),
                maxDownloads: parseInt(process.env.MAX_DOWNLOAD_COUNT, 10) || 5
            });
            await updateReservation(r, { status: 'NOTIFIED', notifiedAt: new Date().toISOString() });
            await saveEmailLog({ paymentMethod: 'launch', email, name: r.name, success: true });
            console.log(`  발송 완료 ${i + 1}/${targets.length}: ${r.reserveId} ${email}`);
        } catch (e) {
            failed.push({ reserveId: r.reserveId, email, error: e && e.message });
            console.error(`  실패 ${i + 1}/${targets.length}: ${r.reserveId} ${email} — ${e && e.message}`);
            try { await saveEmailLog({ paymentMethod: 'launch', email, name: r.name, success: false, errorMessage: e && e.message }); } catch (e2) { /* ignore */ }
        }
    }
    console.log(`\n완료: 성공 ${targets.length - failed.length}명 · 실패 ${failed.length}명`);
    if (failed.length) { console.log('실패 목록(다시 실행하면 RESERVED 만 재시도):'); failed.forEach(f => console.log(`  ${f.reserveId} ${f.email} — ${f.error}`)); process.exit(2); }
})().catch(e => { console.error('오류: ' + (e && e.message)); process.exit(1); });
