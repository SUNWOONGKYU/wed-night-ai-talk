/**
 * Gmail SMTP 발송 — 구매 완료(다운로드 링크 + 라이선스 키) 메일 · 출시 알림 예약 완료 메일 · 리뷰/댓글 확인 메일 · 신고 알림
 * 출처: 기존 판매 시스템 confirm-payment.js / send-download.js 의 메일 부분을 One MACS · 원맥스 문안으로 교체
 *
 * 환경변수: GMAIL_USER, GMAIL_APP_PASSWORD (Google 계정 > 보안 > 앱 비밀번호 16자리)
 */

const nodemailer = require('nodemailer');
const { PRODUCT, paymentMethodLabel, supportEmail } = require('./market.js');

function transporter() {
    if (!process.env.GMAIL_USER || !process.env.GMAIL_APP_PASSWORD) {
        throw new Error('GMAIL_USER / GMAIL_APP_PASSWORD 환경변수가 설정되지 않았습니다.');
    }
    return nodemailer.createTransport({
        service: 'gmail',
        auth: { user: process.env.GMAIL_USER, pass: process.env.GMAIL_APP_PASSWORD }
    });
}

const esc = (s) => String(s == null ? '' : s)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

/** 이름: 깨진 글자(인코딩 오류)·빈 값이면 '고객' — 폰 캡처에서 mojibake 로 뜬 사례(2026-09-21) */
function safeName(v) {
    const rawName = String(v || '').replace(/[\uFFFD\u0000-\u001f]/g, '').trim();
    return esc(/^[\w\s가-힣A-Za-z.\-·()]{1,40}$/.test(rawName) ? rawName : '고객');
}

/**
 * 구매 완료 메일 HTML
 * @param {{name, email, orderId, amount, paymentMethod, licenseKey, downloadLink, consoleGuideLink, expiryHours, maxDownloads, renewal, launch}} p
 *   launch: true 면 출시 알림 예약자에게 보내는 출시 첫날 메일 (scripts/notify-reservations.js) — 제목·내역 블록이 바뀐다
 */
