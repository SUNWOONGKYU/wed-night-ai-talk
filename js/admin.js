// ========== Admin Page Logic ==========

let adminUser = null;
let adminProfile = null;

// ========== Init ==========
async function initAdmin() {
    try {
        const session = await Auth.getSession();
        if (!session) {
            showDenied();
            return;
        }

        adminUser = session.user;

        // ADMIN_EMAILS 체크 (supabase-config.js에 정의)
        if (!ADMIN_EMAILS.includes(adminUser.email.toLowerCase())) {
            showDenied();
            return;
        }

        try {
            adminProfile = await DB.getProfile(adminUser.id);
        } catch (e) {
            adminProfile = null;
        }

        // 관리자 확인 완료 — 콘텐츠 표시
        document.getElementById('admin-loading').style.display = 'none';
        document.getElementById('admin-content').style.display = 'block';
        document.getElementById('nav-user-name').textContent =
            (adminProfile && adminProfile.name) || adminUser.email;

        loadMembers();
        loadEvents();
        loadLocations();
        loadInquiries();
    } catch (e) {
        showDenied();
    }
}

function showDenied() {
    document.getElementById('admin-loading').style.display = 'none';
    document.getElementById('admin-denied').style.display = 'block';
}

// ========== Tabs ==========
document.querySelectorAll('.admin-tab').forEach(tab => {
    tab.addEventListener('click', () => {
        document.querySelectorAll('.admin-tab').forEach(t => t.classList.remove('active'));
        tab.classList.add('active');
        document.querySelectorAll('.admin-panel').forEach(p => p.classList.remove('active'));
        document.getElementById('panel-' + tab.dataset.tab).classList.add('active');

        // 이메일 탭 첫 클릭 시 lazy load
        if (tab.dataset.tab === 'email') {
            initEmailPanel();
        }
    });
});

// ========== Nav Dropdown ==========
const navUserBtn = document.getElementById('nav-user-btn');
const navDropdown = document.getElementById('nav-dropdown');

navUserBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    navDropdown.classList.toggle('show');
});

document.addEventListener('click', () => {
    navDropdown.classList.remove('show');
});

document.getElementById('admin-logout-btn').addEventListener('click', async () => {
    await Auth.signOut();
    window.location.href = 'index.html';
});

// ========== Members ==========
let allMembers = [];

async function loadMembers() {
    try {
        allMembers = await DB.getAllProfiles();
        renderMembers(allMembers);
    } catch (e) {
        document.getElementById('members-tbody').innerHTML =
            '<tr><td colspan="7" class="admin-empty">멤버 목록을 불러올 수 없습니다.</td></tr>';
    }
}

function renderMembers(members) {
    const tbody = document.getElementById('members-tbody');
    if (members.length === 0) {
        tbody.innerHTML = '<tr><td colspan="8" class="admin-empty">등록된 멤버가 없습니다.</td></tr>';
        document.getElementById('member-count').textContent = '';
        return;
    }

    tbody.innerHTML = members.map(m => {
        const interests = Array.isArray(m.interests) ? m.interests.join(', ') : (m.interests || '');
        const date = m.created_at ? new Date(m.created_at).toLocaleDateString('ko-KR') : '-';
        return `<tr>
            <td>${escapeHtml(m.name || '-')}</td>
            <td>${escapeHtml(m.phone || '-')}</td>
            <td>${escapeHtml(m.email || '-')}</td>
            <td>${escapeHtml(m.current_job || '-')}</td>
            <td>${escapeHtml(interests || '-')}</td>
            <td>${escapeHtml(m.message || '-')}</td>
            <td>${date}</td>
            <td><button class="btn-secondary btn-small" onclick="deleteMember('${m.id}', '${escapeHtml(m.name || m.email || '')}')" style="color:var(--accent-pink);">삭제</button></td>
        </tr>`;
    }).join('');

    document.getElementById('member-count').textContent = `총 ${members.length}명`;
}

// ========== Member Search ==========
document.getElementById('member-search').addEventListener('input', (e) => {
    const q = e.target.value.toLowerCase().trim();
    if (!q) {
        renderMembers(allMembers);
        return;
    }
    const filtered = allMembers.filter(m =>
        (m.name || '').toLowerCase().includes(q) ||
        (m.phone || '').includes(q)
    );
    renderMembers(filtered);
});

// ========== Events ==========
let allEvents = [];

async function loadEvents() {
    try {
        allEvents = await DB.getAllEvents();
        // 각 이벤트의 슬롯 요약 (시간만 모아서 한 줄)
        await Promise.all(allEvents.map(async function(ev) {
            try {
                var slots = await DB.getEventSlots(ev.id);
                ev._slots = slots;
                ev._slotsSummary = slots
                    .filter(function(s) { return s.is_active !== false; })
                    .map(function(s) {
                        var t = s.slot_time ? String(s.slot_time).slice(0,5) : '';
                        return ((s.slot_emoji || '') + ' ' + t).trim();
                    })
                    .join(' / ');
            } catch (e) { ev._slots = []; ev._slotsSummary = ''; }
        }));
        renderEvents(allEvents);
        await loadLocationSelect();
    } catch (e) {
        document.getElementById('events-tbody').innerHTML =
            '<tr><td colspan="7" class="admin-empty">모임 목록을 불러올 수 없습니다.</td></tr>';
    }
}

let locationOptions = [];

