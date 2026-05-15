// ========== Profile Page — 내 프로필 + 신청 내역 ==========
let pfCurrentUser = null;
let pfCurrentProfile = null;

function pfEscape(str) {
    var div = document.createElement('div');
    div.textContent = str || '';
    return div.innerHTML;
}

// 'YYYY-MM-DD' 문자열은 로컬 자정으로 파싱하여 타임존 음수 오프셋에서 하루 밀림 방지
function pfToLocalDate(d) {
    if (!d) return null;
    if (typeof d === 'string') {
        var m = d.match(/^(\d{4})-(\d{2})-(\d{2})/);
        if (m) return new Date(parseInt(m[1],10), parseInt(m[2],10)-1, parseInt(m[3],10));
    }
    return new Date(d);
}

function pfFormatDate(d) {
    if (!d) return '—';
    try {
        var date = pfToLocalDate(d);
        var y = date.getFullYear();
        var m = ('0' + (date.getMonth() + 1)).slice(-2);
        var day = ('0' + date.getDate()).slice(-2);
        return y + '-' + m + '-' + day;
    } catch (e) { return String(d); }
}

function pfFormatDateLong(d) {
    if (!d) return '—';
    try {
        var date = pfToLocalDate(d);
        var y = date.getFullYear();
        var m = date.getMonth() + 1;
        var day = date.getDate();
        var dayNames = ['일','월','화','수','목','금','토'];
        return y + '년 ' + m + '월 ' + day + '일 (' + dayNames[date.getDay()] + ')';
    } catch (e) { return String(d); }
}

async function pfInit() {
    var loginPrompt = document.getElementById('profile-login-prompt');
    var pfCard = document.getElementById('profile-card');
    var listEl = document.getElementById('my-attendances');

    try {
        var session = await Auth.getSession();
        if (!session) {
            loginPrompt.style.display = 'block';
            pfCard.style.display = 'none';
            listEl.innerHTML = '';
            return;
        }
        pfCurrentUser = session.user;
        try { pfCurrentProfile = await DB.getProfile(pfCurrentUser.id); } catch (e) { pfCurrentProfile = null; }
    } catch (e) {
        loginPrompt.style.display = 'block';
        return;
    }

    pfUpdateNav();

    // 프로필 카드
    pfCard.style.display = 'block';
    document.getElementById('pf-name').textContent = (pfCurrentProfile && pfCurrentProfile.name) || '—';
    document.getElementById('pf-email').textContent = pfCurrentUser.email || '—';
    document.getElementById('pf-phone').textContent = (pfCurrentProfile && pfCurrentProfile.phone) || '—';
    document.getElementById('pf-created').textContent = pfFormatDate(pfCurrentUser.created_at);

    // 신청 내역
    await pfLoadAttendances();
}

function pfUpdateNav() {
    var loginLink = document.getElementById('nav-login-link');
    var signupLink = document.getElementById('nav-signup-link');
    var userMenu = document.getElementById('nav-user-menu');
    var userName = document.getElementById('nav-user-name');
    var adminLink = document.getElementById('nav-admin-link');

    if (pfCurrentUser) {
        if (loginLink) loginLink.style.display = 'none';
        if (signupLink) signupLink.style.display = 'none';
        if (userMenu) userMenu.style.display = 'block';
        if (userName) userName.textContent = (pfCurrentProfile && pfCurrentProfile.name) || pfCurrentUser.email;
        if (adminLink) adminLink.style.display = (pfCurrentProfile && pfCurrentProfile.role === 'admin') ? 'block' : 'none';
    }
}

