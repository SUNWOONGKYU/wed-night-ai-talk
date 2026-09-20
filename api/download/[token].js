/**
 * GET /api/download/[token]
 * JWT 검증 → 주문 확인(환불 제외) → 다운로드 횟수 확인(최대 5회) → 로그 기록 → APK 로 리다이렉트 페이지
 *
 * 출처: 기존 판매 시스템 api/download/[token].js (Google Drive PDF → APK, 문의처를 이메일로)
 */

const { verifyDownloadToken } = require('../lib/jwt.js');
const { getOrder, getDownloadCount, logDownload } = require('../lib/sheets.js');
const m = require('../lib/market.js');

const esc = (s) => String(s == null ? '' : s)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

function page(title, bodyHtml, extraHead) {
    return `<!DOCTYPE html>
<html lang="ko">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<meta name="robots" content="noindex">
<title>${esc(title)}</title>
${extraHead || ''}
<style>
  body{font-family:-apple-system,BlinkMacSystemFont,'Segoe UI','Malgun Gothic',sans-serif;display:flex;align-items:center;justify-content:center;min-height:100vh;margin:0;background:#0b0f1a;color:#1a2238;padding:16px;box-sizing:border-box}
  .box{background:#fff;padding:36px 28px;border-radius:20px;box-shadow:0 20px 60px rgba(0,0,0,.4);text-align:center;max-width:460px;width:100%}
  h1{font-size:21px;margin:0 0 14px}
  p{color:#4A5670;line-height:1.7;margin:0 0 14px;font-size:15px}
  .btn{display:inline-block;background:#1A2238;color:#fff;padding:13px 30px;text-decoration:none;border-radius:12px;font-weight:700;margin-top:6px}
  .info{background:#F6F4EF;padding:14px;border-radius:10px;margin-top:18px;font-size:13px;color:#4A5670}
  .spin{border:4px solid #eee;border-top:4px solid #C9A961;border-radius:50%;width:36px;height:36px;animation:s 1s linear infinite;margin:14px auto}
  @keyframes s{to{transform:rotate(360deg)}}
  .err h1{color:#b3261e}
</style>
</head>
<body><div class="box">${bodyHtml}</div></body>
</html>`;
}

function errorPage(res, status, title, message, withRenew) {
    const support = m.supportEmail();
    return res.status(status).send(page(title, `
<div class="err">
  <h1>${esc(title)}</h1>
  <p>${esc(message)}</p>
  ${withRenew ? `<a class="btn" href="/market/onemacs#renew">링크 재발급 받기</a>` : ''}
  ${support ? `<p style="font-size:13px;margin-top:16px;">문의: ${esc(support)}</p>` : ''}
</div>`));
}

module.exports = async function handler(req, res) {
    if (req.method !== 'GET') {
        return res.status(405).json({ error: '허용되지 않은 메서드입니다.' });
    }
    const token = req.query && req.query.token;

    try {
        let decoded;
        try {
            decoded = verifyDownloadToken(token);
        } catch (error) {
            return errorPage(res, 401, '다운로드 링크를 쓸 수 없습니다', error.message, true);
        }
        const { orderId } = decoded;

        const order = await getOrder(orderId);
        if (!order) {
            return errorPage(res, 404, '주문을 찾을 수 없습니다', '주문 정보를 확인할 수 없습니다. 주문번호와 함께 문의해 주세요.', false);
        }
        if (order.status === 'REFUNDED' || order.status === 'CANCELLED') {
            return errorPage(res, 403, '다운로드할 수 없는 주문입니다', '이 주문은 환불 또는 취소 처리되어 다운로드할 수 없습니다.', false);
        }

        const maxDownloads = parseInt(process.env.MAX_DOWNLOAD_COUNT, 10) || 5;
        const count = await getDownloadCount(orderId);
        if (count >= maxDownloads) {
            return errorPage(res, 429, '다운로드 횟수 초과', `최대 다운로드 횟수(${maxDownloads}회)를 초과했습니다. 추가 다운로드가 필요하면 재발급을 요청해 주세요.`, true);
        }

        const fileUrl = m.apkDownloadUrl();
        if (!fileUrl) {
            return errorPage(res, 503, '파일이 준비되지 않았습니다', '다운로드 파일이 아직 등록되지 않았습니다. 판매자에게 문의해 주세요.', false);
        }

        await logDownload({
            orderId,
            ipAddress: (req.headers['x-forwarded-for'] || '').split(',')[0].trim() || (req.socket && req.socket.remoteAddress) || '',
            userAgent: req.headers['user-agent'] || ''
        });

        res.setHeader('Cache-Control', 'no-store');
        return res.status(200).send(page('다운로드 시작', `
<h1>다운로드를 시작합니다</h1>
<div class="spin"></div>
<p>잠시 후 원맥스 One MACS APK 다운로드가 자동으로 시작됩니다.<br>시작되지 않으면 아래 버튼을 누르세요.</p>
<a class="btn" href="${esc(fileUrl)}">APK 직접 내려받기</a>
<div class="info">
  주문번호: ${esc(orderId)}<br>
  남은 다운로드 횟수: <b>${maxDownloads - count - 1}</b>회<br>
  라이선스 키는 구매 완료 메일에 있습니다.<br><br>
  <b>다음 순서</b><br>
  1. 내려받은 APK를 눌러 앱을 설치합니다. ("출처를 알 수 없는 앱" 경고가 뜨면 이 출처 허용)<br>
  2. 앱을 열면 첫 화면에 "PC에 설치하는 방법"이 나옵니다. 그대로 따라 PC에 원맥스를 설치하면 코드 8자리가 나옵니다.<br>
  3. 그 코드를 앱에 넣으면 핸드폰과 PC가 연결됩니다.<br>
  (PC 설치 안내는 PC 브라우저에서 <a href="https://www.waat.community/console">waat.community/console</a> 을 열어도 볼 수 있습니다)
</div>`, `<meta http-equiv="refresh" content="2;url=${esc(fileUrl)}">`));
    } catch (error) {
        console.error('download 오류:', error && error.message);
        return errorPage(res, 500, '오류가 발생했습니다', '다운로드 처리 중 오류가 발생했습니다. 잠시 후 다시 시도해 주세요.', false);
    }
};