function purchaseEmailHtml(p) {
    const name = safeName(p.name);
    const heading = p.launch ? '예약하신 원맥스가 출시되었습니다'
        : p.renewal ? '원맥스 다운로드 링크를 다시 보내드립니다'
        : '원맥스를 구매해 주셔서 감사합니다';
    const history = p.launch
        ? `<b style="color:#1A2238;">예약 내역</b><br>
    예약번호: ${esc(p.orderId)}<br>
    이메일: ${esc(p.email)}`
        : `<b style="color:#1A2238;">구매 내역</b><br>
    주문번호: ${esc(p.orderId)}<br>
    결제 방법: ${esc(paymentMethodLabel(p.paymentMethod))} (자기 신고)<br>
    금액: ₩${Number(p.amount || 0).toLocaleString('ko-KR')} (VAT 포함)<br>
    이메일: ${esc(p.email)}`;
    return `
<div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI','Malgun Gothic','Apple SD Gothic Neo',sans-serif;max-width:600px;margin:0 auto;padding:36px 20px;color:#1a2238;">
  <div style="text-align:center;margin-bottom:28px;">
    <img src="https://www.waat.community/market/img/onemacs_icon.png" alt="One MACS · 원맥스" width="64" height="64" style="display:inline-block;width:64px;height:64px;border-radius:16px;">
    <h1 style="font-size:22px;margin:16px 0 6px;">${name}님, ${heading}</h1>
    <p style="color:#1a2238;font-size:16px;font-weight:800;margin:0;">${esc(PRODUCT.name)} <span style="font-weight:600;color:#8A8F9E;">${esc(PRODUCT.version)}</span></p>
    <p style="color:#4A5670;font-size:13px;margin:4px 0 0;">One-stop Multi AI Console System · 원스톱 멀티 AI 콘솔 시스템</p>
  </div>

  <div style="background:#1A2238;color:#fff;padding:26px;border-radius:16px;margin-bottom:22px;text-align:center;">
    <div style="font-size:14px;opacity:.85;margin-bottom:10px;">먼저 PC에서 <a href="https://www.waat.community/market/onemacs/install" style="color:#C9A961;font-weight:700;">waat.community/market/onemacs/install</a> 을 여세요 — 핸드폰 앱을 사용하려면 PC에 원맥스를 먼저 설치해야 합니다.</div>
    <div style="font-size:14px;opacity:.85;margin-bottom:12px;">보안 다운로드 링크</div>
    <a href="${esc(p.downloadLink)}" style="display:inline-block;background:#C9A961;color:#1A2238;padding:14px 34px;text-decoration:none;border-radius:10px;font-weight:800;font-size:17px;">One MACS · 원맥스 APK 다운로드</a>
    <div style="margin-top:14px;font-size:13px;opacity:.85;">링크 유효 ${p.expiryHours}시간 · 최대 ${p.maxDownloads}회</div>
  </div>

  <div style="background:#F6F4EF;padding:18px 20px;border-radius:12px;margin-bottom:18px;">
    <div style="font-size:13px;color:#8A8F9E;">라이선스 키</div>
    <div style="font-family:Consolas,'JetBrains Mono',monospace;font-size:22px;font-weight:800;letter-spacing:2px;color:#1A2238;margin-top:4px;">${esc(p.licenseKey)}</div>
    <div style="font-size:13px;color:#4A5670;margin-top:6px;">앱의 설정 &gt; 라이선스에 입력해 두세요. 이 메일과 함께 보관하세요.</div>
  </div>

  <div style="background:#fff;border:1px solid #EAEAEC;padding:18px 20px;border-radius:12px;margin-bottom:18px;">
    <h3 style="font-size:15px;margin:0 0 10px;">설치 순서</h3>
    <ol style="margin:0;padding-left:20px;color:#4A5670;font-size:14px;line-height:1.8;">
      <li>안드로이드 폰에서 위 버튼으로 APK를 내려받아 설치합니다. ("출처를 알 수 없는 앱" 경고가 뜨면 <b>이 출처 허용</b>)</li>
      <li>앱을 열면 첫 화면에 "PC에 설치하는 방법"이 나옵니다. 그대로 따라 PC에 원맥스를 설치하면 <b>코드 8자리</b>가 나옵니다. (PC 브라우저에서 <a href="${esc(p.consoleGuideLink)}" style="color:#2E3A5F;">waat.community/market/onemacs/install</a> 을 열어도 같은 안내를 볼 수 있습니다)</li>
      <li>그 코드를 앱에 넣으면 핸드폰과 PC가 연결됩니다.</li>
    </ol>
  </div>

  <div style="background:#FFF8E6;border:1px solid #F1E2B3;padding:16px 20px;border-radius:12px;margin-bottom:18px;font-size:13px;color:#7A5A12;line-height:1.7;">
    · 다운로드 링크는 ${p.expiryHours}시간 동안, 최대 ${p.maxDownloads}회 유효합니다. 만료되면 ${esc(p.renewLink)} 에서 주문번호와 이메일로 재발급받을 수 있습니다.<br>
    · 링크와 라이선스 키, 페어링 코드는 타인과 공유하지 마세요.
  </div>

  <div style="background:#F6F4EF;padding:16px 20px;border-radius:12px;margin-bottom:18px;font-size:14px;color:#4A5670;line-height:1.8;">
    ${history}
  </div>

  <div style="font-size:12px;color:#8A8F9E;line-height:1.7;border-top:1px solid #EAEAEC;padding-top:14px;">
    문의: ${esc(supportEmail())} · 이 메일은 ${p.launch ? '출시 알림 예약에 따른 다운로드 링크 제공' : '구매 확인 및 다운로드 링크 제공'}을 위한 자동 발송 메일입니다.
  </div>
</div>`;
}

/** 구매 완료(또는 재발급) 메일 발송 */
async function sendPurchaseEmail(p) {
    const t = transporter();
    await t.sendMail({
        from: `"One MACS · 원맥스 (WAAT)" <${process.env.GMAIL_USER}>`,
        to: p.email,
        subject: p.launch
            ? `[One MACS · 원맥스] 출시되었습니다 — 다운로드 링크와 라이선스 키 (예약 ${p.orderId})`
            : p.renewal
            ? `[One MACS · 원맥스] 다운로드 링크 재발급 — 주문 ${p.orderId}`
            : `[One MACS · 원맥스] 구매 완료 — 다운로드 링크와 라이선스 키 (주문 ${p.orderId})`,
        html: purchaseEmailHtml(p)
    });
}

