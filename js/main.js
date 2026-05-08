// ========== State ==========
let currentUser = null;
let currentProfile = null;
let currentEventId = null; // 첫 번째 활성 이벤트 ID (참여 신청용)

// ========== Scroll Reveal & Nav scroll are handled by js/animations.js (GSAP) ==========

// ========== Mobile menu toggle ==========
document.querySelector('.mobile-menu-btn').addEventListener('click', () => {
    document.querySelector('.nav-links').classList.toggle('show');
});

// ========== Modal ==========
const authModal = document.getElementById('auth-modal');
const modalCloseBtn = document.getElementById('modal-close-btn');

function openModal(tab, options) {
    authModal.classList.add('open');
    document.body.style.overflow = 'hidden';

    const notice = document.getElementById('modal-notice');
    if (notice) {
        notice.style.display = (options && options.showNotice) ? 'block' : 'none';
    }

    if (currentUser) {
        // 로그인 상태: 프로필 현황 표시
        document.getElementById('auth-container').style.display = 'none';
        document.getElementById('profile-container').style.display = 'block';
        document.getElementById('membership-title').textContent = '프로필 현황';
        if (currentProfile) fillProfileAll();
    } else {
        // 비로그인 상태: 가입/로그인/비밀번호찾기/재설정 표시
        document.getElementById('auth-container').style.display = 'block';
        document.getElementById('profile-container').style.display = 'none';

        const signupForm = document.getElementById('signup-form');
        const loginForm = document.getElementById('login-form');
        const forgotForm = document.getElementById('forgot-password-form');
        const resetForm = document.getElementById('reset-password-form');

        signupForm.style.display = 'none';
        loginForm.style.display = 'none';
        forgotForm.style.display = 'none';
        resetForm.style.display = 'none';

        if (tab === 'forgot') {
            forgotForm.style.display = 'block';
            document.getElementById('membership-title').textContent = '비밀번호 찾기';
        } else if (tab === 'reset') {
            resetForm.style.display = 'block';
            document.getElementById('membership-title').textContent = '비밀번호 재설정';
        } else if (tab === 'login') {
            loginForm.style.display = 'block';
            document.getElementById('membership-title').textContent = '로그인';
        } else {
            signupForm.style.display = 'block';
            document.getElementById('membership-title').textContent = '멤버 가입';
        }
    }
}

function closeModal() {
    authModal.classList.remove('open');
    document.body.style.overflow = '';
    // 모달 닫을 때 참여 UI 갱신 (로그인/가입 후 닫았을 때 버튼 상태 반영)
    updateAttendUI();
    if (currentUser) checkAttendance();
}

// 모든 data-open-modal 버튼에서 모달 열기
document.querySelectorAll('[data-open-modal]').forEach(el => {
    el.addEventListener('click', (e) => {
        e.preventDefault();
        const tab = el.getAttribute('data-open-modal') || 'signup';
        // 참여 신청 버튼에서 열릴 때 안내문 표시
        const isAttendBtn = el.id === 'attend-guest-btn';
        openModal(tab, { showNotice: isAttendBtn });
    });
});

// 닫기 버튼
if (modalCloseBtn) modalCloseBtn.addEventListener('click', closeModal);

// 배경 클릭으로 닫기
if (authModal) authModal.addEventListener('click', (e) => {
    if (e.target === authModal) closeModal();
});

// ESC 키로 닫기
document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && authModal && authModal.classList.contains('open')) closeModal();
});

// ========== Login <-> Signup 전환 ==========
document.getElementById('switch-to-login').addEventListener('click', (e) => {
    e.preventDefault();
    openModal('login');
});
document.getElementById('switch-to-signup').addEventListener('click', (e) => {
    e.preventDefault();
    openModal('signup');
});
document.getElementById('switch-to-forgot').addEventListener('click', (e) => {
    e.preventDefault();
    openModal('forgot');
});
document.getElementById('switch-to-login-from-forgot').addEventListener('click', (e) => {
    e.preventDefault();
    openModal('login');
});

// ========== Phone number: strip non-digits ==========
function sanitizePhone(value) {
    return value.replace(/[^0-9]/g, '');
}
document.querySelectorAll('#s-contact, #inq-phone').forEach(function(el) {
    el.addEventListener('input', function() {
        var pos = el.selectionStart;
        var before = el.value.length;
        el.value = sanitizePhone(el.value);
        var after = el.value.length;
        el.setSelectionRange(pos - (before - after), pos - (before - after));
    });
});

// ========== Status helper ==========
function setStatus(el, message, type) {
    el.textContent = message;
    el.className = 'form-status ' + type;
}

// ========== Admin Role Sync ==========
async function syncAdminRole(user, profile) {
    if (!user || !profile) return profile;
    const isAdminEmail = ADMIN_EMAILS.includes(user.email.toLowerCase());
    if (isAdminEmail && profile.role !== 'admin') {
        try {
            profile = await DB.updateProfile(user.id, { role: 'admin' });
        } catch (e) { /* ignore */ }
    }
    return profile;
}