async function loadLocationSelect() {
    try {
        locationOptions = await DB.getAllLocations();
        const sel = document.getElementById('ev-location-select');
        sel.innerHTML = '<option value="">-- 장소를 선택하세요 --</option>' +
            locationOptions.map(loc =>
                `<option value="${loc.id}">${escapeHtml(loc.name)}${loc.is_active ? '' : ' (비활성)'}</option>`
            ).join('');
    } catch (e) {
        console.error('loadLocationSelect error:', e);
    }
}

document.getElementById('ev-location-select').addEventListener('change', function() {
    const loc = locationOptions.find(l => l.id == this.value);
    document.getElementById('ev-location').value = loc ? loc.name : '';
    document.getElementById('ev-address').value = loc ? (loc.address || '') : '';
    document.getElementById('ev-map-url').value = loc ? (loc.map_url || '') : '';
});

function renderEvents(events) {
    const tbody = document.getElementById('events-tbody');
    if (events.length === 0) {
        tbody.innerHTML = '<tr><td colspan="7" class="admin-empty">등록된 모임이 없습니다.</td></tr>';
        return;
    }

    tbody.innerHTML = events.map(ev => {
        const date = ev.event_date || '-';
        const time = (ev._slotsSummary && ev._slotsSummary.length) ? ev._slotsSummary : '-';
        const status = ev.is_active
            ? '<span class="admin-badge active">활성</span>'
            : '<span class="admin-badge inactive">비활성</span>';

        return `<tr>
            <td>${escapeHtml(ev.title)}</td>
            <td>${date}</td>
            <td>${time}</td>
            <td>${escapeHtml(ev.location || '-')}</td>
            <td>${status}</td>
            <td><button class="btn-secondary btn-small" onclick="viewAttendees(${ev.id}, '${escapeHtml(ev.title)}')">보기</button></td>
            <td>
                <button class="btn-secondary btn-small" onclick="editEvent(${ev.id})">수정</button>
                <button class="btn-secondary btn-small" onclick="toggleEventActive(${ev.id}, ${ev.is_active})">${ev.is_active ? '비활성화' : '활성화'}</button>
                <button class="btn-secondary btn-small" onclick="deleteEvent(${ev.id}, '${escapeHtml(ev.title)}')" style="color:var(--accent-pink);">삭제</button>
            </td>
        </tr>`;
    }).join('');
}

// ========== Event Form ==========
const eventForm = document.getElementById('event-form');
const eventFormReset = document.getElementById('event-form-reset');

// ----- Slot Rows UI -----
const DEFAULT_SLOTS = [
    { slot_emoji: '☀️', slot_label: '햇살', slot_time: '15:00', slot_end_time: '17:00' },
    { slot_emoji: '🌅', slot_label: '노을', slot_time: '17:30', slot_end_time: '19:30' },
    { slot_emoji: '🌙', slot_label: '달빛', slot_time: '20:00', slot_end_time: '22:00' }
];

// 제공사항 및 참가비 디폴트
const DEFAULT_PROVISION = '제공사항: 커피/생수 포함 다과\n참가비: 1만원\n입금계좌: 하나은행 620-241128-571 선웅규\n* 음료 지참의 불편함 해소 및 노쇼 방지 목적';

function renderSlotRows(slots) {
    const list = document.getElementById('ev-slots-list');
    if (!list) return;
    list.innerHTML = '';
    (slots || []).forEach(function(s) { addSlotRow(s); });
}

function addSlotRow(s) {
    const list = document.getElementById('ev-slots-list');
    if (!list) return;
    const row = document.createElement('div');
    row.className = 'ev-slot-row';
    const emoji = s ? (s.slot_emoji || '') : '';
    const label = s ? (s.slot_label || '') : '';
    const time = s && s.slot_time ? String(s.slot_time).slice(0, 5) : '';
    const endTime = s && s.slot_end_time ? String(s.slot_end_time).slice(0, 5) : '';
    const id = s && s.id ? s.id : '';
    row.innerHTML =
        '<input type="text" class="slot-emoji" placeholder="🌟" maxlength="4" value="' + escapeHtml(emoji) + '">' +
        '<input type="text" class="slot-label" placeholder="라벨 (예: 햇살)" value="' + escapeHtml(label) + '">' +
        '<input type="time" class="slot-time" value="' + escapeHtml(time) + '" title="시작">' +
        '<span class="ev-slot-tilde">~</span>' +
        '<input type="time" class="slot-end-time" value="' + escapeHtml(endTime) + '" title="종료">' +
        '<button type="button" class="ev-slot-del">삭제</button>' +
        '<input type="hidden" class="slot-id" value="' + escapeHtml(String(id)) + '">';
    row.querySelector('.ev-slot-del').addEventListener('click', function() {
        row.remove();
    });
    list.appendChild(row);
}

function readSlotRows() {
    const rows = document.querySelectorAll('#ev-slots-list .ev-slot-row');
    const out = [];
    rows.forEach(function(row, idx) {
        const label = (row.querySelector('.slot-label').value || '').trim();
        const emoji = (row.querySelector('.slot-emoji').value || '').trim();
        const time = (row.querySelector('.slot-time').value || '').trim();
        const endTime = (row.querySelector('.slot-end-time').value || '').trim();
        const idEl = row.querySelector('.slot-id');
        const rawId = idEl ? (idEl.value || '').trim() : '';
        if (!label) return; // 라벨 비어있으면 스킵
        const entry = {
            slot_label: label,
            slot_emoji: emoji,
            slot_time: time || null,
            slot_end_time: endTime || null,
            sort_order: idx + 1
        };
        if (rawId) entry.id = parseInt(rawId, 10);
        out.push(entry);
    });
    return out;
}

