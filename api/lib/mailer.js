/**
 * Gmail SMTP 발송 — 구매 완료(다운로드 링크 + 라이선스 키) 이메일 · 출시 알림 예약 완료 이메일 · 리뷰/댓글 확인 이메일 · 신고 알림
 * 출처: 기존 판매 시스템 confirm-payment.js / send-download.js 의 이메일 부분을 One MACS · 원맥스 문안으로 교체
 *
 * 환경변수: GMAIL_USER, GMAIL_APP_PASSWORD (Google 계정 > 보안 > 앱 비밀번호 16자리)
 */

const { PRODUCT, getProduct, paymentMethodLabel, supportEmail } = require('./market.js');
// 「구매 후 설치까지 5단계 안내」 문안 정본 — 카탈로그·내려받기 페이지와 같은 파일을 읽는다
const InstallSteps = require('../../js/install-steps.js');

function transporter() {
    if (!process.env.GMAIL_USER || !process.env.GMAIL_APP_PASSWORD) {
        throw new Error('GMAIL_USER / GMAIL_APP_PASSWORD 환경변수가 설정되지 않았습니다.');
    }
    // 보낼 때만 불러온다 — HTML 만드는 함수는 nodemailer 없이도 돈다(미리보기·시험)
    const nodemailer = require('nodemailer');
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
 * 구매 완료 이메일 HTML
 * @param {{name, email, orderId, amount, paymentMethod, licenseKey, downloadLink, downloads, productName, consoleGuideLink, expiryHours, maxDownloads, renewal, launch}} p
 *   downloads: [{id, label, name, link}] — 한 주문으로 받는 상품이 여럿일 때. 상품마다 「패키지 내려받기」 버튼과
 *              그 상품의 「구매 후 설치까지 5단계 안내」(문안 정본 js/install-steps.js)가 붙는다.
 *              없으면 downloadLink 하나 = One MACS 로 본다(옛 호출 호환: confirm-payment·renew·notify-reservations).
 *   launch: true 면 출시 알림 예약자에게 보내는 출시 첫날 이메일 (scripts/notify-reservations.js) — 제목·내역 블록이 바뀐다
 */
function purchaseEmailHtml(p) {
    const name = safeName(p.name);
    // 받는 파일 목록. 옛 호출(downloadLink 하나)도 그대로 동작한다.
    const files = ((Array.isArray(p.downloads) && p.downloads.length)
        ? p.downloads
        : [{ id: 'onemacs', label: 'One MACS 패키지 (PC 설치본)', name: 'One MACS 패키지', link: p.downloadLink }])
        .map((f) => Object.assign({}, f, { product: getProduct(f.id || 'onemacs') || PRODUCT }));
    const main = files[0].product;
    const isOneMacs = main.id === 'onemacs';
    // One MACS 전용 문구는 One MACS 주문에만 — 다른 상품 이메일에는 One MACS 제목·아이콘·증정 안내를 달지 않는다
    const heading = isOneMacs
        ? (p.launch ? '예약하신 One MACS가 출시되었습니다'
            : p.renewal ? 'One MACS 다운로드 링크를 다시 보내드립니다'
            : 'One MACS를 구매해 주셔서 감사합니다')
        : (p.renewal ? '다운로드 링크를 다시 보내드립니다' : '구매해 주셔서 감사합니다');
    const icon = main.id === 'onemacs' ? { src: 'onemacs_icon.png', alt: 'One MACS · 원맥스' }
        : main.id === 'ReportWritingAgent' ? { src: 'arwa_icon.png', alt: main.name } : null;
    const subtitle = isOneMacs ? 'One-stop Multi AI-CLI Console System' : (main.fullname || '');
    const support = supportEmail() || 'wksun999@hanmail.net';
    // One MACS 연결 코드는 One MACS 연결(고정 주소)이 필요한 상품에만 넣는다 — 주식 매매 자동화 시스템은 필요 없다(HQ 확인 2026-09-25)
    const usesLicense = files.some((f) => f.product.id !== 'StockTradeAutoSystem');
    // 상품마다: 「패키지 내려받기」 버튼 상자 → 바로 아래 그 상품의 5단계
    const perProduct = files.map((f) => `
  <div style="background:#1A2238;color:#fff;padding:26px;border-radius:16px;margin-bottom:14px;text-align:center;">
    ${files.length > 1 ? `<div style="font-size:15px;font-weight:800;margin-bottom:12px;">${esc(f.product.name)}</div>` : ''}
    <a href="${esc(f.link)}" style="display:inline-block;background:#C9A961;color:#1A2238;padding:14px 34px;text-decoration:none;border-radius:10px;font-weight:800;font-size:17px;">패키지 내려받기</a>
    <div style="margin-top:14px;font-size:13px;opacity:.85;">이 버튼으로 ${p.maxDownloads}번까지 내려받으실 수 있습니다.</div>
  </div>
  ${InstallSteps.emailHtml(f.product.id, { supportEmail: support, heading: files.length > 1 ? f.product.name : '' })}`).join('');
    const history = p.launch
        ? `<b style="color:#1A2238;">예약 내역</b><br>
    예약번호: ${esc(p.orderId)}<br>
    이메일: ${esc(p.email)}`
        : `<b style="color:#1A2238;">구매 내역</b><br>
    주문번호: ${esc(p.orderId)}<br>
    결제 방법: ${esc(paymentMethodLabel(p.paymentMethod))}<br>
    금액: ₩${Number(p.amount || 0).toLocaleString('ko-KR')} (VAT 포함)<br>
    이메일: ${esc(p.email)}`;
    return `
<div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI','Malgun Gothic','Apple SD Gothic Neo',sans-serif;max-width:600px;margin:0 auto;padding:36px 20px;color:#1a2238;">
  <div style="text-align:center;margin-bottom:28px;">
    ${icon ? `<img src="https://www.waat.community/market/img/${icon.src}" alt="${esc(icon.alt)}" width="64" height="64" style="display:inline-block;width:64px;height:64px;border-radius:16px;">` : ''}
    <h1 style="font-size:22px;margin:16px 0 6px;">${name}님, ${heading}</h1>
    <p style="color:#1a2238;font-size:16px;font-weight:800;margin:0;">${esc(main.name)} <span style="font-weight:600;color:#8A8F9E;">${esc(main.version)}</span></p>
    ${subtitle ? `<p style="color:#4A5670;font-size:13px;margin:4px 0 0;">${esc(subtitle)}</p>` : ''}
  </div>

  ${files.length > 1 ? `<div style="margin:0 0 14px;font-size:14px;color:#4A5670;line-height:1.7;">받으실 파일이 ${files.length}개입니다. <b>따로 도는 프로그램</b>이니 상품마다 아래 안내대로 따로 설치하십시오.</div>` : ''}
  ${perProduct}

${usesLicense ? `
  <div style="background:#F6F4EF;padding:18px 20px;border-radius:12px;margin-bottom:18px;">
    <div style="font-size:13px;color:#8A8F9E;">One MACS 연결 코드</div>
    <div style="font-family:Consolas,'JetBrains Mono',monospace;font-size:24px;font-weight:800;letter-spacing:3px;color:#1A2238;margin-top:4px;word-break:break-all;">${esc(p.licenseKey)}</div>
    <div style="font-size:13px;color:#4A5670;margin-top:6px;">설치할 때 Claude Code가 물으면 넣으십시오. 본 이메일과 함께 보관하십시오.</div>
  </div>` : ''}
${isOneMacs ? `
  <div style="background:#F6F4EF;border:1px dashed #C9A961;padding:16px 20px;border-radius:12px;margin-bottom:18px;font-size:14px;color:#4A5670;line-height:1.8;">
    <b style="color:#1A2238;">출시 기념 — 두 가지를 더 보내드립니다</b><br>
    <b>보고서 작성 에이전트 (ARWA)</b> · 자료를 주면 근거를 붙여 보고서 초안을 작성합니다.<br>
    <b>주식 매매 자동화 시스템 (STAS)</b> · 신호가 나면 텔레그램으로 물어보고, 승인하신 주문만 대신 넣습니다.<br>
    둘 다 One MACS 와 따로 파는 별도 상품(각 5,500원)이지만, <b>출시일로부터 한 달 동안 One MACS 를 사신 분께는 값을 더 받지 않습니다.</b>
    준비되는 대로 이 주소(${esc(p.email)})로 <b>하나씩 따로 보내드립니다.</b> 다시 결제하실 일도, 따로 신청하실 일도 없습니다.<br>
    <span style="font-size:13px;opacity:.85;">받으시면 <b>각각 독립된 폴더</b>에 푸십시오(프로젝트가 서로 다릅니다). 그 폴더에서 Claude Code 에게 <b>"이 폴더의 CLAUDE_CODE_지시문.md 를 읽고 그대로 수행해줘"</b>, 끝나면 <b>"One MACS 에 연결해줘"</b> 라고 하시면 모바일 앱 안에서 바로 열립니다.</span>
  </div>
` : ''}
  <div style="background:#FFF8E6;border:1px solid #F1E2B3;padding:16px 20px;border-radius:12px;margin-bottom:18px;font-size:13px;color:#7A5A12;line-height:1.7;">
    · 「패키지 내려받기」 버튼으로 ${p.maxDownloads}번까지 내려받으실 수 있습니다. 다 쓰셨으면 주문번호와 이름을 적어 ${esc(support)} 로 연락해 주십시오.<br>
    · 본 이메일의 버튼${usesLicense ? "과 One MACS 연결 코드" : ""}는 다른 사람과 나누지 마십시오.
  </div>

  <div style="background:#F6F4EF;padding:16px 20px;border-radius:12px;margin-bottom:18px;font-size:14px;color:#4A5670;line-height:1.8;">
    ${history}
  </div>

  <div style="font-size:12px;color:#8A8F9E;line-height:1.7;border-top:1px solid #EAEAEC;padding-top:14px;">
    문의: ${esc(support)} · 본 이메일은 ${p.launch ? '출시 알림 예약에 따른 패키지 내려받기 안내' : '구매 확인 및 패키지 내려받기 안내'}를 위한 자동 발송 이메일입니다.
  </div>
</div>`;
}

/** 구매 완료(또는 재발급) 이메일 발송 */
async function sendPurchaseEmail(p) {
    const t = transporter();
    // One MACS 가 아닌 상품 이메일에는 One MACS 이름을 달지 않는다
    const first = (Array.isArray(p.downloads) && p.downloads.length && getProduct(p.downloads[0].id)) || PRODUCT;
    const tag = first.id === 'onemacs' ? 'One MACS · 원맥스' : first.name;
    const fromName = first.id === 'onemacs' ? 'One MACS · 원맥스 (WAAT)' : 'WAAT AI 툴 마켓';
    await t.sendMail({
        from: `"${fromName}" <${process.env.GMAIL_USER}>`,
        to: p.email,
        subject: p.launch
            ? `[${tag}] 출시되었습니다 — 패키지 내려받기 안내 (예약 ${p.orderId})`
            : p.renewal
            ? `[${tag}] 다운로드 링크 재발급 — 주문 ${p.orderId}`
            : `[${tag}] 구매 완료 — 패키지 내려받기 안내 (주문 ${p.orderId})`,
        html: purchaseEmailHtml(p)
    });
}

/**
 * 출시 알림 예약 완료 이메일 HTML (api/reserve.js)
 * @param {{name, email, reserveId, consoleGuideLink}} p
 */
function reservationEmailHtml(p) {
    const name = safeName(p.name);
    // reserve.js 가 productName 을 넘긴다. 없거나 One MACS 이면 옛 One MACS 문안 그대로
    const isOneMacs = !p.productName || p.productName === PRODUCT.name;
    return `
<div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI','Malgun Gothic','Apple SD Gothic Neo',sans-serif;max-width:600px;margin:0 auto;padding:36px 20px;color:#1a2238;">
  <div style="text-align:center;margin-bottom:28px;">
    ${isOneMacs ? `<img src="https://www.waat.community/market/img/onemacs_icon.png" alt="One MACS · 원맥스" width="64" height="64" style="display:inline-block;width:64px;height:64px;border-radius:16px;">` : ''}
    <h1 style="font-size:22px;margin:16px 0 6px;">${name}님, 출시 알림 예약이 완료되었습니다</h1>
    <p style="color:#1a2238;font-size:16px;font-weight:800;margin:0;">${isOneMacs ? 'One MACS · 원맥스' : esc(p.productName)}</p>
    ${isOneMacs ? `<p style="color:#4A5670;font-size:13px;margin:4px 0 0;">One-stop Multi AI-CLI Console System</p>` : ''}
  </div>

  <div style="background:#F6F4EF;padding:18px 20px;border-radius:12px;margin-bottom:18px;text-align:center;">
    <div style="font-size:13px;color:#8A8F9E;">예약번호</div>
    <div style="font-family:Consolas,'JetBrains Mono',monospace;font-size:22px;font-weight:800;letter-spacing:2px;color:#1A2238;margin-top:4px;">${esc(p.reserveId)}</div>
  </div>

  <div style="background:#1A2238;color:#fff;padding:22px 24px;border-radius:16px;margin-bottom:22px;font-size:15px;line-height:1.8;">
    ${isOneMacs ? 'One MACS는 정식 출시 전입니다.' : '정식 출시 전입니다.'}<br>
    출시 첫날, 이 주소(<b style="color:#C9A961;">${esc(p.email)}</b>)로 <b>패키지를 내려받으실 수 있는 이메일</b>을 보내드립니다.
  </div>

  <div style="background:#fff;border:1px solid #EAEAEC;padding:18px 20px;border-radius:12px;margin-bottom:18px;">
    <h3 style="font-size:15px;margin:0 0 8px;">그동안 미리 보실 수 있는 안내</h3>
    <p style="margin:0;color:#4A5670;font-size:14px;line-height:1.8;">${isOneMacs ? '모바일 앱을 사용하려면 PC에 One MACS를 먼저 설치해야 합니다. ' : ''}설치 안내는 지금 보실 수 있습니다.</p>
    <a href="${esc(p.consoleGuideLink || 'https://www.waat.community/market/onemacs/install')}" style="display:inline-block;margin-top:12px;background:#C9A961;color:#1A2238;padding:12px 26px;text-decoration:none;border-radius:10px;font-weight:800;font-size:15px;">설치 안내 보기</a>
  </div>

  <div style="font-size:12px;color:#8A8F9E;line-height:1.7;border-top:1px solid #EAEAEC;padding-top:14px;">
    문의: wksun999@hanmail.net · 이 이메일은 출시 알림 예약 확인을 위한 자동 발송 이메일입니다.
  </div>
</div>`;
}

/** 출시 알림 예약 완료 이메일 발송 */
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
 * 리뷰·댓글 확인 이메일 (api/reviews.js · api/review-comments.js)
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
    <p style="color:#8A8F9E;font-size:13px;margin:0 0 6px;">WAAT AI 툴 마켓 · ${esc(p.appName)}</p>
    <h1 style="font-size:20px;margin:0;">${name}님, ${esc(c.title)}</h1>
  </div>
  <div style="text-align:center;margin:22px 0;">
    <a href="${esc(p.link)}" style="display:inline-block;background:#2563eb;color:#fff;padding:14px 34px;text-decoration:none;border-radius:10px;font-weight:800;font-size:17px;">${esc(c.btn)}</a>
    <div style="margin-top:12px;font-size:13px;color:#8A8F9E;">이 링크는 24시간 동안 한 번만 사용할 수 있습니다.</div>
  </div>
  ${p.preview ? `<div style="background:#F6F4EF;padding:16px 18px;border-radius:12px;font-size:14px;color:#4A5670;line-height:1.7;white-space:pre-wrap;">${esc(p.preview)}</div>` : ''}
  <div style="font-size:12px;color:#8A8F9E;line-height:1.7;border-top:1px solid #EAEAEC;padding-top:14px;margin-top:22px;">
    본인이 작성한 것이 아니라면 이 이메일을 무시하세요 — 아무것도 게시되지 않습니다. 이메일 주소는 확인 용도로만 사용하고 저장하지 않습니다. 문의: ${esc(supportEmail())}
  </div>
</div>`;
}
async function sendReviewVerifyEmail(p) {
    const c = VERIFY_COPY[p.kind] || VERIFY_COPY.review;
    const t = transporter();
    await t.sendMail({
        from: `"WAAT AI 툴 마켓" <${process.env.GMAIL_USER}>`,
        to: p.email,
        subject: `[WAAT AI 툴 마켓] ${c.subject} — ${p.appName}`,
        html: reviewVerifyHtml(p)
    });
}

/** 신고 3건 자동 숨김 → 판매자 알림 (api/review-report.js) */
async function sendReportAlertEmail(p) {
    const t = transporter();
    await t.sendMail({
        from: `"WAAT AI 툴 마켓" <${process.env.GMAIL_USER}>`,
        to: p.to,
        subject: `[WAAT AI 툴 마켓] ${p.kind === 'comment' ? '댓글' : '리뷰'}이 신고 3건으로 자동 숨김 처리되었습니다 — ${p.appName}`,
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
 * 출시 통지 — 결제 안내 이메일 (scripts/notify-reservers-payment.js, PO 결정 2026-09-22 B)
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
    <p style="color:#4A5670;font-size:13px;margin:4px 0 0;">One-stop Multi AI-CLI Console System</p>
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
    <p style="margin:0;color:#1a2238;font-size:14px;line-height:1.8;">판매 페이지에서 <b>"입금 완료 → 이메일 입력"</b>을 누르고 이메일을 넣으면, 그 주소로 구매 확인 이메일을 바로 보내드립니다. 이메일의 「패키지 내려받기」 버튼으로 ${esc(p.pay.maxDownloads || 5)}번까지 내려받으실 수 있습니다.</p>
    <a href="${esc(p.salesLink)}" style="display:inline-block;margin-top:12px;background:#C9A961;color:#1A2238;padding:12px 26px;text-decoration:none;border-radius:10px;font-weight:800;font-size:15px;">판매 페이지 열기</a>
  </div>

  <div style="background:#F6F4EF;padding:16px 20px;border-radius:12px;margin-bottom:18px;font-size:14px;line-height:1.8;color:#1a2238;">
    설치는 PC의 Claude Code가 안내합니다. 툴을 받은 뒤 PC의 Claude Code에 설치 안내 주소를 붙여 넣으면, Claude Code가 필요한 것을 물어보면서 설치를 진행합니다. <a href="${esc(p.installLink)}" style="color:#1A2238;font-weight:700;">설치 안내 미리 보기</a>
  </div>

  <p style="color:#8A8F9E;font-size:12px;line-height:1.7;margin:0;text-align:center;">
    문의: ${esc(supportEmail() || 'wksun999@hanmail.net')} · 이 이메일은 출시 알림 예약에 따라 한 번만 보내는 안내 이메일입니다.
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