// ========== 비밀번호 재설정 모달 강제 표시 ==========
function showResetPasswordModal() {
    authModal.classList.add('open');
    document.body.style.overflow = 'hidden';
    document.getElementById('auth-container').style.display = 'block';
    document.getElementById('profile-container').style.display = 'none';
    document.getElementById('signup-form').style.display = 'none';
    document.getElementById('login-form').style.display = 'none';
    document.getElementById('forgot-password-form').style.display = 'none';
    document.getElementById('reset-password-form').style.display = 'block';
    document.getElementById('membership-title').textContent = '비밀번호 재설정';
    var noticeEl = document.getElementById('modal-notice');
    if (noticeEl) noticeEl.style.display = 'none';
}

// ========== Auth State Management ==========
async function initAuth() {
    const session = await Auth.getSession();
    if (session) {
        currentUser = session.user;
        try {
            currentProfile = await DB.getProfile(currentUser.id);
            currentProfile = await syncAdminRole(currentUser, currentProfile);
        } catch (e) {
            currentProfile = null;
        }
    }
    updateUI();
    // 카드가 이미 렌더링된 상태면 참여 UI만 업데이트
    updateAttendUI();
    if (currentUser) checkAttendance();

    // recovery 감지 시 → 재설정 폼 표시
    // _pendingPasswordRecovery: 구 implicit 방식 (해시 #type=recovery)
    // _recoverySession: 신 PKCE 방식 (?code=XYZ) — initAuth() 실행 전에 이벤트가 유실되므로 조기 캡처
    if (_pendingPasswordRecovery || _recoverySession) {
        if (_recoverySession) {
            currentUser = _recoverySession.user;
        }
        _pendingPasswordRecovery = false;
        _recoverySession = null;
        showResetPasswordModal();
    }

    Auth.onAuthStateChange(async (event, session) => {
        if (event === 'PASSWORD_RECOVERY') {
            // 비밀번호 재설정 세션도 저장해야 updatePassword가 작동함
            if (session) {
                currentUser = session.user;
            }
            showResetPasswordModal();
            return;
        }
        if (event === 'SIGNED_IN' && session) {
            currentUser = session.user;
            try {
                currentProfile = await DB.getProfile(currentUser.id);
                currentProfile = await syncAdminRole(currentUser, currentProfile);
            } catch (e) {
                currentProfile = null;
            }
            updateUI();
            // 로그인 후 참여 UI만 업데이트 (카드 전체 재렌더링 불필요)
            updateAttendUI();
            if (currentUser) checkAttendance();
        } else if (event === 'SIGNED_OUT') {
            currentUser = null;
            currentProfile = null;
            updateUI();
            // 로그아웃 시 참여 UI 초기화
            updateAttendUI();
        }
    });
}

function updateUI() {
    const navLoginLink = document.getElementById('nav-login-link');
    const navSignupLink = document.getElementById('nav-signup-link');
    const navUserMenu = document.getElementById('nav-user-menu');
    const navUserName = document.getElementById('nav-user-name');
    const navAdminLink = document.getElementById('nav-admin-link');
    const authContainer = document.getElementById('auth-container');
    const profileContainer = document.getElementById('profile-container');
    const membershipTitle = document.getElementById('membership-title');

    const heroSignupBtn = document.getElementById('hero-signup-btn');

    if (currentUser) {
        // 로그인 상태
        navLoginLink.style.display = 'none';
        navSignupLink.style.display = 'none';
        navUserMenu.style.display = 'block';
        navUserName.textContent = (currentProfile && currentProfile.name) || currentUser.email;
        if (heroSignupBtn) heroSignupBtn.style.display = 'none';

        // 관리자 링크
        navAdminLink.style.display = (currentProfile && currentProfile.role === 'admin') ? 'block' : 'none';

        // 멤버십 섹션 → 프로필 현황 모드
        authContainer.style.display = 'none';
        profileContainer.style.display = 'block';
        membershipTitle.textContent = '프로필 현황';

        // 프로필 데이터 채우기
        if (currentProfile) fillProfileAll();
    } else {
        // 비로그인 상태
        navLoginLink.style.display = 'block';
        navSignupLink.style.display = 'block';
        navUserMenu.style.display = 'none';
        navAdminLink.style.display = 'none';
        if (heroSignupBtn) heroSignupBtn.style.display = '';

        authContainer.style.display = 'block';
        profileContainer.style.display = 'none';
    }

    // 동적 참여 버튼 UI 업데이트
    updateAttendUI();
    // 문의 폼에 기본 정보 채우기
    fillInquiryForm();
}

function fillProfileAll() {
    if (!currentProfile) return;
    // 읽기전용 정보
    document.getElementById('pv-name').textContent = currentProfile.name || '-';
    document.getElementById('pv-phone').textContent = currentProfile.phone || '-';
    document.getElementById('pv-email').textContent = (currentUser && currentUser.email) || '-';
    // 숨겨진 input (저장용)
    document.getElementById('p-name').value = currentProfile.name || '';
    document.getElementById('p-contact').value = currentProfile.phone || '';
    // 수정 가능 필드
    document.getElementById('p-current-job').value = currentProfile.current_job || '';
    document.getElementById('p-type').value = currentProfile.member_type || '';
    document.getElementById('p-message').value = currentProfile.message || '';
    // 관심분야 체크
    const checkboxes = document.querySelectorAll('#profile-interests input[type="checkbox"]');
    const interests = currentProfile.interests || [];
    checkboxes.forEach(cb => {
        cb.checked = interests.includes(cb.value);
    });
}