const slotsAddBtn = document.getElementById('ev-slots-add');
if (slotsAddBtn) slotsAddBtn.addEventListener('click', function() { addSlotRow(); });

eventForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const statusEl = document.getElementById('event-form-status');
    const btn = eventForm.querySelector('.form-submit');
    const editId = document.getElementById('edit-event-id').value;

    const eventData = {
        title: document.getElementById('ev-title').value.trim(),
        event_date: document.getElementById('ev-date').value,
        day_label: document.getElementById('ev-day-label').value,
        location: document.getElementById('ev-location').value.trim(),
        address: document.getElementById('ev-address').value.trim(),
        map_url: document.getElementById('ev-map-url').value.trim(),
        description: document.getElementById('ev-desc').value.trim(),
        capacity: parseInt(document.getElementById('ev-capacity').value, 10) || 20,
        provision: document.getElementById('ev-provision').value.trim(),
        youtube_url: document.getElementById('ev-youtube').value.trim() || null
    };

    const slotInputs = readSlotRows();
    if (slotInputs.length === 0) {
        statusEl.textContent = '최소 한 개의 타임 슬롯이 필요합니다.';
        statusEl.className = 'form-status error';
        return;
    }

    statusEl.textContent = '저장 중...';
    statusEl.className = 'form-status loading';
    btn.disabled = true;

    try {
        let evId;
        if (editId) {
            await DB.updateEvent(parseInt(editId), eventData);
            evId = parseInt(editId);
        } else {
            const created = await DB.createEvent(eventData);
            evId = created.id;
        }

        // 슬롯 동기화 (소프트 삭제 + 신규/업데이트)
        await DB.replaceEventSlots(evId, slotInputs);

        statusEl.textContent = editId ? '모임이 수정되었습니다.' : '모임이 등록되었습니다.';
        statusEl.className = 'form-status success';
        resetEventForm();
        loadEvents();
    } catch (err) {
        console.error('Event save error:', err);
        statusEl.textContent = '저장 중 오류: ' + (err.message || err);
        statusEl.className = 'form-status error';
    } finally {
        btn.disabled = false;
    }
});

async function editEvent(id) {
    const ev = allEvents.find(e => e.id === id);
    if (!ev) return;

    document.getElementById('edit-event-id').value = ev.id;
    document.getElementById('ev-title').value = ev.title;
    document.getElementById('ev-date').value = ev.event_date;
    document.getElementById('ev-day-label').value = ev.day_label || '';
    document.getElementById('ev-location').value = ev.location || '';
    document.getElementById('ev-address').value = ev.address || '';
    document.getElementById('ev-map-url').value = ev.map_url || '';
    // 장소 select에서 이름 매칭으로 선택
    const matchedLoc = locationOptions.find(l => l.name === ev.location);
    document.getElementById('ev-location-select').value = matchedLoc ? matchedLoc.id : '';
    document.getElementById('ev-desc').value = ev.description || '';
    document.getElementById('ev-capacity').value = ev.capacity || 20;
    document.getElementById('ev-provision').value = ev.provision || '';
    document.getElementById('ev-youtube').value = ev.youtube_url || '';

    // 슬롯 row 채우기 (캐시된 _slots 우선, 없으면 fetch)
    let slots = ev._slots;
    if (!slots) {
        try { slots = await DB.getEventSlots(ev.id); } catch (e) { slots = []; }
    }
    // 활성 슬롯만 표시 (비활성/소프트삭제 슬롯 제외)
    const activeSlots = (slots || []).filter(function(s) { return s.is_active !== false; });
    renderSlotRows(activeSlots.length ? activeSlots : DEFAULT_SLOTS);

    document.getElementById('event-form-title').textContent = '모임 수정';
    eventForm.querySelector('.form-submit').textContent = '모임 수정 →';
    eventFormReset.style.display = 'inline-flex';

    // 폼으로 스크롤
    eventForm.scrollIntoView({ behavior: 'smooth', block: 'center' });
}

function resetEventForm() {
    eventForm.reset();
    document.getElementById('edit-event-id').value = '';
    document.getElementById('ev-location').value = '';
    document.getElementById('ev-address').value = '';
    document.getElementById('ev-map-url').value = '';
    document.getElementById('event-form-title').textContent = '새 모임 등록';
    eventForm.querySelector('.form-submit').textContent = '모임 등록 →';
    eventFormReset.style.display = 'none';
    document.getElementById('event-form-status').textContent = '';
    // 슬롯 row 디폴트 3개로 초기화
    renderSlotRows(DEFAULT_SLOTS);
    // 제공사항 디폴트 값 채우기
    document.getElementById('ev-provision').value = DEFAULT_PROVISION;
    // 정원 디폴트
    document.getElementById('ev-capacity').value = 20;
}

// 페이지 로드 시 디폴트 슬롯 row + 제공사항 디폴트 렌더링
renderSlotRows(DEFAULT_SLOTS);
(function() {
    var p = document.getElementById('ev-provision');
    if (p && !p.value) p.value = DEFAULT_PROVISION;
})();

