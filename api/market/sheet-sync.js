/**
 * POST /api/market/sheet-sync — 앱 마켓 주문을 Google Sheets 'Orders' 시트에 미러링
 *
 * 정본은 Supabase app_orders 다. 이 함수는 PO 가 "누가 결제했는지 시트에서 보기" 위한 복제본만 쓴다.
 * 호출 경로 (둘 다 같은 함수):
 *   1) 클라이언트 — market.js 가 주문 생성 직후, admin.js 가 상태 변경 직후 { order_no, contact } 로 호출
 *   2) Supabase Database Webhook — app_orders INSERT/UPDATE 시 { type, record: {...} } 로 호출
 *
 * 보안: 받은 본문을 믿지 않는다. order_no + contact 로 공개 RPC get_app_order() 를 다시 호출해
 *       실제 주문이 있을 때만 시트에 쓴다 (없는 주문·조작된 값은 기록 불가). 비밀 헤더 불필요.
 * 실패해도 주문 흐름과 무관 — 호출자는 결과를 무시하고 로그만 남긴다.
 *
 * 환경변수: GOOGLE_SERVICE_ACCOUNT, SPREADSHEET_ID (기존 판매 시스템과 같은 키 이름)
 *           SUPABASE_URL, SUPABASE_ANON_KEY (없으면 사이트 공개값 사용)
 *
 * Orders 시트 열 (기존 판매 시스템 A~M 순서 유지 + N paymentMethod, O licenseKey):
 *   orderId | paymentKey | amount | customerEmail | customerName | customerPhone | status | createdAt |
 *   paidAt | refundedAt | downloadToken | alimtalkSent | alimtalkMessageId | paymentMethod | licenseKey
 */

const { getOrder, saveOrder, updateOrder } = require('../lib/sheets.js');

const SUPABASE_URL = process.env.SUPABASE_URL || 'https://vmiyqfkcoqdnkxjnxijt.supabase.co';
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY ||
    'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZtaXlxZmtjb3Fkbmt4am54aWp0Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzAwMjgwNjYsImV4cCI6MjA4NTYwNDA2Nn0.f7CCtWxojyvvbmlG-zwujDIylqjqhBpE11uI1J8Vrj4';

const STATUS_MAP = { pending: 'PENDING', paid: 'PAID', cancelled: 'CANCELLED' };

async function fetchOrder(orderNo, contact) {
    const r = await fetch(`${SUPABASE_URL}/rest/v1/rpc/get_app_order`, {
        method: 'POST',
        headers: { apikey: SUPABASE_ANON_KEY, Authorization: `Bearer ${SUPABASE_ANON_KEY}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ p_order_no: orderNo, p_contact: contact })
    });
    if (!r.ok) throw new Error(`get_app_order ${r.status}`);
    return await r.json();   // null 이면 없음
}

function isEmail(s) { return /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(String(s || '')); }

/** Supabase 주문 → 시트 행 필드 */
function toSheetFields(o) {
    const contact = String(o.contact || '');
    return {
        orderId: o.order_no,
        paymentKey: '',
        amount: o.amount,
        customerEmail: isEmail(contact) ? contact : '',
        customerName: o.buyer_name || '',
        customerPhone: isEmail(contact) ? '' : contact,
        status: STATUS_MAP[o.status] || String(o.status || '').toUpperCase(),
        createdAt: o.created_at || '',
        paidAt: o.paid_at || '',
        refundedAt: o.status === 'cancelled' ? (o.updated_at || '') : '',
        downloadToken: '',
        alimtalkSent: false,
        alimtalkMessageId: '',
        paymentMethod: o.pay_method === 'kakaopay' ? '카카오페이' : o.pay_method === 'bank' ? '계좌이체' : String(o.pay_method || ''),
        licenseKey: o.license_key || ''
    };
}

module.exports = async function handler(req, res) {
    if (req.method !== 'POST') {
        return res.status(405).json({ ok: false, error: 'method' });
    }
    const body = req.body || {};
    const rec = body.record || body;                       // 웹훅이면 record, 클라이언트면 본문 그대로
    const orderNo = String(rec.order_no || '').trim().toUpperCase();
    const contact = String(rec.contact || '').trim();
    if (!/^CS-\d{8}-[A-Z0-9]{4}$/.test(orderNo) || contact.length < 5) {
        return res.status(400).json({ ok: false, error: 'order_no/contact 필요' });
    }
    if (!process.env.GOOGLE_SERVICE_ACCOUNT || !process.env.SPREADSHEET_ID) {
        return res.status(200).json({ ok: false, skipped: true, error: '시트 미설정 (GOOGLE_SERVICE_ACCOUNT / SPREADSHEET_ID)' });
    }

    try {
        const order = await fetchOrder(orderNo, contact);
        if (!order) return res.status(404).json({ ok: false, error: '주문 없음' });

        const fields = toSheetFields(order);
        const existing = await getOrder(orderNo);
        if (existing) {
            // 라이선스 키는 paid 일 때만 RPC 가 주므로, 이미 적힌 값은 지우지 않는다
            if (!fields.licenseKey && existing.licenseKey) fields.licenseKey = existing.licenseKey;
            await updateOrder(orderNo, fields);
        } else {
            await saveOrder(fields);
        }
        return res.status(200).json({ ok: true, orderId: orderNo, status: fields.status, action: existing ? 'update' : 'append' });
    } catch (e) {
        console.error('sheet-sync 실패:', e && e.message);
        return res.status(500).json({ ok: false, error: e && e.message });
    }
};