// ========== Helper: escape HTML ==========
function escapeHtml(str) {
    const div = document.createElement('div');
    div.textContent = str || '';
    return div.innerHTML;
}

// ========== Helper: format event date ==========
function formatEventDate(dateStr, dayLabel) {
    // dateStr: "2025-02-06" 형태
    const parts = dateStr.split('-');
    const month = parseInt(parts[1]);
    const day = parseInt(parts[2]);
    // 영어→한글 요일 매핑
    var engToKor = { 'SUN': '일요일', 'MON': '월요일', 'TUE': '화요일', 'WED': '수요일', 'THU': '목요일', 'FRI': '금요일', 'SAT': '토요일' };
    var dayEng;
    if (dayLabel) {
        dayEng = dayLabel;
    } else {
        var year = parseInt(parts[0]);
        var date = new Date(year, month - 1, day);
        var dayNames = ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'];
        dayEng = dayNames[date.getDay()];
    }
    var dayName = engToKor[dayEng] || dayEng;
    return { display: `${month}.${day}`, dayName };
}

// ========== Helper: format event time ==========
function formatEventTime(timeStr) {
    if (!timeStr) return '';
    const [h, m] = timeStr.split(':');
    const hour = parseInt(h);
    const period = hour < 12 ? '오전' : '저녁';
    const displayHour = hour > 12 ? hour - 12 : hour;
    return `${period} ${displayHour}:${m}`;
}

// ========== Render events from DB ==========
async function renderScheduleEvents() {
    const container = document.getElementById('events-container');
    try {
        const events = await DB.getEvents();

        if (events.length === 0) {
            container.innerHTML = '<div class="admin-empty" style="text-align:center; padding:3rem 1rem; color:var(--text-muted);">예정된 모임이 없습니다.</div>';
            return;
        }

        // 첫 번째 활성 이벤트를 참여 신청용으로 설정
        currentEventId = events[0].id;

        container.innerHTML = events.map((ev, idx) => {
            const { display, dayName } = formatEventDate(ev.event_date, ev.day_label);
            const timeDisplay = formatEventTime(ev.event_time);
            const isFirst = idx === 0;

            // 상세 정보 항목들
            let detailItems = '';
            if (ev.location) {
                detailItems += `
                    <div class="schedule-info-item">
                        <div class="schedule-info-icon">📍</div>
                        <div class="schedule-info-text">
                            <div class="info-label">장소</div>
                            <div class="info-value">${escapeHtml(ev.location)}</div>
                        </div>
                    </div>`;
            }
            if (ev.address) {
                detailItems += `
                    <div class="schedule-info-item">
                        <div class="schedule-info-icon">🗺️</div>
                        <div class="schedule-info-text">
                            <div class="info-label">주소</div>
                            <div class="info-value">${escapeHtml(ev.address)}</div>
                        </div>
                    </div>`;
            }
            if (ev.map_url) {
                detailItems += `
                    <div class="schedule-info-item">
                        <div class="schedule-info-icon">🔗</div>
                        <div class="schedule-info-text">
                            <div class="info-label">네이버 지도</div>
                            <div class="info-value"><a href="${escapeHtml(ev.map_url)}" target="_blank" rel="noopener noreferrer">지도에서 보기 →</a></div>
                        </div>
                    </div>`;
            }
            if (ev.provision) {
                detailItems += `
                    <div class="schedule-info-item">
                        <div class="schedule-info-icon">🥪</div>
                        <div class="schedule-info-text">
                            <div class="info-label">제공</div>
                            <div class="info-value">${escapeHtml(ev.provision)}</div>
                        </div>
                    </div>`;
            }
            if (ev.description) {
                detailItems += `
                    <div class="schedule-info-item">
                        <div class="schedule-info-icon">📋</div>
                        <div class="schedule-info-text">
                            <div class="info-label">상세 내용</div>
                            <div class="info-value">${escapeHtml(ev.description)}</div>
                        </div>
                    </div>`;
            }

            if (ev.youtube_url) {
                detailItems += `
                    <div class="schedule-info-item">
                        <div class="schedule-info-icon">🎬</div>
                        <div class="schedule-info-text">
                            <div class="info-label">온라인 참여</div>
                            <div class="info-value"><a href="${escapeHtml(ev.youtube_url)}" target="_blank" rel="noopener noreferrer">유튜브 라이브 참여하기 →</a></div>
                        </div>
                    </div>`;
            }

            // 참여 버튼 (schedule-highlight 안)
            const attendBtns = isFirst ? `
                <div class="attend-btn-wrap" id="attend-section">
                    <button type="button" class="btn-primary" id="attend-guest-btn">멤버 가입 후 참여 신청하기 →</button>
                    <div id="attend-logged-in" style="display:none;">
                        <button type="button" class="btn-primary" id="attend-toggle-btn">이 모임 참여 신청하기 →</button>
                        <div class="form-status" id="attend-status" style="margin-top:0.5rem;"></div>
                    </div>
                    <div id="attend-already" style="display:none;" class="attend-already-msg">
                        ✅ 이 모임에 참여 신청 완료!
                        <button type="button" class="btn-secondary btn-small" id="cancel-attend-btn">참여 취소</button>
                    </div>
                </div>` : '';
            const attendForm = '';

            return `
                <div class="schedule-card reveal">
                    <div class="schedule-highlight">
                        <div class="schedule-date-label" style="font-size:1.82rem;font-weight:700;">✨ ${escapeHtml(ev.title)}</div>
                        <div class="schedule-date">
                            <span class="month">${display}</span> <span class="day-name">${dayName}</span>
                        </div>
                        ${timeDisplay ? `<div class="schedule-time">${timeDisplay}</div>` : ''}
                        ${attendBtns}
                    </div>
                    ${detailItems ? `
                    <div class="schedule-details">
                        <h3>${escapeHtml(ev.title)} 상세 정보</h3>
                        <div class="schedule-info">
                            ${detailItems}
                        </div>
                    </div>` : ''}
                    ${attendForm}
                </div>`;
        }).join('');

        // 동적으로 생성된 버튼에 이벤트 리스너 재연결
        rebindAttendButtons();

        // 로그인 상태에 따라 참여 버튼 UI 업데이트
        updateAttendUI();

        // 이미 참여했는지 확인
        if (currentUser) {
            checkAttendance();
        }

    } catch (e) {
        console.error('renderScheduleEvents error:', e);
        container.innerHTML = '<div style="text-align:center; padding:3rem 1rem; color:var(--accent-pink);">모임 로드 오류: ' + (e.message || e) + '</div>';
    }
}