eventFormReset.addEventListener('click', resetEventForm);

async function toggleEventActive(id, isActive) {
    try {
        await DB.updateEvent(id, { is_active: !isActive });
        loadEvents();
    } catch (e) {
        alert('상태 변경 중 오류가 발생했습니다.');
    }
}

async function deleteEvent(id, title) {
    if (!confirm(`"${title}" 모임을 정말 삭제하시겠습니까?\n삭제하면 복구할 수 없습니다.`)) return;
    try {
        await DB.deleteEvent(id);
        alert('모임이 삭제되었습니다.');
        loadEvents();
    } catch (e) {
        alert('삭제 중 오류가 발생했습니다: ' + (e.message || e));
    }
}

// ========== Attendees ==========
let currentAttendEventId = null;
let currentAttendEventTitle = null;

async function viewAttendees(eventId, eventTitle) {
    currentAttendEventId = eventId;
    currentAttendEventTitle = eventTitle;
    const card = document.getElementById('attendees-card');
    const tbody = document.getElementById('attendees-tbody');
    const titleEl = document.getElementById('attendees-title');
    const countEl = document.getElementById('attendees-count');

    card.style.display = 'block';
    titleEl.textContent = `"${eventTitle}" 참여자 명단`;
    tbody.innerHTML = '<tr><td colspan="7" class="admin-loading">로딩 중...</td></tr>';
    countEl.textContent = '';

    try {
        const attendees = await DB.getEventAttendees(eventId);

        if (attendees.length === 0) {
            tbody.innerHTML = '<tr><td colspan="7" class="admin-empty">참여 신청자가 없습니다.</td></tr>';
            countEl.textContent = '';
        } else {
            // 타임 슬롯 우선순위로 정렬 (sort_order → slot_time → 미배정 마지막)
            attendees.sort(function(a, b) {
                var sa = a.slot, sb = b.slot;
                // 미배정(슬롯 없음)은 맨 뒤
                if (!sa && !sb) return new Date(a.created_at) - new Date(b.created_at);
                if (!sa) return 1;
                if (!sb) return -1;
                var oa = sa.sort_order != null ? sa.sort_order : 999;
                var ob = sb.sort_order != null ? sb.sort_order : 999;
                if (oa !== ob) return oa - ob;
                var ta = sa.slot_time || '';
                var tb = sb.slot_time || '';
                if (ta !== tb) return ta < tb ? -1 : 1;
                return new Date(a.created_at) - new Date(b.created_at);
            });

            // 슬롯별 그룹 렌더 (그룹 헤더 row + 멤버 row)
            var html = '';
            var currentSlotKey = null;
            var slotMemberCounts = {};
            // 그룹별 카운트 미리 계산
            attendees.forEach(function(a) {
                var k = a.slot ? a.slot.id : '__none__';
                slotMemberCounts[k] = (slotMemberCounts[k] || 0) + 1;
            });

            attendees.forEach(function(a) {
                var slotKey = a.slot ? a.slot.id : '__none__';
                if (slotKey !== currentSlotKey) {
                    currentSlotKey = slotKey;
                    var headerLabel;
                    if (a.slot) {
                        var emoji = a.slot.slot_emoji || '';
                        var label = a.slot.slot_label || '';
                        var t = a.slot.slot_time ? String(a.slot.slot_time).slice(0,5) : '';
                        headerLabel = (emoji + ' ' + label + (t ? ' (' + t + ')' : '')).trim();
                    } else {
                        headerLabel = '슬롯 미배정';
                    }
                    html += '<tr class="attendees-slot-header"><td colspan="7" style="background:rgba(255,212,107,0.08); font-weight:600; padding:0.6rem 0.75rem; border-top:1px solid rgba(255,212,107,0.3);">' +
                        escapeHtml(headerLabel) + ' — ' + slotMemberCounts[slotKey] + '명</td></tr>';
                }
                var name = a.profiles ? a.profiles.name : '-';
                var phone = a.profiles ? a.profiles.phone : '-';
                var email = a.profiles ? (a.profiles.email || '-') : '-';
                var slotLabelCell = a.slot
                    ? ((a.slot.slot_emoji || '') + ' ' + (a.slot.slot_label || '')).trim()
                    : '-';
                var date = a.created_at ? new Date(a.created_at).toLocaleDateString('ko-KR') : '-';
                var isGuest = !!a.is_guest;
                var nameDisplay = isGuest ? (escapeHtml(name) + ' <span style="color:var(--accent-pink); font-size:0.78rem; margin-left:0.3rem;">[게스트]</span>') : escapeHtml(name);
                var deleteBtn = isGuest
                    ? '<button class="btn-secondary btn-small" onclick="deleteGuestAttendee(' + a.guest_id + ', \'' + escapeHtml(name) + '\')" style="color:var(--accent-pink);">삭제</button>'
                    : '<button class="btn-secondary btn-small" onclick="deleteAttendee(\'' + a.user_id + '\', \'' + a.event_id + '\', \'' + escapeHtml(name) + '\')" style="color:var(--accent-pink);">삭제</button>';
                html += '<tr>' +
                    '<td>' + nameDisplay + '</td>' +
                    '<td>' + escapeHtml(slotLabelCell) + '</td>' +
                    '<td>' + escapeHtml(phone) + '</td>' +
                    '<td>' + escapeHtml(email) + '</td>' +
                    '<td>' + escapeHtml(a.note || '-') + '</td>' +
                    '<td>' + date + '</td>' +
                    '<td>' + deleteBtn + '</td>' +
                '</tr>';
            });
            tbody.innerHTML = html;
            countEl.textContent = '총 ' + attendees.length + '명';
        }
    } catch (e) {
        console.error('viewAttendees error:', e);
        tbody.innerHTML = '<tr><td colspan="7" class="admin-empty">참여자 목록을 불러올 수 없습니다: ' + (e.message || e) + '</td></tr>';
    }

    card.scrollIntoView({ behavior: 'smooth', block: 'center' });
}

