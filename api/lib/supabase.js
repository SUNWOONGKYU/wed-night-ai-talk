/**
 * Supabase REST 헬퍼 — 서비스 키 전용 (브라우저에 절대 노출하지 않는다)
 * 리뷰·댓글(market_*) 테이블은 RLS 를 켜고 정책이 없어 서비스 키로만 읽고 쓴다(허브 Worker 의 hub_devices 와 같은 방식).
 *
 * 환경변수: SUPABASE_URL, SUPABASE_SERVICE_KEY
 */

const clean = (v) => (v == null ? '' : String(v).replace(/^﻿/, '').trim());

function base() {
    const u = clean(process.env.SUPABASE_URL);
    if (!u) throw new Error('SUPABASE_URL 환경변수가 설정되지 않았습니다.');
    return u.replace(/\/$/, '');
}
function key() {
    const k = clean(process.env.SUPABASE_SERVICE_KEY);
    if (!k) throw new Error('SUPABASE_SERVICE_KEY 환경변수가 설정되지 않았습니다.');
    return k;
}

async function req(method, path, body, extraHeaders) {
    const headers = Object.assign({
        apikey: key(), Authorization: 'Bearer ' + key(),
        'Content-Type': 'application/json', Accept: 'application/json'
    }, extraHeaders || {});
    const r = await fetch(base() + '/rest/v1/' + path, { method, headers, body: body == null ? undefined : JSON.stringify(body) });
    const text = await r.text();
    let data = null;
    try { data = text ? JSON.parse(text) : null; } catch (e) { data = text; }
    if (!r.ok) {
        const msg = (data && (data.message || data.error)) || text || ('HTTP ' + r.status);
        const err = new Error('supabase ' + method + ' ' + path.split('?')[0] + ': ' + String(msg).slice(0, 200));
        err.status = r.status; err.data = data;
        throw err;
    }
    return { data, count: parseCount(r.headers.get('content-range')) };
}
function parseCount(cr) { const m = /\/(\d+|\*)$/.exec(cr || ''); return m && m[1] !== '*' ? parseInt(m[1], 10) : null; }

/** GET table?query  (query 는 PostgREST 문법 문자열, 예: "app_code=eq.onemacs&status=eq.published&order=published_at.desc&limit=20") */
async function select(table, query, opts) {
    const h = {};
    if (opts && opts.count) h.Prefer = 'count=exact';
    if (opts && opts.single) h.Accept = 'application/vnd.pgrst.object+json';
    return req('GET', table + (query ? '?' + query : ''), null, h);
}
/** INSERT → 만든 행 반환 */
async function insert(table, row) {
    const r = await req('POST', table, row, { Prefer: 'return=representation' });
    return Array.isArray(r.data) ? r.data[0] : r.data;
}
/** UPDATE rows matching query → 갱신된 행들 */
async function update(table, query, patch) {
    const r = await req('PATCH', table + '?' + query, patch, { Prefer: 'return=representation' });
    return r.data;
}
async function del(table, query) {
    return req('DELETE', table + '?' + query, null, { Prefer: 'return=minimal' });
}

module.exports = { select, insert, update, del, clean };