async function pfLoadAttendances() {
    var listEl = document.getElementById('my-attendances');
    listEl.innerHTML = '<div class="admin-loading">불러오는 중...</div>';

    try {
        var rows = await DB.getMyAttendancesFull();

        // 클라이언트 정렬 보강 (서버 정렬 변경에 견고하게) — event_date ASC
        // pfToLocalDate로 통일하여 classify/render 경로와 형 일관화
        rows.sort(function(a, b) {
            var da = pfToLocalDate(a.event_date) || new Date(0);
            var db = pfToLocalDate(b.event_date) || new Date(0);
            return da - db;
        });

        // 분류: 활성 미래 / 활성 과거 / 취소(비활성) — 비활성 미래는 사실상 취소된 모임
        var today = new Date();
        today.setHours(0, 0, 0, 0);

        var upcoming = [];
        var past = [];
        var cancelled = [];
        rows.forEach(function(r) {
            var d = pfToLocalDate(r.event_date);
            if (!r.is_active) {
                // 비활성: 과거면 지난 모임에, 미래면 취소(폐강)된 모임으로
                if (d >= today) cancelled.push(r);
                else past.push(r);
                return;
            }
            if (d >= today) upcoming.push(r);
            else past.push(r);
        });

        if (upcoming.length === 0 && past.length === 0 && cancelled.length === 0) {
            listEl.innerHTML = '<div class="speakup-empty">아직 신청한 모임이 없습니다. <a href="index.html#schedule">모임 둘러보기 →</a></div>';
            return;
        }

        var html = '';
        if (upcoming.length > 0) {
            html += '<div class="my-att-section-label">🟢 예정된 모임 (' + upcoming.length + '건)</div>';
            html += upcoming.map(pfRenderRow).join('');
        }
        if (cancelled.length > 0) {
            html += '<div class="my-att-section-label cancelled">⚠️ 취소(폐강)된 모임 (' + cancelled.length + '건)</div>';
            html += cancelled.map(pfRenderRow).join('');
        }
        if (past.length > 0) {
            html += '<div class="my-att-section-label past">⏳ 지난 모임 (' + past.length + '건)</div>';
            html += past.map(pfRenderRow).join('');
        }

        listEl.innerHTML = html;

        // 취소 버튼 바인딩
        listEl.querySelectorAll('.my-att-cancel-btn').forEach(function(btn) {
            btn.addEventListener('click', async function() {
                var eventId = parseInt(btn.dataset.eventId, 10);
                var rawSlot = btn.dataset.slotId;
                var parsedSlot = parseInt(rawSlot, 10);
                // slotId=0도 유효값으로 처리 (NaN/빈문자열만 null)
                var slotId = (rawSlot === '' || !Number.isFinite(parsedSlot)) ? null : parsedSlot;
                if (!confirm('이 모임 신청을 취소하시겠습니까?')) return;
                btn.disabled = true;
                try {
                    await DB.cancelAttendance(pfCurrentUser.id, eventId, slotId);
                    await pfLoadAttendances();
                } catch (err) {
                    alert('취소 오류: ' + (err.message || err));
                    btn.disabled = false;
                }
            });
        });
    } catch (e) {
        console.error('pfLoadAttendances error:', e);
        listEl.innerHTML = '<div style="color:var(--accent-pink);padding:1rem;">신청 내역을 불러올 수 없습니다: ' + pfEscape(e.message || String(e)) + '</div>';
    }
}

function pfRenderRow(r) {
    var timeStr = '';
    if (r.slot_time) {
        timeStr = r.slot_time + (r.slot_end_time ? ' ~ ' + r.slot_end_time : '');
    }
    var today0 = new Date(); today0.setHours(0,0,0,0);
    var isPast = pfToLocalDate(r.event_date) < today0;
    // isCancelled를 호출자 인자가 아닌 row 자체로 계산 (호출 경로 누락 방지)
    var isCancelled = (r.is_active === false) && !isPast;
    // 미래 + 활성 모임에만 취소 버튼
    var cancelBtn = (isPast || isCancelled) ? '' :
        '<button class="my-att-cancel-btn btn-secondary" data-event-id="' + r.event_id + '" data-slot-id="' + (r.event_slot_id || '') + '">신청 취소</button>';
    var stateCls = isCancelled ? ' cancelled' : (isPast ? ' past' : '');
    var statusBadge = isCancelled ? '<span class="my-att-status-badge cancelled">취소됨</span>' : '';

    return '' +
        '<div class="my-att-item' + stateCls + '">' +
            '<div class="my-att-date">' + pfFormatDateLong(r.event_date) + statusBadge + '</div>' +
            '<div class="my-att-slot">' +
                '<span class="my-att-emoji">' + pfEscape(r.slot_emoji || '') + '</span>' +
                '<span class="my-att-label">' + pfEscape(r.slot_label || '') + '</span>' +
                (timeStr ? '<span class="my-att-time">' + pfEscape(timeStr) + '</span>' : '') +
            '</div>' +
            (r.event_title ? '<div class="my-att-title">' + pfEscape(r.event_title) + '</div>' : '') +
            (cancelBtn ? '<div class="my-att-actions">' + cancelBtn + '</div>' : '') +
        '</div>';
}

// nav user dropdown
document.addEventListener('DOMContentLoaded', function() {
    var btn = document.getElementById('nav-user-btn');
    var dd = document.getElementById('nav-dropdown');
    if (btn && dd) {
        btn.addEventListener('click', function(e) {
            e.stopPropagation();
            dd.classList.toggle('show');
        });
        document.addEventListener('click', function() { dd.classList.remove('show'); });
    }

    // 로그아웃
    document.querySelectorAll('[data-action="logout"]').forEach(function(item) {
        item.addEventListener('click', async function(e) {
            e.preventDefault();
            try { await Auth.signOut(); } catch (err) {}
            window.location.href = 'index.html';
        });
    });

    // 모바일 메뉴
    var mb = document.querySelector('.mobile-menu-btn');
    if (mb) mb.addEventListener('click', function() {
        document.querySelector('.nav-links').classList.toggle('show');
    });
});

// 초기 실행
var pfAttempts = 0;
function pfStart() {
    pfAttempts++;
    if ((typeof DB === 'undefined' || typeof Auth === 'undefined') && pfAttempts < 10) {
        setTimeout(pfStart, 400);
        return;
    }
    if (typeof DB === 'undefined' || typeof Auth === 'undefined') {
        document.getElementById('my-attendances').innerHTML = '<div style="color:var(--accent-pink);padding:1rem;">시스템 로드 실패. 새로고침 해주세요.</div>';
        return;
    }
    pfInit();
}

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', pfStart);
} else {
    pfStart();
}