/**
 * 출시 알림 예약 완료 메일 HTML (api/reserve.js)
 * @param {{name, email, reserveId, consoleGuideLink}} p
 */
function reservationEmailHtml(p) {
    const name = safeName(p.name);
    return `
<div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI','Malgun Gothic','Apple SD Gothic Neo',sans-serif;max-width:600px;margin:0 auto;padding:36px 20px;color:#1a2238;">
  <div style="text-align:center;margin-bottom:28px;">
    <img src="https://www.waat.community/market/img/onemacs_icon.png" alt="One MACS · 원맥스" width="64" height="64" style="display:inline-block;width:64px;height:64px;border-radius:16px;">
    <h1 style="font-size:22px;margin:16px 0 6px;">${name}님, 출시 알림 예약이 완료되었습니다</h1>
    <p style="color:#1a2238;font-size:16px;font-weight:800;margin:0;">One MACS · 원맥스</p>
    <p style="color:#4A5670;font-size:13px;margin:4px 0 0;">One-stop Multi AI Console System · 원스톱 멀티 AI 콘솔 시스템</p>
  </div>

  <div style="background:#F6F4EF;padding:18px 20px;border-radius:12px;margin-bottom:18px;text-align:center;">
    <div style="font-size:13px;color:#8A8F9E;">예약번호</div>
    <div style="font-family:Consolas,'JetBrains Mono',monospace;font-size:22px;font-weight:800;letter-spacing:2px;color:#1A2238;margin-top:4px;">${esc(p.reserveId)}</div>
  </div>

  <div style="background:#1A2238;color:#fff;padding:22px 24px;border-radius:16px;margin-bottom:22px;font-size:15px;line-height:1.8;">
    원맥스는 정식 출시 전입니다.<br>
    출시 첫날, 이 주소(<b style="color:#C9A961;">${esc(p.email)}</b>)로 <b>다운로드 링크와 라이선스 키</b>를 보내드립니다.
  </div>

  <div style="background:#fff;border:1px solid #EAEAEC;padding:18px 20px;border-radius:12px;margin-bottom:18px;">
    <h3 style="font-size:15px;margin:0 0 8px;">그동안 미리 보실 수 있는 안내</h3>
    <p style="margin:0;color:#4A5670;font-size:14px;line-height:1.8;">핸드폰 앱을 사용하려면 PC에 원맥스를 먼저 설치해야 합니다. 설치 안내는 지금 보실 수 있습니다.</p>
    <a href="${esc(p.consoleGuideLink || 'https://www.waat.community/market/onemacs/install')}" style="display:inline-block;margin-top:12px;background:#C9A961;color:#1A2238;padding:12px 26px;text-decoration:none;border-radius:10px;font-weight:800;font-size:15px;">PC에 원맥스 설치하기 안내 보기</a>
  </div>

  <div style="font-size:12px;color:#8A8F9E;line-height:1.7;border-top:1px solid #EAEAEC;padding-top:14px;">
    문의: wksun999@hanmail.net · 이 메일은 출시 알림 예약 확인을 위한 자동 발송 메일입니다.
  </div>
</div>`;
}

/** 출시 알림 예약 완료 메일 발송 */
async function sendReservationEmail(p) {
    const t = transporter();
    await t.sendMail({
        from: `"One MACS · 원맥스 (WAAT)" <${process.env.GMAIL_USER}>`,
        to: p.email,
        subject: '[One MACS · 원맥스] 출시 알림 예약 완료',
        html: reservationEmailHtml(p)
    });
}

/**
 * 리뷰·댓글 확인 메일 (api/reviews.js · api/review-comments.js)
 * @param {{email, nick, appName, kind:'review'|'review_edit'|'review_delete'|'comment'|'review_manage', link, preview}} p
 */