async function deleteAttendee(userId, eventId, displayName) {
    if (!confirm(`"${displayName}" 님의 참여 신청을 삭제하시겠습니까?`)) return;
    try {
        await DB.adminDeleteAttendance(userId, eventId);
        alert('참여 신청이 삭제되었습니다.');
        await viewAttendees(currentAttendEventId, currentAttendEventTitle);
    } catch (e) {
        alert('삭제 중 오류가 발생했습니다: ' + (e.message || e));
    }
}

async function deleteGuestAttendee(guestId, displayName) {
    if (!confirm(`"${displayName}" (게스트) 님의 참여 신청을 삭제하시겠습니까?`)) return;
    try {
        await DB.deleteGuestAttendance(guestId);
        alert('게스트 참여 신청이 삭제되었습니다.');
        await viewAttendees(currentAttendEventId, currentAttendEventTitle);
    } catch (e) {
        alert('삭제 중 오류가 발생했습니다: ' + (e.message || e));
    }
}

// ========== Locations ==========
let allLocations = [];

async function loadLocations() {
    try {
        allLocations = await DB.getAllLocations();
        renderLocations(allLocations);
    } catch (e) {
        document.getElementById('locations-tbody').innerHTML =
            '<tr><td colspan="5" class="admin-empty">장소 목록을 불러올 수 없습니다.</td></tr>';
    }
}

function renderLocations(locations) {
    const tbody = document.getElementById('locations-tbody');
    if (locations.length === 0) {
        tbody.innerHTML = '<tr><td colspan="5" class="admin-empty">등록된 장소가 없습니다.</td></tr>';
        return;
    }

    tbody.innerHTML = locations.map(loc => {
        const typeLabel = loc.loc_type === 'primary' ? '메인' : '보조';
        const status = loc.is_active
            ? '<span class="admin-badge active">활성</span>'
            : '<span class="admin-badge inactive">비활성</span>';

        return `<tr>
            <td>${escapeHtml(loc.name)}</td>
            <td>${escapeHtml(loc.address || '-')}</td>
            <td>${escapeHtml(typeLabel)}</td>
            <td>${status}</td>
            <td>
                <button class="btn-secondary btn-small" onclick="editLocation(${loc.id})">수정</button>
                <button class="btn-secondary btn-small" onclick="toggleLocationActive(${loc.id}, ${loc.is_active})">${loc.is_active ? '비활성화' : '활성화'}</button>
                <button class="btn-secondary btn-small" onclick="deleteLocation(${loc.id})" style="color:var(--accent-pink);">삭제</button>
            </td>
        </tr>`;
    }).join('');
}

// ========== Location Form ==========
const locForm = document.getElementById('loc-form');
const locFormReset = document.getElementById('loc-form-reset');

locForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const statusEl = document.getElementById('loc-form-status');
    const btn = locForm.querySelector('.form-submit');
    const editId = document.getElementById('edit-loc-id').value;

    const locData = {
        name: document.getElementById('loc-name').value.trim(),
        loc_type: document.getElementById('loc-type').value,
        address: document.getElementById('loc-address').value.trim(),
        map_url: document.getElementById('loc-map-url').value.trim(),
        note: document.getElementById('loc-note').value.trim()
    };

    statusEl.textContent = '저장 중...';
    statusEl.className = 'form-status loading';
    btn.disabled = true;

    try {
        if (editId) {
            await DB.updateLocation(parseInt(editId), locData);
            statusEl.textContent = '장소가 수정되었습니다.';
        } else {
            await DB.createLocation(locData);
            statusEl.textContent = '장소가 등록되었습니다.';
        }
        statusEl.className = 'form-status success';
        resetLocForm();
        loadLocations();
    } catch (err) {
        statusEl.textContent = '저장 중 오류가 발생했습니다.';
        statusEl.className = 'form-status error';
    } finally {
        btn.disabled = false;
    }
});

function editLocation(id) {
    const loc = allLocations.find(l => l.id === id);
    if (!loc) return;

    document.getElementById('edit-loc-id').value = loc.id;
    document.getElementById('loc-name').value = loc.name;
    document.getElementById('loc-type').value = loc.loc_type || 'primary';
    document.getElementById('loc-address').value = loc.address || '';
    document.getElementById('loc-map-url').value = loc.map_url || '';
    document.getElementById('loc-note').value = loc.note || '';
    document.getElementById('loc-form-title').textContent = '장소 수정';
    locForm.querySelector('.form-submit').textContent = '장소 수정 →';
    locFormReset.style.display = 'inline-flex';

    locForm.scrollIntoView({ behavior: 'smooth', block: 'center' });
}