// ========== Rebind attend buttons after dynamic render ==========
function rebindAttendButtons() {
    // 비회원용 버튼: 가입 모달 열기
    const guestBtn = document.getElementById('attend-guest-btn');
    if (guestBtn) {
        guestBtn.addEventListener('click', (e) => {
            e.preventDefault();
            openModal('signup', { showNotice: true });
        });
    }

    // 참여 신청 버튼: 클릭 시 메모 팝업 열기
    const toggleBtn = document.getElementById('attend-toggle-btn');
    if (toggleBtn) {
        toggleBtn.addEventListener('click', () => {
            if (!currentUser) {
                openModal('login');
                return;
            }
            const popup = document.getElementById('attend-popup');
            if (popup) {
                document.getElementById('attend-memo').value = '';
                document.getElementById('attend-popup-status').textContent = '';
                popup.classList.add('open');
            }
        });
    }

    // 참여 취소 버튼
    const cancelBtn = document.getElementById('cancel-attend-btn');
    if (cancelBtn) {
        cancelBtn.addEventListener('click', async () => {
            if (!currentUser || !currentEventId) return;
            if (!confirm('정말로 참여를 취소하시겠습니까?')) return;
            try {
                await DB.cancelAttendance(currentUser.id, currentEventId);
                alert('참여가 취소되었습니다.');
                const attendAlready = document.getElementById('attend-already');
                const attendToggle = document.getElementById('attend-toggle-btn');
                if (attendAlready) attendAlready.style.display = 'none';
                if (attendToggle) {
                    attendToggle.style.display = '';
                    attendToggle.textContent = '이 모임 참여 신청하기 →';
                }
            } catch (err) {
                alert('취소 중 오류가 발생했습니다: ' + (err.message || err));
            }
        });
    }
}

// ========== Update attend button visibility based on login state ==========
function updateAttendUI() {
    const attendLoggedIn = document.getElementById('attend-logged-in');
    const attendGuestBtn = document.getElementById('attend-guest-btn');

    if (!attendLoggedIn && !attendGuestBtn) return;

    if (currentUser) {
        if (attendLoggedIn) attendLoggedIn.style.display = 'block';
        if (attendGuestBtn) attendGuestBtn.style.display = 'none';
    } else {
        if (attendLoggedIn) attendLoggedIn.style.display = 'none';
        if (attendGuestBtn) attendGuestBtn.style.display = '';
    }
}

// ========== Render locations from DB ==========
async function renderLocations() {
    const container = document.getElementById('locations-container');
    if (!container) return;

    try {
        const locations = await DB.getLocations();

        if (locations.length === 0) {
            container.innerHTML = '<div style="grid-column:1/-1; text-align:center; padding:2rem; color:var(--text-muted);">등록된 장소가 없습니다.</div>';
            return;
        }

        const icons = { primary: '🟡', secondary: '🏠' };
        const badges = { primary: '메인', secondary: '보조' };

        container.innerHTML = locations.map(loc => {
            const icon = icons[loc.loc_type] || '📍';
            const badge = badges[loc.loc_type] || '장소';
            const isPrimary = loc.loc_type === 'primary';

            const mapLink = loc.map_url
                ? `<a href="${escapeHtml(loc.map_url)}" target="_blank" rel="noopener noreferrer" class="loc-link">네이버 지도 →</a>`
                : '';

            const noteStyle = isPrimary
                ? ''
                : ' style="background: rgba(168, 85, 247, 0.05);"';

            const noteHtml = loc.note
                ? `<div class="loc-note"${noteStyle}>${escapeHtml(loc.note)}</div>`
                : '';

            const addressHtml = loc.address
                ? `<p class="loc-address">${escapeHtml(loc.address)}</p>`
                : '';

            return `
                <div class="location-card ${escapeHtml(loc.loc_type)}">
                    <span class="loc-badge">${escapeHtml(badge)}</span>
                    <h3>${icon} ${escapeHtml(loc.name)}</h3>
                    ${addressHtml}
                    ${mapLink}
                    ${noteHtml}
                </div>`;
        }).join('');

    } catch (e) {
        console.error('renderLocations error:', e);
        container.innerHTML = '<div style="grid-column:1/-1; text-align:center; padding:2rem; color:var(--accent-pink);">장소 로드 오류: ' + (e.message || e) + '</div>';
    }
}