const VERIFY_COPY = {
    review:        { subject: '리뷰 확인 — 누르면 게시됩니다',        title: '리뷰를 게시하려면 아래 버튼을 눌러 주세요',      btn: '리뷰 게시하기' },
    review_edit:   { subject: '리뷰 수정 확인 — 누르면 바뀝니다',      title: '고친 리뷰로 바꾸려면 아래 버튼을 눌러 주세요',   btn: '고친 리뷰로 바꾸기' },
    review_delete: { subject: '리뷰 삭제 확인 — 누르면 지워집니다',    title: '리뷰를 지우려면 아래 버튼을 눌러 주세요',        btn: '리뷰 지우기' },
    comment:       { subject: '댓글 확인 — 누르면 게시됩니다',        title: '댓글을 게시하려면 아래 버튼을 눌러 주세요',      btn: '댓글 게시하기' },
    review_manage: { subject: '내 리뷰 고치기·지우기',               title: '내 리뷰를 고치거나 지우려면 아래 버튼을 눌러 주세요', btn: '내 리뷰 열기' }
};
function reviewVerifyHtml(p) {
    const c = VERIFY_COPY[p.kind] || VERIFY_COPY.review;
    const name = safeName(p.nick);
    return `
<div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI','Malgun Gothic','Apple SD Gothic Neo',sans-serif;max-width:600px;margin:0 auto;padding:36px 20px;color:#1a2238;">
  <div style="text-align:center;margin-bottom:24px;">
    <p style="color:#8A8F9E;font-size:13px;margin:0 0 6px;">WAAT 앱마켓 · ${esc(p.appName)}</p>
    <h1 style="font-size:20px;margin:0;">${name}님, ${esc(c.title)}</h1>
  </div>
  <div style="text-align:center;margin:22px 0;">
    <a href="${esc(p.link)}" style="display:inline-block;background:#2563eb;color:#fff;padding:14px 34px;text-decoration:none;border-radius:10px;font-weight:800;font-size:17px;">${esc(c.btn)}</a>
    <div style="margin-top:12px;font-size:13px;color:#8A8F9E;">이 링크는 24시간 동안 한 번만 쓸 수 있습니다.</div>
  </div>
  ${p.preview ? `<div style="background:#F6F4EF;padding:16px 18px;border-radius:12px;font-size:14px;color:#4A5670;line-height:1.7;white-space:pre-wrap;">${esc(p.preview)}</div>` : ''}
  <div style="font-size:12px;color:#8A8F9E;line-height:1.7;border-top:1px solid #EAEAEC;padding-top:14px;margin-top:22px;">
    본인이 쓴 것이 아니라면 이 메일을 무시하세요 — 아무것도 게시되지 않습니다. 이메일 주소는 확인 용도로만 쓰고 저장하지 않습니다. 문의: ${esc(supportEmail())}
  </div>
</div>`;
}
async function sendReviewVerifyEmail(p) {
    const c = VERIFY_COPY[p.kind] || VERIFY_COPY.review;
    const t = transporter();
    await t.sendMail({
        from: `"WAAT 앱마켓" <${process.env.GMAIL_USER}>`,
        to: p.email,
        subject: `[WAAT 앱마켓] ${c.subject} — ${p.appName}`,
        html: reviewVerifyHtml(p)
    });
}

/** 신고 3건 자동 숨김 → 판매자 알림 (api/review-report.js) */
async function sendReportAlertEmail(p) {
    const t = transporter();
    await t.sendMail({
        from: `"WAAT 앱마켓" <${process.env.GMAIL_USER}>`,
        to: p.to,
        subject: `[WAAT 앱마켓] ${p.kind === 'comment' ? '댓글' : '리뷰'}이 신고 3건으로 자동 숨김 처리되었습니다 — ${p.appName}`,
        html: `
<div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI','Malgun Gothic',sans-serif;max-width:600px;margin:0 auto;padding:30px 20px;color:#1a2238;font-size:14px;line-height:1.7;">
  <p><b>${esc(p.appName)}</b>의 ${p.kind === 'comment' ? '댓글' : '리뷰'}이 신고 3건이 쌓여 자동으로 숨겨졌습니다.</p>
  <p style="color:#4A5670;">작성자: ${esc(p.nick)}<br>신고 사유: ${esc(p.reasons)}</p>
  <div style="background:#F6F4EF;padding:14px 16px;border-radius:10px;white-space:pre-wrap;">${esc(p.body)}</div>
  <p style="margin-top:16px;">문제가 없다면 관리 모드에서 복구할 수 있습니다: <a href="${esc(p.adminLink)}">${esc(p.adminLink)}</a></p>
</div>`
    });
}

module.exports = { sendPurchaseEmail, purchaseEmailHtml, sendReservationEmail, reservationEmailHtml, sendReviewVerifyEmail, reviewVerifyHtml, sendReportAlertEmail };