function resetLocForm() {
    locForm.reset();
    document.getElementById('edit-loc-id').value = '';
    document.getElementById('loc-form-title').textContent = '새 장소 등록';
    locForm.querySelector('.form-submit').textContent = '장소 등록 →';
    locFormReset.style.display = 'none';
    document.getElementById('loc-form-status').textContent = '';
}

locFormReset.addEventListener('click', resetLocForm);

async function toggleLocationActive(id, isActive) {
    try {
        await DB.updateLocation(id, { is_active: !isActive });
        loadLocations();
    } catch (e) {
        alert('상태 변경 중 오류가 발생했습니다.');
    }
}

async function deleteLocation(id) {
    if (!confirm('이 장소를 삭제하시겠습니까?')) return;
    try {
        await DB.deleteLocation(id);
        loadLocations();
    } catch (e) {
        alert('삭제 중 오류가 발생했습니다.');
    }
}

// ========== Delete Member ==========
async function deleteMember(userId, displayName) {
    if (!confirm(`"${displayName}" 회원을 정말 삭제하시겠습니까?\n삭제하면 복구할 수 없습니다.`)) return;
    try {
        const { error } = await _supabase.rpc('delete_user', { target_user_id: userId });
        if (error) throw error;
        alert('회원이 삭제되었습니다.');
        loadMembers();
    } catch (e) {
        alert('회원 삭제 중 오류가 발생했습니다: ' + (e.message || e));
    }
}

// ========== Inquiries ==========
let allInquiries = [];

async function loadInquiries() {
    try {
        var rows = await DB.getAllInquiries();
        // 모임 참여 신청(event_id가 있는 행)은 참석자 명단에서 따로 보여주므로 문의 관리에서 제외
        allInquiries = (rows || []).filter(function(r) {
            return !r.event_id && !r.event_slot_id;
        });
        renderInquiries(allInquiries);
    } catch (e) {
        document.getElementById('inquiries-tbody').innerHTML =
            '<tr><td colspan="8" class="admin-empty">문의 목록을 불러올 수 없습니다.</td></tr>';
    }
}

function renderInquiries(inquiries) {
    const tbody = document.getElementById('inquiries-tbody');
    if (inquiries.length === 0) {
        tbody.innerHTML = '<tr><td colspan="8" class="admin-empty">접수된 문의가 없습니다.</td></tr>';
        document.getElementById('inquiry-count').textContent = '';
        return;
    }

    tbody.innerHTML = inquiries.map(inq => {
        const date = inq.created_at ? new Date(inq.created_at).toLocaleDateString('ko-KR') : '-';
        const slotLabel = inq.event_slot_id ? ('#' + inq.event_slot_id) : '-';
        return `<tr>
            <td>${escapeHtml(inq.name || '-')}</td>
            <td>${slotLabel}</td>
            <td>${escapeHtml(inq.phone || '-')}</td>
            <td>${escapeHtml(inq.email || '-')}</td>
            <td>${escapeHtml(inq.subject || '-')}</td>
            <td title="${escapeHtml(inq.message || '')}">${escapeHtml((inq.message || '').substring(0, 50))}${(inq.message || '').length > 50 ? '...' : ''}</td>
            <td>${date}</td>
            <td>
                <button class="btn-secondary btn-small" onclick="viewInquiryDetail(${inq.id})">상세</button>
                <button class="btn-secondary btn-small" onclick="deleteInquiry(${inq.id})" style="color:var(--accent-pink);">삭제</button>
            </td>
        </tr>`;
    }).join('');

    document.getElementById('inquiry-count').textContent = `총 ${inquiries.length}건`;
}

function viewInquiryDetail(id) {
    const inq = allInquiries.find(i => i.id === id);
    if (!inq) return;

    document.getElementById('inq-detail-name').textContent = inq.name || '-';
    document.getElementById('inq-detail-phone').textContent = inq.phone || '-';
    document.getElementById('inq-detail-email').textContent = inq.email || '-';
    document.getElementById('inq-detail-subject').textContent = inq.subject || '-';
    document.getElementById('inq-detail-message').textContent = inq.message || '-';
    document.getElementById('inq-detail-date').textContent =
        inq.created_at ? new Date(inq.created_at).toLocaleDateString('ko-KR') : '-';

    document.getElementById('inquiry-detail-modal').classList.add('open');
}

document.getElementById('inquiry-detail-close').addEventListener('click', () => {
    document.getElementById('inquiry-detail-modal').classList.remove('open');
});

document.getElementById('inquiry-detail-modal').addEventListener('click', (e) => {
    if (e.target === e.currentTarget) {
        e.currentTarget.classList.remove('open');
    }
});

async function deleteInquiry(id) {
    if (!confirm('이 문의를 삭제하시겠습니까?')) return;
    try {
        await DB.deleteInquiry(id);
        loadInquiries();
    } catch (e) {
        alert('삭제 중 오류가 발생했습니다.');
    }
}

// ========== Export Members ==========
function getMembersExportData() {
    const members = allMembers.length > 0 ? allMembers : [];
    return members.map(m => ({
        '이름': m.name || '',
        '전화번호': m.phone || '',
        '이메일': m.email || '',
        '현재 하는 일': m.current_job || '',
        '관심분야': Array.isArray(m.interests) ? m.interests.join(', ') : (m.interests || ''),
        '하고 싶은 말': m.message || '',
        '가입일': m.created_at ? new Date(m.created_at).toLocaleDateString('ko-KR') : ''
    }));
}

