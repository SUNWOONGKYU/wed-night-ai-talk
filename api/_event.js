// 공유 미리보기(api/share, api/og) 공통 — 행사 1건을 익명 키로 조회해 표시용 문자열로 정리한다.
// anon 키는 브라우저(js/supabase-config.js)에 이미 공개된 값과 같다. RLS 상 활성 행사만 읽힌다.
const SUPABASE_URL = 'https://vmiyqfkcoqdnkxjnxijt.supabase.co';
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZtaXlxZmtjb3Fkbmt4am54aWp0Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzAwMjgwNjYsImV4cCI6MjA4NTYwNDA2Nn0.f7CCtWxojyvvbmlG-zwujDIylqjqhBpE11uI1J8Vrj4';

async function sbGet(pathAndQuery) {
    const r = await fetch(SUPABASE_URL + '/rest/v1/' + pathAndQuery, {
        headers: { apikey: SUPABASE_ANON_KEY, Authorization: 'Bearer ' + SUPABASE_ANON_KEY }
    });
    if (!r.ok) throw new Error('supabase ' + r.status);
    return r.json();
}

const DAYS = ['일', '월', '화', '수', '목', '금', '토'];
function fmtDate(iso) {
    const [y, m, d] = String(iso || '').split('-').map(Number);
    if (!y) return '';
    const day = DAYS[new Date(y, m - 1, d).getDay()];
    return y + '년 ' + m + '월 ' + d + '일 (' + day + ')';
}
const hhmm = (t) => (t ? String(t).slice(0, 5) : '');

// 활성 행사/모임 1건. 없으면 null. 반환: { id, event_type, title, when, where, who, updated }
async function loadEvent(id) {
    const n = Number(id);
    if (!Number.isInteger(n) || n <= 0) return null;
    const rows = await sbGet('events?select=id,event_type,title,event_date,location,room,instructor_name,is_active,created_at&id=eq.' + n + '&is_active=eq.true&limit=1');
    const ev = rows && rows[0];
    if (!ev) return null;
    const slots = await sbGet('event_slots?select=slot_time,slot_end_time,slot_label,sort_order&event_id=eq.' + n + '&is_active=eq.true&order=sort_order.asc');
    let timeStr = '';
    if (slots && slots.length) {
        if (ev.event_type === 'event' || slots.length === 1) {
            const s = slots[0];
            timeStr = hhmm(s.slot_time) + (s.slot_end_time ? ' ~ ' + hhmm(s.slot_end_time) : '');
        } else {
            timeStr = slots.map(s => (s.slot_label ? s.slot_label + ' ' : '') + hhmm(s.slot_time)).join(' · ');
        }
    }
    return {
        id: ev.id,
        event_type: ev.event_type === 'event' ? 'event' : 'meeting',
        title: ev.title || '',
        when: [fmtDate(ev.event_date), timeStr].filter(Boolean).join(' '),
        where: [ev.location, ev.room].filter(Boolean).join(' '),
        who: ev.instructor_name ? '강사 ' + ev.instructor_name : ''
    };
}

module.exports = { loadEvent };
