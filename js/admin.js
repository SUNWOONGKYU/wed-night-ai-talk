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
        tbody.innerHTML = '<tr><td colspan="7" class="admin-empty">등록된 멤버가 없습니다.</td></tr>';
        document.getElementById('member-count').textContent = '';
        return;
    }

    tbody.innerHTML = members.map(m => {
        const interests = (m.interests || []).join(', ');
        const date = m.created_at ? new Date(m.created_at).toLocaleDateString('ko-KR') : '-';
        return `<tr>
            <td>${escapeHtml(m.name || '-')}</td>
            <td>${escapeHtml(m.phone || '-')}</td>
            <td>${escapeHtml(m.email || '-')}</td>
            <td>${escapeHtml(interests || '-')}</td>
            <td>${escapeHtml(m.member_type || '-')}</td>
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
        const time = ev.event_time ? ev.event_time.slice(0, 5) : '-';
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

eventForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const statusEl = document.getElementById('event-form-status');
    const btn = eventForm.querySelector('.form-submit');
    const editId = document.getElementById('edit-event-id').value;

    const eventData = {
        title: document.getElementById('ev-title').value.trim(),
        event_date: document.getElementById('ev-date').value,
        event_time: document.getElementById('ev-time').value || null,
        day_label: document.getElementById('ev-day-label').value,
        location: document.getElementById('ev-location').value.trim(),
        address: document.getElementById('ev-address').value.trim(),
        map_url: document.getElementById('ev-map-url').value.trim(),
        provision: document.getElementById('ev-provision').value.trim(),
        description: document.getElementById('ev-desc').value.trim(),
        youtube_url: document.getElementById('ev-youtube').value.trim() || null
    };

    statusEl.textContent = '저장 중...';
    statusEl.className = 'form-status loading';
    btn.disabled = true;

    try {
        if (editId) {
            await DB.updateEvent(parseInt(editId), eventData);
            statusEl.textContent = '모임이 수정되었습니다.';
        } else {
            await DB.createEvent(eventData);
            statusEl.textContent = '모임이 등록되었습니다.';
        }
        statusEl.className = 'form-status success';
        resetEventForm();
        loadEvents();
    } catch (err) {
        statusEl.textContent = '저장 중 오류가 발생했습니다.';
        statusEl.className = 'form-status error';
    } finally {
        btn.disabled = false;
    }
});

function editEvent(id) {
    const ev = allEvents.find(e => e.id === id);
    if (!ev) return;

    document.getElementById('edit-event-id').value = ev.id;
    document.getElementById('ev-title').value = ev.title;
    document.getElementById('ev-date').value = ev.event_date;
    document.getElementById('ev-time').value = ev.event_time ? ev.event_time.slice(0, 5) : '';
    document.getElementById('ev-day-label').value = ev.day_label || '';
    document.getElementById('ev-location').value = ev.location || '';
    document.getElementById('ev-address').value = ev.address || '';
    document.getElementById('ev-map-url').value = ev.map_url || '';
    // 장소 select에서 이름 매칭으로 선택
    const matchedLoc = locationOptions.find(l => l.name === ev.location);
    document.getElementById('ev-location-select').value = matchedLoc ? matchedLoc.id : '';
    document.getElementById('ev-provision').value = ev.provision || '';
    document.getElementById('ev-desc').value = ev.description || '';
    document.getElementById('ev-youtube').value = ev.youtube_url || '';
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
}

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
    tbody.innerHTML = '<tr><td colspan="6" class="admin-loading">로딩 중...</td></tr>';
    countEl.textContent = '';

    try {
        const attendees = await DB.getEventAttendees(eventId);

        if (attendees.length === 0) {
            tbody.innerHTML = '<tr><td colspan="6" class="admin-empty">참여 신청자가 없습니다.</td></tr>';
            countEl.textContent = '';
        } else {
            tbody.innerHTML = attendees.map(a => {
                const name = a.profiles ? a.profiles.name : '-';
                const phone = a.profiles ? a.profiles.phone : '-';
                const email = a.profiles ? (a.profiles.email || '-') : '-';
                const date = a.created_at ? new Date(a.created_at).toLocaleDateString('ko-KR') : '-';
                return `<tr>
                    <td>${escapeHtml(name)}</td>
                    <td>${escapeHtml(phone)}</td>
                    <td>${escapeHtml(email)}</td>
                    <td>${escapeHtml(a.note || '-')}</td>
                    <td>${date}</td>
                    <td><button class="btn-secondary btn-small" onclick="deleteAttendee('${a.user_id}', '${a.event_id}', '${escapeHtml(name)}')" style="color:var(--accent-pink);">삭제</button></td>
                </tr>`;
            }).join('');
            countEl.textContent = `총 ${attendees.length}명`;
        }
    } catch (e) {
        console.error('viewAttendees error:', e);
        tbody.innerHTML = '<tr><td colspan="6" class="admin-empty">참여자 목록을 불러올 수 없습니다: ' + (e.message || e) + '</td></tr>';
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
        allInquiries = await DB.getAllInquiries();
        renderInquiries(allInquiries);
    } catch (e) {
        document.getElementById('inquiries-tbody').innerHTML =
            '<tr><td colspan="7" class="admin-empty">문의 목록을 불러올 수 없습니다.</td></tr>';
    }
}

function renderInquiries(inquiries) {
    const tbody = document.getElementById('inquiries-tbody');
    if (inquiries.length === 0) {
        tbody.innerHTML = '<tr><td colspan="7" class="admin-empty">접수된 문의가 없습니다.</td></tr>';
        document.getElementById('inquiry-count').textContent = '';
        return;
    }

    tbody.innerHTML = inquiries.map(inq => {
        const date = inq.created_at ? new Date(inq.created_at).toLocaleDateString('ko-KR') : '-';
        return `<tr>
            <td>${escapeHtml(inq.name || '-')}</td>
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

// ========== Helpers ==========
function escapeHtml(str) {
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
}

// ========== Init ==========
initAdmin();