// ========== Member Count ==========
async function loadMemberCount() {
    var el = document.getElementById('member-count-display');
    if (!el) return;
    try {
        var count = await DB.getMemberCount();
        var roundedCount = Math.floor(count / 10) * 10;
        el.textContent = roundedCount + '+';
    } catch (e) {
        console.error('loadMemberCount error:', e);
        el.textContent = '-';
    }
}

// ========== Speak Up Preview ==========
async function renderSpeakUpPreview() {
    var container = document.getElementById('speakup-preview-container');
    if (!container) return;

    try {
        var posts = await DB.getPosts(3, 0);

        if (posts.length === 0) {
            container.innerHTML = '<div class="speakup-empty" style="grid-column:1/-1;text-align:center;padding:2rem;color:var(--text-muted);">아직 게시글이 없습니다.</div>';
            return;
        }

        var html = '';
        var count = Math.min(posts.length, 2);
        for (var i = 0; i < count; i++) {
            var post = posts[i];
            var authorName = (post.profiles && post.profiles.name) || '알 수 없음';

            var reactionData, commentCount;
            try {
                var results = await Promise.all([
                    DB.getReactionCounts(post.id),
                    DB.getCommentCount(post.id)
                ]);
                reactionData = results[0];
                commentCount = results[1];
            } catch (e) {
                reactionData = { likes: 0, dislikes: 0 };
                commentCount = 0;
            }

            html += '<a href="speakup.html" class="speakup-preview-card">' +
                '<div class="spc-header">' +
                    '<span class="spc-author">' + escapeHtml(authorName) + '</span>' +
                    '<span class="spc-time">' + timeAgoShort(post.created_at) + '</span>' +
                '</div>' +
                '<h4 class="spc-title">' + escapeHtml(post.title) + '</h4>' +
                '<div class="spc-stats">' +
                    '<span>👍 ' + reactionData.likes + '</span>' +
                    '<span>👎 ' + reactionData.dislikes + '</span>' +
                    '<span>💬 ' + commentCount + '</span>' +
                '</div>' +
            '</a>';
        }
        container.innerHTML = html;
    } catch (e) {
        console.error('renderSpeakUpPreview error:', e);
        container.innerHTML = '<div style="grid-column:1/-1;text-align:center;padding:2rem;color:var(--accent-pink);">게시글 로드 오류</div>';
    }
}

function timeAgoShort(dateStr) {
    var now = new Date();
    var date = new Date(dateStr);
    var diff = Math.floor((now - date) / 1000);
    if (diff < 60) return '방금 전';
    if (diff < 3600) return Math.floor(diff / 60) + '분 전';
    if (diff < 86400) return Math.floor(diff / 3600) + '시간 전';
    if (diff < 604800) return Math.floor(diff / 86400) + '일 전';
    var m = date.getMonth() + 1;
    var d = date.getDate();
    return m + '.' + d;
}

// ========== Load first active event (legacy wrapper) ==========
async function loadFirstEvent() {
    await renderScheduleEvents();
    await renderLocations();
}

async function checkAttendance() {
    if (!currentUser || !currentEventId) return;
    const toggleBtn = document.getElementById('attend-toggle-btn');
    const attendForm = document.getElementById('attend-form');
    const attendAlready = document.getElementById('attend-already');

    // 기본: 신청 가능 상태로 초기화
    if (toggleBtn) toggleBtn.style.display = '';
    if (attendForm) attendForm.style.display = 'none';
    if (attendAlready) attendAlready.style.display = 'none';

    try {
        const attendance = await DB.getMyAttendance(currentUser.id);
        const existing = attendance.find(a => a.event_id == currentEventId);

        if (existing) {
            if (toggleBtn) toggleBtn.style.display = 'none';
            if (attendForm) attendForm.style.display = 'none';
            if (attendAlready) attendAlready.style.display = 'block';
        }
    } catch (e) {
        console.error('checkAttendance error:', e);
    }
}

// ========== Auth Tabs (removed — signup/login are separate views now) ==========

