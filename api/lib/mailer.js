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
 * @param {{name, email, orderId, amount, paymentMethod, licenseKey, downloadLink, downloads, productName, consoleGuideLink, expiryHours, maxDownloads, renewal, launch}} p
 *   downloads: [{label, name, link}] — 한 주문으로 받는 파일이 여럿일 때(One MACS를 사면 보고서
 *              작성 AI 에이전트도 함께 받는다). 없으면 downloadLink 하나로 본다(옛 호출 호환).
 *   launch: true 면 출시 알림 예약자에게 보내는 출시 첫날 메일 (scripts/notify-reservations.js) — 제목·내역 블록이 바뀐다
 */
function purchaseEmailHtml(p) {
    const name = safeName(p.name);
    // 받는 파일 목록. 옛 호출(downloadLink 하나)도 그대로 동작한다.
    const files = (Array.isArray(p.downloads) && p.downloads.length)
        ? p.downloads
        : [{ label: 'One MACS 배포판 (PC 설치본)', name: 'One MACS 배포판', link: p.downloadLink }];
    const heading = p.launch ? '예약하신 One MACS가 출시되었습니다'
        : p.renewal ? 'One MACS 다운로드 링크를 다시 보내드립니다'
        : 'One MACS를 구매해 주셔서 감사합니다';
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
    <p style="color:#4A5670;font-size:13px;margin:4px 0 0;">One-stop Multi AI Console System</p>
  </div>

  <div style="background:#1A2238;color:#fff;padding:26px;border-radius:16px;margin-bottom:22px;text-align:center;">
    <div style="font-size:14px;opacity:.85;margin-bottom:10px;">먼저 PC에서 <a href="https://www.waat.community/market/onemacs/install" style="color:#C9A961;font-weight:700;">waat.community/market/onemacs/install</a> 을 여세요 — 핸드폰 앱을 사용하려면 PC에 One MACS를 먼저 설치해야 합니다.</div>
    <div style="font-size:14px;opacity:.85;margin-bottom:12px;">보안 다운로드 링크${files.length > 1 ? ` — 파일 ${files.length}개` : ''}</div>
    ${files.map((f, i) => `<a href="${esc(f.link)}" style="display:${files.length > 1 ? 'block' : 'inline-block'};background:${i === 0 ? '#C9A961' : '#EFE3C2'};color:#1A2238;padding:14px 34px;text-decoration:none;border-radius:10px;font-weight:800;font-size:${i === 0 ? 17 : 15}px;${files.length > 1 ? 'margin:0 0 10px;' : ''}">${esc(f.label || f.name)} 내려받기</a>`).join('')}
    ${files.length > 1 ? `<div style="margin-top:6px;font-size:13px;opacity:.85;line-height:1.7;">두 개는 <b>따로 도는 프로그램</b>입니다. 각각 자기 폴더에 푸세요.</div>` : ''}
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
      <li>PC에서 위 버튼으로 배포판을 받아 아무 폴더에나 풉니다. (Windows 10/11 · 약 20MB · <b>핸드폰 앱과 설치 지시문이 함께 들어 있습니다</b>)</li>
      <li>푼 폴더에서 Claude Code를 켜고 설치 지시문을 읽히면 설치가 진행되고 <b>코드 8자리</b>가 나옵니다. 자세한 것은 푼 폴더의 <b>"One MACS 사용설명서.html"</b> 한 장에 다 있습니다. (PC 브라우저에서 <a href="${esc(p.consoleGuideLink)}" style="color:#2E3A5F;">waat.community/market/onemacs/install</a> 을 열어도 같은 안내를 볼 수 있습니다)</li>
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
    <p style="color:#4A5670;font-size:13px;margin:4px 0 0;">One-stop Multi AI Console System</p>
  </div>

  <div style="background:#F6F4EF;padding:18px 20px;border-radius:12px;margin-bottom:18px;text-align:center;">
    <div style="font-size:13px;color:#8A8F9E;">예약번호</div>
    <div style="font-family:Consolas,'JetBrains Mono',monospace;font-size:22px;font-weight:800;letter-spacing:2px;color:#1A2238;margin-top:4px;">${esc(p.reserveId)}</div>
  </div>

  <div style="background:#1A2238;color:#fff;padding:22px 24px;border-radius:16px;margin-bottom:22px;font-size:15px;line-height:1.8;">
    One MACS는 정식 출시 전입니다.<br>
    출시 첫날, 이 주소(<b style="color:#C9A961;">${esc(p.email)}</b>)로 <b>다운로드 링크와 라이선스 키</b>를 보내드립니다.
  </div>

  <div style="background:#fff;border:1px solid #EAEAEC;padding:18px 20px;border-radius:12px;margin-bottom:18px;">
    <h3 style="font-size:15px;margin:0 0 8px;">그동안 미리 보실 수 있는 안내</h3>
    <p style="margin:0;color:#4A5670;font-size:14px;line-height:1.8;">핸드폰 앱을 사용하려면 PC에 One MACS를 먼저 설치해야 합니다. 설치 안내는 지금 보실 수 있습니다.</p>
    <a href="${esc(p.consoleGuideLink || 'https://www.waat.community/market/onemacs/install')}" style="display:inline-block;margin-top:12px;background:#C9A961;color:#1A2238;padding:12px 26px;text-decoration:none;border-radius:10px;font-weight:800;font-size:15px;">PC에 One MACS 설치하기 안내 보기</a>
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
    <div style="margin-top:12px;font-size:13px;color:#8A8F9E;">이 링크는 24시간 동안 한 번만 사용할 수 있습니다.</div>
  </div>
  ${p.preview ? `<div style="background:#F6F4EF;padding:16px 18px;border-radius:12px;font-size:14px;color:#4A5670;line-height:1.7;white-space:pre-wrap;">${esc(p.preview)}</div>` : ''}
  <div style="font-size:12px;color:#8A8F9E;line-height:1.7;border-top:1px solid #EAEAEC;padding-top:14px;margin-top:22px;">
    본인이 작성한 것이 아니라면 이 메일을 무시하세요 — 아무것도 게시되지 않습니다. 이메일 주소는 확인 용도로만 사용하고 저장하지 않습니다. 문의: ${esc(supportEmail())}
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


/**
 * 출시 통지 — 결제 안내 메일 (scripts/notify-reservers-payment.js, PO 결정 2026-09-22 B)
 * 다운로드 링크는 넣지 않는다. 결제 후 판매 페이지에서 이메일을 입력하면 기존 흐름(confirm-payment)이 링크를 보낸다.
 * @param {{name, email, reserveId, salesLink, installLink, pay:{price, kakaopayLink, bank:{name,account,holder}, expiryHours, maxDownloads}}} p
 */
function launchPaymentEmailHtml(p) {
    const name = safeName(p.name);
    const price = Number(p.pay.price || 9900).toLocaleString('ko-KR');
    const b = p.pay.bank || {};
    return `
<div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI','Malgun Gothic','Apple SD Gothic Neo',sans-serif;max-width:600px;margin:0 auto;padding:36px 20px;color:#1a2238;">
  <div style="text-align:center;margin-bottom:28px;">
    <img src="https://www.waat.community/market/img/onemacs_icon.png" alt="One MACS · 원맥스" width="64" height="64" style="display:inline-block;width:64px;height:64px;border-radius:16px;">
    <h1 style="font-size:22px;margin:16px 0 6px;">${name}님, 예약하신 One MACS가 출시되었습니다</h1>
    <p style="color:#1a2238;font-size:16px;font-weight:800;margin:0;">One MACS · 원맥스</p>
    <p style="color:#4A5670;font-size:13px;margin:4px 0 0;">One-stop Multi AI Console System</p>
  </div>

  <p style="font-size:15px;line-height:1.8;margin:0 0 18px;">출시 알림을 예약해 주셔서 감사합니다. 예약번호 <b style="font-family:Consolas,monospace;">${esc(p.reserveId)}</b>로 남겨 주신 분께 먼저 알려드립니다.</p>

  <div style="background:#1A2238;color:#fff;padding:22px 24px;border-radius:16px;margin-bottom:22px;font-size:15px;line-height:1.8;">
    가격은 <b style="color:#C9A961;">${price}원</b>입니다. 한 번만 내고, 달마다 내는 요금은 없습니다. (VAT 포함)
  </div>

  <div style="background:#fff;border:1px solid #EAEAEC;padding:18px 20px;border-radius:12px;margin-bottom:14px;">
    <h3 style="font-size:15px;margin:0 0 10px;">결제 방법 (둘 중 하나)</h3>
    <p style="margin:0 0 10px;font-size:14px;line-height:1.8;"><b>1. 카카오페이 송금</b> — 아래 버튼을 누르고 ${price}원을 보내 주세요. 받는 사람: 선웅규<br>
    <a href="${esc(p.pay.kakaopayLink)}" style="display:inline-block;margin-top:6px;background:#FEE500;color:#1A2238;padding:10px 20px;text-decoration:none;border-radius:10px;font-weight:800;font-size:14px;">카카오페이로 ${price}원 보내기</a></p>
    <p style="margin:0;font-size:14px;line-height:1.8;"><b>2. 무통장 입금</b> — ${esc(b.name)} <b style="font-family:Consolas,monospace;">${esc(b.account)}</b> · 예금주 ${esc(b.holder)}<br>
    <span style="color:#4A5670;">입금자명에 본인 이름을 적어 주세요. 다음 단계에서 같은 이름을 입력합니다.</span></p>
  </div>

  <div style="background:#fff;border:1px solid #EAEAEC;padding:18px 20px;border-radius:12px;margin-bottom:14px;">
    <h3 style="font-size:15px;margin:0 0 8px;">결제한 뒤에 할 일</h3>
    <p style="margin:0;color:#1a2238;font-size:14px;line-height:1.8;">판매 페이지에서 <b>"입금 완료 → 이메일 입력"</b>을 누르고 이메일을 넣으면, 그 주소로 앱 다운로드 링크와 라이선스 키를 바로 보내드립니다. 링크는 ${esc(p.pay.expiryHours || 24)}시간 동안 ${esc(p.pay.maxDownloads || 5)}번까지 받을 수 있고, 지나면 같은 페이지에서 다시 받을 수 있습니다.</p>
    <a href="${esc(p.salesLink)}" style="display:inline-block;margin-top:12px;background:#C9A961;color:#1A2238;padding:12px 26px;text-decoration:none;border-radius:10px;font-weight:800;font-size:15px;">판매 페이지 열기</a>
  </div>

  <div style="background:#F6F4EF;padding:16px 20px;border-radius:12px;margin-bottom:18px;font-size:14px;line-height:1.8;color:#1a2238;">
    설치는 PC의 Claude Code가 안내합니다. 앱을 받은 뒤 PC의 Claude Code에 설치 안내 주소를 붙여 넣으면, Claude Code가 필요한 것을 물어보면서 설치를 진행합니다. <a href="${esc(p.installLink)}" style="color:#1A2238;font-weight:700;">설치 안내 미리 보기</a>
  </div>

  <p style="color:#8A8F9E;font-size:12px;line-height:1.7;margin:0;text-align:center;">
    문의: ${esc(supportEmail() || 'wksun999@hanmail.net')} · 이 메일은 출시 알림 예약에 따라 한 번만 보내는 안내 메일입니다.
  </p>
</div>`;
}

async function sendLaunchPaymentEmail(p) {
    const t = transporter();
    await t.sendMail({
        from: `"One MACS · 원맥스 (WAAT)" <${process.env.GMAIL_USER}>`,
        to: p.email,
        subject: 'One MACS · 원맥스 출시 — 예약하신 분께 결제 안내',
        html: launchPaymentEmailHtml(p)
    });
}

module.exports = { sendPurchaseEmail, purchaseEmailHtml, sendReservationEmail, reservationEmailHtml, sendReviewVerifyEmail, reviewVerifyHtml, sendReportAlertEmail, sendLaunchPaymentEmail, launchPaymentEmailHtml };