function exportMembersExcel() {
    const data = getMembersExportData();
    if (data.length === 0) { alert('다운로드할 멤버 데이터가 없습니다.'); return; }
    const ws = XLSX.utils.json_to_sheet(data);
    // 열 너비 설정
    ws['!cols'] = [
        { wch: 10 }, { wch: 15 }, { wch: 25 },
        { wch: 30 }, { wch: 30 }, { wch: 10 }, { wch: 12 }
    ];
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, '멤버목록');
    const today = new Date().toISOString().slice(0, 10);
    XLSX.writeFile(wb, `AI_Study_110_멤버목록_${today}.xlsx`);
}

function exportMembersCsv() {
    const data = getMembersExportData();
    if (data.length === 0) { alert('다운로드할 멤버 데이터가 없습니다.'); return; }
    const ws = XLSX.utils.json_to_sheet(data);
    const csv = '\uFEFF' + XLSX.utils.sheet_to_csv(ws); // BOM for Excel Korean support
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    const today = new Date().toISOString().slice(0, 10);
    a.href = url;
    a.download = `AI_Study_110_멤버목록_${today}.csv`;
    a.click();
    URL.revokeObjectURL(url);
}

// ========== Helpers ==========
function escapeHtml(str) {
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
}

// =============================================
// ========== Email Send Panel ==========
// =============================================
let _emailPanelInitialized = false;
let _emailEvents = [];                // 회차 캐시
let _emailEventAttendees = {};        // event_id → email[]

async function initEmailPanel() {
    if (_emailPanelInitialized) return;
    _emailPanelInitialized = true;

    // 모드 라디오 변경 이벤트
    document.querySelectorAll('input[name="em-recipient-mode"]').forEach(r => {
        r.addEventListener('change', onEmailModeChange);
    });
    // 모임 선택 변경
    document.getElementById('em-event-select').addEventListener('change', refreshEmailRecipientPreview);
    // 직접 입력 변경
    document.getElementById('em-manual-emails').addEventListener('input', refreshEmailRecipientPreview);
    // 본문 변경 (미리보기는 버튼 클릭 시에만 실행)
    document.getElementById('em-preview-btn').addEventListener('click', showEmailPreview);
    document.getElementById('em-test-btn').addEventListener('click', sendTestEmail);
    document.getElementById('email-form').addEventListener('submit', onEmailFormSubmit);

    // 회차 목록 로드
    try {
        _emailEvents = await DB.getEventsForEmail();
        const sel = document.getElementById('em-event-select');
        sel.innerHTML = '<option value="">-- 모임을 선택하세요 --</option>' +
            _emailEvents.map(e => {
                const label = `${e.event_date} · ${escapeHtml(e.title || '')} ${e.active ? '' : '(비활성)'}`;
                return `<option value="${e.id}">${label}</option>`;
            }).join('');
    } catch (e) {
        console.error('회차 로드 실패:', e);
    }

    // 발송 이력 로드
    loadEmailLogs();

    // 초기 수신자 미리보기
    refreshEmailRecipientPreview();
}

function onEmailModeChange() {
    const mode = document.querySelector('input[name="em-recipient-mode"]:checked').value;
    document.getElementById('em-event-group').style.display = (mode === 'event') ? '' : 'none';
    document.getElementById('em-manual-group').style.display = (mode === 'manual') ? '' : 'none';
    refreshEmailRecipientPreview();
}

async function getEmailRecipients() {
    const mode = document.querySelector('input[name="em-recipient-mode"]:checked').value;

    if (mode === 'all') {
        // allMembers는 loadMembers()에서 이미 채워짐
        return allMembers
            .map(m => (m.email || '').trim().toLowerCase())
            .filter(e => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e));
    }

    if (mode === 'event') {
        const eid = document.getElementById('em-event-select').value;
        if (!eid) return [];

        if (_emailEventAttendees[eid]) return _emailEventAttendees[eid];

        try {
            const rows = await DB.getEventAttendees(parseInt(eid));
            const emails = rows
                .map(r => (r.profiles && r.profiles.email) || '')
                .map(e => (e || '').trim().toLowerCase())
                .filter(e => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e));
            const unique = Array.from(new Set(emails));
            _emailEventAttendees[eid] = unique;
            return unique;
        } catch (e) {
            console.error('참석자 로드 실패:', e);
            return [];
        }
    }

    if (mode === 'manual') {
        const raw = document.getElementById('em-manual-emails').value || '';
        const emails = raw.split(/[,\n\s]+/)
            .map(e => e.trim().toLowerCase())
            .filter(e => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e));
        return Array.from(new Set(emails));
    }

    return [];
}

async function refreshEmailRecipientPreview() {
    const box = document.getElementById('em-recipient-preview');
    box.textContent = '수신자 계산 중...';
    try {
        const list = await getEmailRecipients();
        if (list.length === 0) {
            box.textContent = '⚠️ 유효한 수신자가 없습니다.';
            return;
        }
        const sample = list.slice(0, 3).join(', ');
        const more = list.length > 3 ? ` 외 ${list.length - 3}명` : '';
        box.textContent = `수신자 ${list.length}명: ${sample}${more}`;
    } catch (e) {
        box.textContent = '오류: ' + e.message;
    }
}