// ========== Sign Up ==========
document.getElementById('signup-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const statusEl = document.getElementById('signup-status');
    const btn = e.target.querySelector('.form-submit');

    const email = document.getElementById('s-email').value.trim();
    const password = document.getElementById('s-password').value;
    const name = document.getElementById('s-name').value.trim();
    const phone = sanitizePhone(document.getElementById('s-contact').value);
    const currentJob = document.getElementById('s-current-job').value.trim();
    const memberType = document.getElementById('s-type').value;
    const message = document.getElementById('s-message').value.trim();
    const checked = e.target.querySelectorAll('input[name="interests"]:checked');
    const interests = Array.from(checked).map(c => c.value);

    // 비밀번호 유효성: 영문+숫자만, 6자 이상
    if (password.length < 6) {
        setStatus(statusEl, '비밀번호는 6자 이상이어야 합니다.', 'error');
        return;
    }
    if (!/^[a-zA-Z0-9]+$/.test(password)) {
        setStatus(statusEl, '비밀번호는 영문과 숫자만 사용할 수 있습니다.', 'error');
        return;
    }

    if (typeof Auth === 'undefined') {
        setStatus(statusEl, '시스템 로딩 중입니다. 잠시 후 다시 시도해주세요.', 'error');
        return;
    }

    setStatus(statusEl, '가입 처리 중...', 'loading');
    btn.disabled = true;

    try {
        const signUpData = await Auth.signUp(email, password, { name, phone });

        // 트리거가 profiles row를 생성할 시간 확보
        await new Promise(r => setTimeout(r, 2000));

        // signUp 반환값 또는 세션에서 유저 ID 가져오기
        let userId = null;
        if (signUpData && signUpData.user) {
            userId = signUpData.user.id;
        } else {
            const session = await Auth.getSession();
            if (session && session.user) userId = session.user.id;
        }

        if (userId) {
            // 프로필 업데이트 (최대 5회 재시도)
            for (let i = 0; i < 5; i++) {
                try {
                    await DB.updateProfile(userId, {
                        name,
                        phone,
                        email,
                        current_job: currentJob,
                        interests,
                        member_type: memberType,
                        message
                    });
                    break;
                } catch (retryErr) {
                    console.warn('Profile update retry', i + 1, retryErr.message);
                    await new Promise(r => setTimeout(r, 1500));
                }
            }
        }

        setStatus(statusEl, '가입이 완료되었습니다! 환영합니다.', 'success');
        e.target.reset();
        setTimeout(closeModal, 1500);
    } catch (err) {
        console.error('Signup error:', err);
        const errMsg = err.message || String(err);
        let msg = '가입 중 오류가 발생했습니다.';
        if (errMsg.includes('already registered') || errMsg.includes('already been registered')) {
            msg = '이미 등록된 이메일입니다. 로그인을 시도해주세요.';
        } else if (errMsg.includes('password')) {
            msg = '비밀번호는 6자 이상이어야 합니다.';
        } else if (errMsg.includes('email')) {
            msg = '이메일 형식을 확인해주세요.';
        } else if (errMsg.includes('rate') || errMsg.includes('limit')) {
            msg = '요청이 너무 많습니다. 잠시 후 다시 시도해주세요.';
        } else {
            msg = '가입 오류: ' + errMsg;
        }
        setStatus(statusEl, msg, 'error');
    } finally {
        btn.disabled = false;
    }
});

// ========== Login ==========
document.getElementById('login-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const statusEl = document.getElementById('login-status');
    const btn = e.target.querySelector('.form-submit');

    const email = document.getElementById('l-email').value.trim();
    const password = document.getElementById('l-password').value;

    if (typeof Auth === 'undefined') {
        setStatus(statusEl, '시스템 로딩 중입니다. 잠시 후 다시 시도해주세요.', 'error');
        return;
    }

    setStatus(statusEl, '로그인 중...', 'loading');
    btn.disabled = true;

    try {
        await Auth.signIn(email, password);
        setStatus(statusEl, '로그인 성공!', 'success');
        e.target.reset();
        setTimeout(closeModal, 1000);
    } catch (err) {
        setStatus(statusEl, '이메일 또는 비밀번호가 올바르지 않습니다.', 'error');
    } finally {
        btn.disabled = false;
    }
});

// ========== Forgot Password ==========
document.getElementById('forgot-password-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const statusEl = document.getElementById('forgot-status');
    const btn = e.target.querySelector('.form-submit');
    const email = document.getElementById('fp-email').value.trim();

    if (!email) {
        setStatus(statusEl, '이메일을 입력해주세요.', 'error');
        return;
    }

    setStatus(statusEl, '메일 발송 중...', 'loading');
    btn.disabled = true;

    try {
        await Auth.sendPasswordResetEmail(email);
        setStatus(statusEl, '비밀번호 재설정 링크가 이메일로 발송되었습니다. 메일함을 확인해주세요.', 'success');
    } catch (err) {
        const errMsg = err.message || '메일 발송 중 오류가 발생했습니다.';
        if (errMsg.includes('rate') || errMsg.includes('limit')) {
            setStatus(statusEl, '요청이 너무 많습니다. 잠시 후 다시 시도해주세요.', 'error');
        } else {
            setStatus(statusEl, '메일 발송 중 오류: ' + errMsg, 'error');
        }
    } finally {
        btn.disabled = false;
    }
});

// ========== Reset Password (from email link) ==========
document.getElementById('reset-password-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const statusEl = document.getElementById('reset-status');
    const btn = e.target.querySelector('.form-submit');

    const newPw = document.getElementById('rp-new').value;
    const confirmPw = document.getElementById('rp-confirm').value;

    if (newPw.length < 6) {
        setStatus(statusEl, '비밀번호는 6자 이상이어야 합니다.', 'error');
        return;
    }
    if (!/^[a-zA-Z0-9]+$/.test(newPw)) {
        setStatus(statusEl, '비밀번호는 영문과 숫자만 사용할 수 있습니다.', 'error');
        return;
    }
    if (newPw !== confirmPw) {
        setStatus(statusEl, '비밀번호가 일치하지 않습니다.', 'error');
        return;
    }

    setStatus(statusEl, '변경 중...', 'loading');
    btn.disabled = true;

    try {
        console.log('비밀번호 재설정 시도 - currentUser:', currentUser);
        console.log('세션 확인:', await Auth.getSession());
        await Auth.updatePassword(newPw);
        setStatus(statusEl, '비밀번호가 변경되었습니다. 잠시 후 자동으로 닫힙니다.', 'success');
        e.target.reset();
        setTimeout(closeModal, 2000);
    } catch (err) {
        console.error('Reset password error:', err);
        console.error('Full error object:', JSON.stringify(err, null, 2));
        const msg = err.message || '비밀번호 변경 중 오류가 발생했습니다.';
        setStatus(statusEl, msg, 'error');
    } finally {
        btn.disabled = false;
    }
});

