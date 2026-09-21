/**
 * Gmail SMTP 발송 — 구매 완료(다운로드 링크 + 라이선스 키) 메일
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

/**
 * 구매 완료 메일 HTML
 * @param {{name, email, orderId, amount, paymentMethod, licenseKey, downloadLink, consoleGuideLink, expiryHours, maxDownloads, renewal}} p
 */
function purchaseEmailHtml(p) {
    // 이름: 깨진 글자(인코딩 오류)·빈 값이면 '고객' — 폰 캡처에서 mojibake 로 뜬 사례(2026-09-21)
    const rawName = String(p.name || '').replace(/[\uFFFD\u0000-\u001f]/g, '').trim();
    const name = esc(/^[\w\s가-힣A-Za-z.\-·()]{1,40}$/.test(rawName) ? rawName : '고객');
    return `
<div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI','Malgun Gothic','Apple SD Gothic Neo',sans-serif;max-width:600px;margin:0 auto;padding:36px 20px;color:#1a2238;">
  <div style="text-align:center;margin-bottom:28px;">
    <img src="https://www.waat.community/market/img/onemacs_icon.png" alt="One MACS · 원맥스" width="64" height="64" style="display:inline-block;width:64px;height:64px;border-radius:16px;">
    <h1 style="font-size:22px;margin:16px 0 6px;">${name}님, ${p.renewal ? '원맥스 다운로드 링크를 다시 보내드립니다' : '원맥스를 구매해 주셔서 감사합니다'}</h1>
    <p style="color:#1a2238;font-size:16px;font-weight:800;margin:0;">${esc(PRODUCT.name)} <span style="font-weight:600;color:#8A8F9E;">${esc(PRODUCT.version)}</span></p>
    <p style="color:#4A5670;font-size:13px;margin:4px 0 0;">One-stop Multi AI Console System · 원스톱 멀티 AI 콘솔 시스템</p>
  </div>

  <div style="background:#1A2238;color:#fff;padding:26px;border-radius:16px;margin-bottom:22px;text-align:center;">
    <div style="font-size:14px;opacity:.85;margin-bottom:10px;">먼저 PC에서 <a href="https://www.waat.community/console" style="color:#C9A961;font-weight:700;">waat.community/console</a> 을 여세요 — 핸드폰 앱을 사용하려면 PC에 원맥스를 먼저 설치해야 합니다.</div>
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
      <li>앱을 열면 첫 화면에 "PC에 설치하는 방법"이 나옵니다. 그대로 따라 PC에 원맥스를 설치하면 <b>코드 8자리</b>가 나옵니다. (PC 브라우저에서 <a href="${esc(p.consoleGuideLink)}" style="color:#2E3A5F;">waat.community/console</a> 을 열어도 같은 안내를 볼 수 있습니다)</li>
      <li>그 코드를 앱에 넣으면 핸드폰과 PC가 연결됩니다.</li>
    </ol>
  </div>

  <div style="background:#FFF8E6;border:1px solid #F1E2B3;padding:16px 20px;border-radius:12px;margin-bottom:18px;font-size:13px;color:#7A5A12;line-height:1.7;">
    · 다운로드 링크는 ${p.expiryHours}시간 동안, 최대 ${p.maxDownloads}회 유효합니다. 만료되면 ${esc(p.renewLink)} 에서 주문번호와 이메일로 재발급받을 수 있습니다.<br>
    · 링크와 라이선스 키, 페어링 코드는 타인과 공유하지 마세요.
  </div>

  <div style="background:#F6F4EF;padding:16px 20px;border-radius:12px;margin-bottom:18px;font-size:14px;color:#4A5670;line-height:1.8;">
    <b style="color:#1A2238;">구매 내역</b><br>
    주문번호: ${esc(p.orderId)}<br>
    결제 방법: ${esc(paymentMethodLabel(p.paymentMethod))} (자기 신고)<br>
    금액: ₩${Number(p.amount || 0).toLocaleString('ko-KR')} (VAT 포함)<br>
    이메일: ${esc(p.email)}
  </div>

  <div style="font-size:12px;color:#8A8F9E;line-height:1.7;border-top:1px solid #EAEAEC;padding-top:14px;">
    문의: ${esc(supportEmail())} · 이 메일은 구매 확인 및 다운로드 링크 제공을 위한 자동 발송 메일입니다.
  </div>
</div>`;
}

/** 구매 완료(또는 재발급) 메일 발송 */
async function sendPurchaseEmail(p) {
    const t = transporter();
    await t.sendMail({
        from: `"One MACS · 원맥스 (WAAT)" <${process.env.GMAIL_USER}>`,
        to: p.email,
        subject: p.renewal
            ? `[One MACS · 원맥스] 다운로드 링크 재발급 — 주문 ${p.orderId}`
            : `[One MACS · 원맥스] 구매 완료 — 다운로드 링크와 라이선스 키 (주문 ${p.orderId})`,
        html: purchaseEmailHtml(p)
    });
}

module.exports = { sendPurchaseEmail, purchaseEmailHtml };