function buildEmailHtml(rawBody) {
    // 개행 → <br>, URL 자동 링크는 사용자가 직접 <a> 입력하도록
    const cleaned = String(rawBody || '');
    // 이미 HTML 태그가 있으면 그대로 두고, 없으면 줄바꿈 처리
    const hasTags = /<[a-z][^>]*>/i.test(cleaned);
    if (hasTags) {
        return cleaned;
    }
    return cleaned.replace(/\n/g, '<br>\n');
}

function showEmailPreview() {
    const subject = document.getElementById('em-subject').value || '(제목 없음)';
    const bodyRaw = document.getElementById('em-body').value || '';
    document.getElementById('em-pv-subject').textContent = subject;
    document.getElementById('em-pv-body').innerHTML = buildEmailHtml(bodyRaw);
    document.getElementById('em-preview-card').style.display = 'block';
}

function setEmailStatus(msg, type) {
    const el = document.getElementById('em-status');
    el.textContent = msg || '';
    el.style.color = type === 'error' ? 'var(--accent-pink)'
        : type === 'success' ? 'var(--accent-cyan)'
        : 'var(--text-muted)';
}

async function sendTestEmail() {
    const subject = (document.getElementById('em-subject').value || '').trim();
    const bodyRaw = (document.getElementById('em-body').value || '').trim();
    if (!subject || !bodyRaw) {
        setEmailStatus('제목과 본문을 입력하세요.', 'error');
        return;
    }
    if (!adminUser || !adminUser.email) {
        setEmailStatus('로그인 정보를 확인할 수 없습니다.', 'error');
        return;
    }

    if (!confirm(`테스트 발송: ${adminUser.email} 으로 1통 발송합니다. 진행할까요?`)) return;

    setEmailStatus('테스트 발송 중...', 'info');
    try {
        const result = await DB.sendBulkEmail({
            to: [adminUser.email],
            subject: '[테스트] ' + subject,
            html: buildEmailHtml(bodyRaw),
            test: true
        });
        setEmailStatus(`✅ 테스트 발송 완료 (성공 ${result.sent} / 실패 ${result.failed}). 본인 메일함을 확인하세요.`, 'success');
        loadEmailLogs();
    } catch (e) {
        setEmailStatus('❌ 발송 실패: ' + e.message, 'error');
    }
}

async function onEmailFormSubmit(e) {
    e.preventDefault();
    const subject = (document.getElementById('em-subject').value || '').trim();
    const bodyRaw = (document.getElementById('em-body').value || '').trim();
    if (!subject || !bodyRaw) {
        setEmailStatus('제목과 본문을 입력하세요.', 'error');
        return;
    }

    setEmailStatus('수신자 확정 중...', 'info');
    const recipients = await getEmailRecipients();
    if (recipients.length === 0) {
        setEmailStatus('유효한 수신자가 없습니다.', 'error');
        return;
    }

    const sample = recipients.slice(0, 5).join('\n');
    const more = recipients.length > 5 ? `\n... 외 ${recipients.length - 5}명` : '';
    const confirmMsg = `📨 ${recipients.length}명에게 발송합니다.\n\n제목: ${subject}\n\n수신자(미리보기):\n${sample}${more}\n\n실제로 발송하시겠습니까?`;
    if (!confirm(confirmMsg)) {
        setEmailStatus('취소되었습니다.', 'info');
        return;
    }

    setEmailStatus(`발송 중... (${recipients.length}명, 약 ${Math.ceil(recipients.length * 0.7)}초 소요 예상)`, 'info');
    const submitBtn = document.querySelector('#email-form button[type="submit"]');
    if (submitBtn) submitBtn.disabled = true;

    try {
        const result = await DB.sendBulkEmail({
            to: recipients,
            subject: subject,
            html: buildEmailHtml(bodyRaw),
            test: false
        });
        setEmailStatus(`✅ 발송 완료 — 성공 ${result.sent}건 / 실패 ${result.failed}건`, 'success');
        loadEmailLogs();
    } catch (e) {
        setEmailStatus('❌ 발송 실패: ' + e.message, 'error');
    } finally {
        if (submitBtn) submitBtn.disabled = false;
    }
}

async function loadEmailLogs() {
    const tbody = document.getElementById('email-logs-tbody');
    try {
        const logs = await DB.getEmailLogs(30);
        if (logs.length === 0) {
            tbody.innerHTML = '<tr><td colspan="6" class="admin-empty">발송 이력이 없습니다.</td></tr>';
            return;
        }
        tbody.innerHTML = logs.map(log => {
            const dt = new Date(log.created_at);
            const dateStr = dt.toLocaleString('ko-KR', { month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' });
            return `<tr>
                <td>${dateStr}</td>
                <td>${escapeHtml(log.subject || '')}</td>
                <td>${log.recipients_count}</td>
                <td style="color:var(--accent-cyan);">${log.success_count}</td>
                <td style="color:${log.fail_count > 0 ? 'var(--accent-pink)' : 'inherit'};">${log.fail_count}</td>
                <td>${escapeHtml(log.sent_by_email || '-')}</td>
            </tr>`;
        }).join('');
    } catch (e) {
        tbody.innerHTML = `<tr><td colspan="6" class="admin-empty">이력 조회 실패: ${escapeHtml(e.message)}</td></tr>`;
    }
}

// ========== Init ==========
initAdmin();