// ========== Profile Update ==========
document.getElementById('profile-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const statusEl = document.getElementById('profile-status');
    const btn = e.target.querySelector('.form-submit');

    const name = document.getElementById('p-name').value.trim();
    const phone = sanitizePhone(document.getElementById('p-contact').value);
    const currentJob = document.getElementById('p-current-job').value.trim();
    const memberType = document.getElementById('p-type').value;
    const message = document.getElementById('p-message').value.trim();
    const checked = e.target.querySelectorAll('input[name="interests"]:checked');
    const interests = Array.from(checked).map(c => c.value);

    setStatus(statusEl, '저장 중...', 'loading');
    btn.disabled = true;

    try {
        currentProfile = await DB.updateProfile(currentUser.id, {
            name,
            phone,
            current_job: currentJob,
            interests,
            member_type: memberType,
            message
        });
        document.getElementById('nav-user-name').textContent = name;
        fillProfileAll();
        setStatus(statusEl, '프로필이 저장되었습니다.', 'success');

        // 2초 후 모달 자동 닫기
        setTimeout(() => {
            if (authModal) {
                authModal.classList.remove('open');
                document.body.style.overflow = '';
            }
        }, 2000);
    } catch (err) {
        setStatus(statusEl, '저장 중 오류가 발생했습니다.', 'error');
    } finally {
        btn.disabled = false;
    }
});

// ========== Password Change ==========
document.getElementById('password-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const statusEl = document.getElementById('password-status');
    const btn = e.target.querySelector('.form-submit');

    const newPw = document.getElementById('pw-new').value;
    const confirmPw = document.getElementById('pw-confirm').value;

    if (newPw.length < 6) {
        setStatus(statusEl, '비밀번호는 6자 이상이어야 합니다.', 'error');
        return;
    }
    if (!/^[a-zA-Z0-9]+$/.test(newPw)) {
        setStatus(statusEl, '비밀번호는 영문과 숫자만 사용할 수 있습니다.', 'error');
        return;
    }
    if (newPw !== confirmPw) {
        setStatus(statusEl, '비밀번호가 일치하지 않습니다.', 'error');
        return;
    }

    setStatus(statusEl, '변경 중...', 'loading');
    btn.disabled = true;

    try {
        const { error } = await _supabase.auth.updateUser({ password: newPw });
        if (error) throw error;
        setStatus(statusEl, '비밀번호가 변경되었습니다.', 'success');
        e.target.reset();

        // 2초 후 모달 자동 닫기
        setTimeout(() => {
            if (authModal) {
                authModal.classList.remove('open');
                document.body.style.overflow = '';
            }
        }, 2000);
    } catch (err) {
        const msg = err.message || '비밀번호 변경 중 오류가 발생했습니다.';
        setStatus(statusEl, msg, 'error');
    } finally {
        btn.disabled = false;
    }
});

// ========== Inquiry Modal ==========
const inquiryModal = document.getElementById('inquiry-modal');

document.getElementById('nav-inquiry-link').addEventListener('click', (e) => {
    e.preventDefault();
    fillInquiryForm();
    inquiryModal.classList.add('open');
    document.body.style.overflow = 'hidden';
});

document.getElementById('inquiry-close-btn').addEventListener('click', () => {
    inquiryModal.classList.remove('open');
    document.body.style.overflow = '';
});

inquiryModal.addEventListener('click', (e) => {
    if (e.target === inquiryModal) {
        inquiryModal.classList.remove('open');
        document.body.style.overflow = '';
    }
});

function fillInquiryForm() {
    if (currentUser && currentProfile) {
        document.getElementById('inq-name').value = currentProfile.name || '';
        document.getElementById('inq-phone').value = currentProfile.phone || '';
        document.getElementById('inq-email').value = currentUser.email || '';
    }
}

document.getElementById('inquiry-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const statusEl = document.getElementById('inquiry-status');
    const btn = e.target.querySelector('.form-submit');

    const name = document.getElementById('inq-name').value.trim();
    const phone = sanitizePhone(document.getElementById('inq-phone').value);
    const email = document.getElementById('inq-email').value.trim();
    const subject = document.getElementById('inq-subject').value.trim();
    const message = document.getElementById('inq-message').value.trim();

    if (!name || !subject || !message) {
        setStatus(statusEl, '이름, 제목, 내용은 필수입니다.', 'error');
        return;
    }

    setStatus(statusEl, '문의 접수 중...', 'loading');
    btn.disabled = true;

    try {
        await DB.createInquiry({
            name, phone, email, subject, message,
            user_id: currentUser ? currentUser.id : null
        });
        setStatus(statusEl, '문의가 접수되었습니다. 감사합니다!', 'success');
        document.getElementById('inq-subject').value = '';
        document.getElementById('inq-message').value = '';

        // 2초 후 모달 자동 닫기
        setTimeout(() => {
            if (inquiryModal) {
                inquiryModal.classList.remove('open');
                document.body.style.overflow = '';
            }
        }, 2000);
    } catch (err) {
        setStatus(statusEl, '문의 접수 중 오류가 발생했습니다.', 'error');
    } finally {
        btn.disabled = false;
    }
});

// ========== Attend Submit & Cancel — rebindAttendButtons()에서 동적 처리 ==========

// ========== Nav User Dropdown ==========
const navUserBtn = document.getElementById('nav-user-btn');
const navDropdown = document.getElementById('nav-dropdown');

if (navUserBtn) {
    navUserBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        navDropdown.classList.toggle('show');
    });
}

document.addEventListener('click', () => {
    if (navDropdown) navDropdown.classList.remove('show');
});

// Dropdown actions
document.querySelectorAll('.dropdown-item').forEach(item => {
    item.addEventListener('click', async (e) => {
        const action = e.target.dataset.action;
        if (action === 'logout') {
            e.preventDefault();
            try {
                await Auth.signOut();
            } catch (err) {
                // 무시
            }
        }
        navDropdown.classList.remove('show');
    });
});

// ========== Init ==========
let startAttempts = 0;
function startApp() {
    startAttempts++;
    var dbReady = typeof DB !== 'undefined';
    var authReady = typeof Auth !== 'undefined';
    var sbReady = typeof window.supabase !== 'undefined';

    if ((!dbReady || !authReady) && startAttempts <= 10) {
        console.warn('startApp attempt ' + startAttempts + ' — DB:' + dbReady + ' Auth:' + authReady + ' supabase:' + sbReady);
        var ec = document.getElementById('events-container');
        if (ec) ec.innerHTML = '<div style="text-align:center;padding:2rem;color:var(--text-muted);">로딩 중... (시도 ' + startAttempts + '/10)</div>';
        setTimeout(startApp, 500);
        return;
    }

    if (!dbReady || !authReady) {
        // 10번 시도 후에도 실패 — 에러 표시
        var ec = document.getElementById('events-container');
        var lc = document.getElementById('locations-container');
        var msg = 'Supabase 로드 실패 (DB:' + dbReady + ', Auth:' + authReady + '). 페이지를 새로고침 해주세요.';
        if (ec) ec.innerHTML = '<div style="text-align:center;padding:2rem;color:var(--accent-pink);">' + msg + '</div>';
        if (lc) lc.innerHTML = '<div style="grid-column:1/-1;text-align:center;padding:2rem;color:var(--accent-pink);">' + msg + '</div>';
        return;
    }

    // 정상 실행: 카드 렌더링 완료 후 인증 초기화 (참여 UI가 DOM에 있어야 함)
    renderScheduleEvents()
        .then(function() { return initAuth(); })
        .catch(function(e) { console.error('Init error:', e); });
    renderLocations().catch(function(e) { console.error('Locations render error:', e); });
    loadMemberCount();
    renderSpeakUpPreview().catch(function(e) {
        console.error('SpeakUp preview error:', e);
        var c = document.getElementById('speakup-preview-container');
        if (c) c.innerHTML = '<div style="text-align:center;padding:2rem;color:var(--accent-pink);">미리보기 로드 오류: ' + (e.message || e) + '</div>';
    });
}

// ========== 참여 신청 메모 팝업 ==========
(function() {
    const popup = document.getElementById('attend-popup');
    if (!popup) return;
    const closeBtn = document.getElementById('attend-popup-close');
    const cancelBtn = document.getElementById('attend-popup-cancel');
    const form = document.getElementById('attend-popup-form');

    function closePopup() {
        popup.classList.remove('open');
    }

    closeBtn.addEventListener('click', closePopup);
    cancelBtn.addEventListener('click', closePopup);
    popup.addEventListener('click', (e) => {
        if (e.target === popup) closePopup();
    });

    form.addEventListener('submit', async function(e) {
        e.preventDefault();
        var statusEl = document.getElementById('attend-popup-status');
        var btn = form.querySelector('.form-submit');

        if (!currentUser || !currentEventId) {
            setStatus(statusEl, '로그인 또는 모임 정보를 확인해주세요.', 'error');
            return;
        }

        var memo = document.getElementById('attend-memo').value.trim();
        btn.disabled = true;
        setStatus(statusEl, '신청 처리 중...', 'loading');

        try {
            await DB.attendEvent(currentUser.id, currentEventId, memo);
            setStatus(statusEl, '참여 신청 완료!', 'success');
            setTimeout(function() { closePopup(); checkAttendance(); }, 800);
        } catch (err) {
            var errMsg = (err && err.message) || String(err);
            if (errMsg.includes('duplicate') || errMsg.includes('23505') || errMsg.includes('already')) {
                setStatus(statusEl, '이미 참여 신청한 모임입니다.', 'error');
                setTimeout(function() { closePopup(); checkAttendance(); }, 1000);
            } else {
                setStatus(statusEl, '신청 오류: ' + errMsg, 'error');
                console.error('참여 신청 오류:', err);
            }
        } finally {
            btn.disabled = false;
        }
    });
})();

// DOM 로드 완료 후 실행
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', startApp);
} else {
    startApp();
}
