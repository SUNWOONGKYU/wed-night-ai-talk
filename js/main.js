// ========== State ==========
let currentUser = null;
let currentProfile = null;
let currentEventId = null; // 첫 번째 활성 이벤트 ID (참여 신청용)
let currentEventSlotId = null;  // 선택된 event_slots.id (정수, DB FK)
let currentSlots = [];     // 현재 이벤트의 슬롯 배열 (DB getSlotCounts 결과)
let pendingAttend = null;  // 비로그인 → 로그인 모달 → 로그인 후 자동 신청용: { eventId, eventSlotId }

// 슬롯 헬퍼 — currentSlots 배열에서 id로 조회
function getSlotById(id) {
    if (id == null) return null;
    var n = Number(id);
    return currentSlots.find(function(s) { return Number(s.id) === n; }) || null;
}
// 슬롯 표시 라벨 (이모지 + 라벨, 시간 포함)
function slotDisplayName(slot) {
    if (!slot) return '슬롯';
    var emoji = slot.slot_emoji || '';
    var label = slot.slot_label || '';
    return (emoji + ' ' + label).trim();
}
function slotTimeStr(slot) {
    if (!slot || !slot.slot_time) return '';
    // slot_time/slot_end_time: 'HH:MM:SS' 또는 'HH:MM' → 'HH:MM ~ HH:MM'
    var start = String(slot.slot_time).slice(0, 5);
    if (slot.slot_end_time) {
        var end = String(slot.slot_end_time).slice(0, 5);
        return start + ' ~ ' + end;
    }
    return start;
}

// 제공사항/참가비 본문을 줄바꿈 + 이모지 prefix로 포맷
function formatProvision(text) {
    if (!text) return '';
    var lines = [];
    // 줄바꿈이 이미 있으면 그대로 사용
    if (text.indexOf('\n') >= 0) {
        lines = text.split(/\n+/).map(function(s) { return s.trim(); }).filter(Boolean);
    } else {
        // 단일 라인 → "참가비"/"입금계좌"/"*" 기준으로 분리
        var t = text;
        var parts = [];
        // "* ..." 부가설명 분리
        var noteIdx = t.indexOf('*');
        var noteStr = '';
        if (noteIdx > 0) {
            noteStr = t.slice(noteIdx + 1).trim();
            t = t.slice(0, noteIdx).trim();
        }
        // 입금계좌 분리
        var bankIdx = t.indexOf('입금계좌');
        var bankStr = '';
        if (bankIdx > 0) {
            bankStr = t.slice(bankIdx).trim().replace(/^[(\s]+/, '').replace(/[)\s]+$/, '');
            t = t.slice(0, bankIdx).trim().replace(/[(\s]+$/, '');
        }
        // 참가비 기준 분리
        var feeIdx = t.indexOf('참가비');
        if (feeIdx > 0) {
            parts.push(t.slice(0, feeIdx).trim());
            parts.push(t.slice(feeIdx).trim());
        } else {
            parts.push(t);
        }
        if (bankStr) parts.push(bankStr);
        if (noteStr) parts.push('* ' + noteStr);
        lines = parts.filter(Boolean);
    }
    // 라인별 이모지 prefix
    return lines.map(function(line) {
        var prefixed = line;
        var cls = 'provision-line';
        if (/^제공사항/.test(line)) {
            prefixed = line;
        } else if (/^참가비/.test(line)) {
            prefixed = line;
        } else if (/^입금계좌/.test(line)) {
            prefixed = '※ ' + line;
            cls += ' provision-note';
        } else if (/^\*/.test(line)) {
            prefixed = '※ ' + line.replace(/^\*\s*/, '');
            cls += ' provision-note';
        }
        return '<div class="' + cls + '">' + escapeHtml(prefixed) + '</div>';
    }).join('');
}

// ========== Scroll Reveal & Nav scroll are handled by js/animations.js (GSAP) ==========

// ========== Mobile menu toggle ==========
(function() {
    var menuBtn = document.querySelector('.mobile-menu-btn');
    var navLinks = document.querySelector('.nav-links');
    if (!menuBtn || !navLinks) return;
    menuBtn.addEventListener('click', function(e) {
        e.stopPropagation();
        navLinks.classList.toggle('show');
    });
    // 외부 클릭으로 닫기
    document.addEventListener('click', function(e) {
        if (!navLinks.classList.contains('show')) return;
        if (!e.target.closest('.nav-inner')) navLinks.classList.remove('show');
    });
    // ESC 키로 닫기
    document.addEventListener('keydown', function(e) {
        if (e.key === 'Escape') navLinks.classList.remove('show');
    });
})();

// ========== Modal Focus Trap (공통 유틸) ==========
const FOCUSABLE_SEL = 'a[href], button:not([disabled]), textarea:not([disabled]), input:not([disabled]):not([type="hidden"]), select:not([disabled]), [tabindex]:not([tabindex="-1"])';
const _modalState = new WeakMap();

function trapFocus(modalEl) {
    if (!modalEl) return;
    var lastFocused = document.activeElement;
    function handler(e) {
        if (e.key !== 'Tab') return;
        var nodes = Array.prototype.slice.call(modalEl.querySelectorAll(FOCUSABLE_SEL))
            .filter(function(n) { return n.offsetParent !== null; });
        if (!nodes.length) return;
        var first = nodes[0], last = nodes[nodes.length - 1];
        if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
        else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
    }
    modalEl.addEventListener('keydown', handler);
    _modalState.set(modalEl, { lastFocused: lastFocused, handler: handler });
    // 첫 포커스: close 버튼이 아닌 첫 입력 요소 우선
    setTimeout(function() {
        var nodes = Array.prototype.slice.call(modalEl.querySelectorAll(FOCUSABLE_SEL))
            .filter(function(n) { return n.offsetParent !== null && !n.classList.contains('modal-close'); });
        if (nodes.length) nodes[0].focus();
        else {
            var closer = modalEl.querySelector('.modal-close');
            if (closer) closer.focus();
        }
    }, 50);
}

function releaseFocus(modalEl) {
    if (!modalEl) return;
    var st = _modalState.get(modalEl);
    if (!st) return;
    modalEl.removeEventListener('keydown', st.handler);
    if (st.lastFocused && typeof st.lastFocused.focus === 'function') {
        try { st.lastFocused.focus(); } catch (e) {}
    }
    _modalState.delete(modalEl);
}

// ========== Modal ==========
const authModal = document.getElementById('auth-modal');
const modalCloseBtn = document.getElementById('modal-close-btn');

function openModal(tab, options) {
    authModal.classList.add('open');
    authModal.setAttribute('aria-hidden', 'false');
    document.body.style.overflow = 'hidden';
    trapFocus(authModal);

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
    authModal.setAttribute('aria-hidden', 'true');
    document.body.style.overflow = '';
    releaseFocus(authModal);
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

// ========== Google OAuth 로그인 ==========
function bindGoogleAuth(btnId) {
    var btn = document.getElementById(btnId);
    if (!btn) {
        console.warn('[Google OAuth] 버튼을 찾을 수 없음:', btnId);
        return;
    }
    btn.addEventListener('click', async function() {
        if (typeof Auth === 'undefined' || !Auth.signInWithGoogle) {
            alert('Auth 모듈이 로드되지 않았습니다. 페이지를 새로고침해주세요.');
            return;
        }
        try {
            btn.disabled = true;
            btn.textContent = '구글 로그인 페이지로 이동...';
            await Auth.signInWithGoogle();
            // signInWithOAuth는 정상이면 브라우저가 자동 리다이렉트됨
            // 3초 후에도 페이지가 그대로면 리다이렉트 실패로 판단
            setTimeout(function() {
                if (document.body) {
                    btn.disabled = false;
                    btn.textContent = btnId === 'login-google-btn' ? 'Google로 로그인' : 'Google로 계속하기';
                    console.warn('[Google OAuth] 3초 후에도 페이지가 그대로임 — 팝업 차단 or 브라우저 보안 정책 의심');
                }
            }, 3000);
        } catch (err) {
            console.error('[Google OAuth] 실패:', err);
            alert('구글 로그인 실패: ' + (err.message || err));
            btn.disabled = false;
            btn.textContent = btnId === 'login-google-btn' ? 'Google로 로그인' : 'Google로 계속하기';
        }
    });
}
bindGoogleAuth('signup-google-btn');
bindGoogleAuth('login-google-btn');

// ========== Guest Attend (비회원 참여 신청) ==========
(function() {
    var modal = document.getElementById('guest-attend-modal');
    if (!modal) return;

    function close() {
        modal.classList.remove('open');
        modal.setAttribute('aria-hidden', 'true');
        document.body.style.overflow = '';
        releaseFocus(modal);
    }

    var closeBtn = document.getElementById('guest-attend-close-btn');
    if (closeBtn) closeBtn.addEventListener('click', close);
    modal.addEventListener('click', function(e) { if (e.target === modal) close(); });
    document.addEventListener('keydown', function(e) {
        if (e.key === 'Escape' && modal.classList.contains('open')) close();
    });

    var form = document.getElementById('guest-attend-form');
    if (!form) return;
    form.addEventListener('submit', async function(e) {
        e.preventDefault();
        var statusEl = document.getElementById('ga-status');
        var btn = form.querySelector('.form-submit');

        var name = document.getElementById('ga-name').value.trim();
        var email = document.getElementById('ga-email').value.trim();
        var phoneRaw = document.getElementById('ga-phone').value.trim();
        var memo = document.getElementById('ga-memo').value.trim();

        // 검증 1: 빈 필드
        if (!name || !email || !phoneRaw) {
            setStatus(statusEl, '이름·이메일·핸드폰 번호를 모두 입력해주세요.', 'error');
            return;
        }

        // 검증 2: 이메일 형식
        var emailRe = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRe.test(email)) {
            setStatus(statusEl, '이메일 형식이 올바르지 않습니다.', 'error');
            return;
        }

        // 검증 3: 핸드폰 번호 (010/011 + 10~11자리)
        var phone = phoneRaw.replace(/[^0-9]/g, '');
        if (!/^(010\d{8}|01[16789]\d{7})$/.test(phone)) {
            setStatus(statusEl, '핸드폰 번호를 정확히 입력해주세요. (예: [masked-phone])', 'error');
            return;
        }

        // 이벤트/슬롯 정보
        var eventId = (typeof currentEventId !== 'undefined' && currentEventId) ? currentEventId : null;
        var eventSlotId = (typeof currentEventSlotId !== 'undefined' && currentEventSlotId) ? currentEventSlotId : null;
        if (!eventSlotId) {
            setStatus(statusEl, '먼저 모임 카드의 타임 슬롯을 선택해주세요.', 'error');
            return;
        }
        var slot = getSlotById(eventSlotId);
        var slotLabel = slot ? (' / ' + slotDisplayName(slot)) : '';

        setStatus(statusEl, '신청 처리 중...', 'loading');
        btn.disabled = true;
        try {
            await DB.createGuestAttendance({
                name: name,
                phone: phone,
                email: email,
                message: memo,
                event_id: eventId,
                event_slot_id: eventSlotId
            });
            setStatus(statusEl, '신청이 접수되었습니다.', 'success');
            setTimeout(close, 2000);
        } catch (err) {
            console.error('Guest attend error:', err);
            var msg = err.message || String(err);
            if (/이미 같은/i.test(msg)) {
                setStatus(statusEl, '이미 같은 핸드폰 번호로 신청되어 있습니다.', 'error');
            } else {
                setStatus(statusEl, '신청 실패: ' + msg, 'error');
            }
            btn.disabled = false;
        }
    });
})();

// ========== Toast helper ==========
function showToast(msg, type) {
    var t = document.getElementById('app-toast');
    if (!t) {
        t = document.createElement('div');
        t.id = 'app-toast';
        t.className = 'app-toast';
        document.body.appendChild(t);
    }
    t.textContent = msg;
    t.className = 'app-toast show' + (type ? ' ' + type : '');
    clearTimeout(showToast._tid);
    showToast._tid = setTimeout(function() { t.className = 'app-toast'; }, 3200);
}

// ========== Phone Required Modal ==========
// Google OAuth 등으로 가입한 회원이 phone 없이 모임 신청을 시도할 때,
// 핸드폰 번호 입력을 강제하기 위한 모달 헬퍼.
function isValidPhone(v) {
    return /^(010\d{8}|01[16789]\d{7})$/.test(v || '');
}
function showPhoneRequiredModal(onSaved) {
    var m = document.getElementById('phone-required-modal');
    if (!m) { if (onSaved) onSaved(false); return; }
    var inp = document.getElementById('prq-phone');
    var status = document.getElementById('prq-status');
    var form = document.getElementById('phone-required-form');
    var closeBtn = document.getElementById('prq-close-btn');
    if (status) { status.textContent = ''; status.className = 'form-status'; }
    if (inp) { inp.value = ''; }

    function close(saved) {
        m.classList.remove('open');
        document.body.style.overflow = '';
        form.onsubmit = null;
        closeBtn.onclick = null;
        m.onclick = null;
        if (onSaved) onSaved(!!saved);
    }
    closeBtn.onclick = function() { close(false); };
    m.onclick = function(e) { if (e.target === m) close(false); };
    form.onsubmit = async function(e) {
        e.preventDefault();
        var phone = sanitizePhone(inp.value);
        if (!isValidPhone(phone)) {
            status.textContent = '핸드폰 번호 형식이 올바르지 않습니다. (예: [masked-phone])';
            status.className = 'form-status error';
            return;
        }
        status.textContent = '저장 중...';
        status.className = 'form-status loading';
        try {
            currentProfile = await DB.updateProfile(currentUser.id, { phone: phone });
            close(true);
        } catch (err) {
            status.textContent = '저장 실패: ' + (err.message || err);
            status.className = 'form-status error';
        }
    };
    m.classList.add('open');
    document.body.style.overflow = 'hidden';
    setTimeout(function() { if (inp) inp.focus(); }, 100);
}

// ========== 회원 슬롯 신청 ==========
async function memberAttendSlot(eventId, eventSlotId, slot) {
    if (!eventId || !eventSlotId || !currentUser) return;
    // 핸드폰 번호 가드 — phone 없거나 형식 불일치 시 모달로 강제 입력
    var phone = currentProfile && currentProfile.phone;
    if (!isValidPhone(phone)) {
        showPhoneRequiredModal(function(saved) {
            if (saved) memberAttendSlot(eventId, eventSlotId, slot);
        });
        return;
    }
    try {
        await DB.attendEvent(currentUser.id, eventId, '', eventSlotId);
        showToast('✅ ' + slotDisplayName(slot) + ' 신청 완료');
        if (typeof checkAttendance === 'function') checkAttendance();
        if (typeof renderScheduleEvents === 'function') await renderScheduleEvents();
    } catch (err) {
        var msg = err.message || String(err);
        if (/duplicate|unique/i.test(msg)) {
            showToast('이미 신청하셨습니다.');
        } else {
            console.error('Member attend error:', err);
            showToast('신청 실패: ' + msg, 'error');
        }
    }
}

// ========== 회원 슬롯 취소 ==========
async function memberCancelSlot(eventId, eventSlotId, slot) {
    if (!eventId || !eventSlotId || !currentUser) return;
    try {
        await DB.cancelAttendance(currentUser.id, eventId, eventSlotId);
        showToast('❎ ' + slotDisplayName(slot) + ' 신청 취소됨');
        if (typeof checkAttendance === 'function') checkAttendance();
        if (typeof renderScheduleEvents === 'function') await renderScheduleEvents();
    } catch (err) {
        console.error('Member cancel error:', err);
        showToast('취소 실패: ' + (err.message || err), 'error');
    }
}

// ========== Identity Choice Modal ==========
function showIdentityChoiceModal(slot) {
    var m = document.getElementById('identity-choice-modal');
    if (!m) return;
    var slotEl = document.getElementById('ic-selected-slot');
    if (slotEl && slot) {
        var emoji = escapeHtml(slot.slot_emoji || '');
        var label = escapeHtml(slot.slot_label || '');
        var t = escapeHtml(slotTimeStr(slot));
        slotEl.innerHTML = emoji + ' <strong>' + label + '</strong>' + (t ? ' (' + t + ')' : '');
    }
    m.classList.add('open');
    m.setAttribute('aria-hidden', 'false');
    document.body.style.overflow = 'hidden';
    trapFocus(m);
}
function closeIdentityChoiceModal() {
    var m = document.getElementById('identity-choice-modal');
    if (m) {
        m.classList.remove('open');
        m.setAttribute('aria-hidden', 'true');
        document.body.style.overflow = '';
        releaseFocus(m);
    }
}
(function() {
    var m = document.getElementById('identity-choice-modal');
    if (!m) return;
    var closeBtn = document.getElementById('ic-close-btn');
    if (closeBtn) closeBtn.addEventListener('click', closeIdentityChoiceModal);
    m.addEventListener('click', function(e) { if (e.target === m) closeIdentityChoiceModal(); });

    var memberBtn = document.getElementById('ic-member-btn');
    if (memberBtn) memberBtn.addEventListener('click', function() {
        if (currentEventId && currentEventSlotId) {
            pendingAttend = { eventId: currentEventId, eventSlotId: currentEventSlotId };
        }
        closeIdentityChoiceModal();
        openModal('login');
    });

    var guestBtn = document.getElementById('ic-guest-btn');
    if (guestBtn) guestBtn.addEventListener('click', function() {
        closeIdentityChoiceModal();
        var slot = getSlotById(currentEventSlotId);
        var ga = document.getElementById('guest-attend-modal');
        if (!ga) return;
        var f = document.getElementById('guest-attend-form');
        if (f) f.reset();
        var s = document.getElementById('ga-status');
        if (s) { s.textContent = ''; s.className = 'form-status'; }
        var slotEl = document.getElementById('ga-selected-slot');
        if (slotEl && slot) {
            var emoji = escapeHtml(slot.slot_emoji || '');
            var label = escapeHtml(slot.slot_label || '');
            var t = escapeHtml(slotTimeStr(slot));
            slotEl.innerHTML = emoji + ' <strong>' + label + '</strong>' + (t ? ' (' + t + ')' : '');
        }
        ga.classList.add('open');
        ga.setAttribute('aria-hidden', 'false');
        document.body.style.overflow = 'hidden';
        trapFocus(ga);
    });
})();

// 로그인 후 pending slot 자동 신청
async function tryPendingSlotAttend() {
    if (!pendingAttend || !currentUser) return;
    var ev = pendingAttend.eventId;
    var sl = pendingAttend.eventSlotId;
    pendingAttend = null;
    var slot = getSlotById(sl);
    await memberAttendSlot(ev, sl, slot);
}

// ========== Phone number: strip non-digits ==========
function sanitizePhone(value) {
    return value.replace(/[^0-9]/g, '');
}
document.querySelectorAll('#s-contact, #inq-phone, #ga-phone').forEach(function(el) {
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
// 보안: 클라이언트가 직접 profile.role 을 'admin' 으로 쓰는 행위는 차단됨
// (DB 트리거/RLS WITH CHECK 가 role 컬럼 변경을 금지)
// 관리자 판별은 JWT 기반 is_admin() RPC + 클라이언트 ADMIN_EMAILS UX 가드로만 수행
async function syncAdminRole(user, profile) {
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
            // 비로그인 상태에서 슬롯 신청 시도 후 로그인했으면 자동 신청
            await tryPendingSlotAttend();
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
    var pvPhone = document.getElementById('pv-phone');
    if (pvPhone) pvPhone.textContent = currentProfile.phone || '-';
    document.getElementById('pv-email').textContent = (currentUser && currentUser.email) || '-';
    // 이름은 hidden, 핸드폰은 편집 가능 input
    document.getElementById('p-name').value = currentProfile.name || '';
    document.getElementById('p-contact').value = currentProfile.phone || '';
    // 핸드폰 누락 권유 배너 (차단은 없음, 안내만)
    var banner = document.getElementById('phone-missing-banner');
    if (banner) {
        var phone = (currentProfile.phone || '').replace(/[^0-9]/g, '');
        banner.style.display = (phone.length < 10) ? 'block' : 'none';
    }
    // 수정 가능 필드
    document.getElementById('p-current-job').value = currentProfile.current_job || '';
    document.getElementById('p-message').value = currentProfile.message || '';
    // 관심 분야 — textarea (배열이면 join, 문자열이면 그대로)
    var interestsEl = document.getElementById('p-interests');
    if (interestsEl) {
        var raw = currentProfile.interests;
        if (Array.isArray(raw)) {
            interestsEl.value = raw.join(', ');
        } else {
            interestsEl.value = raw || '';
        }
    }
}

// ========== Helper: escape HTML ==========
function escapeHtml(str) {
    const div = document.createElement('div');
    div.textContent = str || '';
    return div.innerHTML;
}

// 신청자 이름 표시용 길이 제한: 한글 1자 이상이면 4자, 그 외(순영문 등) 10자
// 정책: 혼용("John김")이면 한글 기준 우선(4자 컷). 풀네임은 title 툴팁에 보존.
// Array.from으로 코드포인트 단위 분리하여 이모지/한글 안전 처리.
function truncDisplayName(name) {
    if (!name) return '';
    const hasHangul = /[가-힣]/.test(name);
    const limit = hasHangul ? 4 : 10;
    const chars = Array.from(name);
    if (chars.length <= limit) return name;
    return chars.slice(0, limit).join('') + '…';
}

// ========== Helper: format event date ==========
function formatEventDate(dateStr, dayLabel) {
    // dateStr: "2025-02-06" 형태
    const parts = dateStr.split('-');
    const year = parseInt(parts[0]);
    const month = parseInt(parts[1]);
    const day = parseInt(parts[2]);
    // 영어→한글 요일 매핑
    var engToKor = { 'SUN': '일요일', 'MON': '월요일', 'TUE': '화요일', 'WED': '수요일', 'THU': '목요일', 'FRI': '금요일', 'SAT': '토요일' };
    var dayEng;
    if (dayLabel) {
        dayEng = dayLabel;
    } else {
        var date = new Date(year, month - 1, day);
        var dayNames = ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'];
        dayEng = dayNames[date.getDay()];
    }
    var dayName = engToKor[dayEng] || dayEng;
    // 풀 날짜: "2026년 5월 13일 (수요일)"
    return {
        display: `${year}년 ${month}월 ${day}일`,
        dayName,
        compact: `${month}.${day}`
    };
}

// ========== Helper: format event time (3 타임 지원) ==========
function formatSingleTime(timeStr) {
    if (!timeStr) return '';
    var s = String(timeStr).trim();
    // 이미 한글 표기면 그대로
    if (/오전|오후|저녁/.test(s)) return s;
    var m = s.match(/^(\d{1,2}):?(\d{0,2})/);
    if (!m) return s;
    var hour = parseInt(m[1]);
    var min = m[2] || '00';
    var period = hour < 12 ? '오전' : '오후';
    var displayHour = hour > 12 ? hour - 12 : (hour === 0 ? 12 : hour);
    return min === '00' ? `${period} ${displayHour}시` : `${period} ${displayHour}:${min}`;
}
function formatEventTimes(eventTimes, eventTime) {
    // 우선 event_times (콤마 또는 슬래시 구분), 없으면 단일 event_time
    var raw = eventTimes && String(eventTimes).trim() ? eventTimes : (eventTime || '');
    if (!raw) return '';
    var parts = String(raw).split(/[,/]|\s\/\s/).map(function(t) { return t.trim(); }).filter(Boolean);
    if (parts.length === 0) return '';
    return parts.map(formatSingleTime).join(' · ');
}
// 호환용 (기존 호출자)
function formatEventTime(timeStr) {
    return formatSingleTime(timeStr);
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

        // 회차 번호 매핑 — 비활성 포함 전체 이벤트 기준 (event_date ASC 순서)
        // 1회 비활성화돼도 2회는 그대로 "제2회"로 표시되도록 함
        const meetingNoMap = {};
        try {
            const allEvents = await DB.getAllEventsForNumbering();
            allEvents.forEach((ev, i) => { meetingNoMap[ev.id] = i + 1; });
        } catch (e) {
            console.warn('getAllEventsForNumbering failed, falling back to active idx:', e);
        }

        // 슬롯 정보 + 인원수 (이벤트별로 동적 로드) + 본인이 신청한 슬롯 조회
        const slotsByEvent = {};
        const myAttendedSlotIds = new Set();
        const attendeesByEvent = {};
        try {
            const slotResults = await Promise.all(events.map(ev => DB.getSlotCounts(ev.id).catch(() => [])));
            events.forEach((ev, i) => { slotsByEvent[ev.id] = slotResults[i] || []; });
        } catch (e) { console.warn('getSlotCounts failed:', e); }
        // 슬롯별 신청자 명단 (회원·게스트 통합, name만)
        try {
            const attResults = await Promise.all(events.map(ev => DB.getSlotAttendees(ev.id).catch(() => [])));
            events.forEach((ev, i) => { attendeesByEvent[ev.id] = attResults[i] || []; });
        } catch (e) { console.warn('getSlotAttendees failed:', e); }
        // currentSlots: 전체 이벤트 슬롯 합침 (getSlotById가 모든 이벤트에서 찾을 수 있게)
        currentSlots = events.flatMap(ev => (slotsByEvent[ev.id] || []).map(s => ({ ...s, event_id: ev.id })));
        if (currentUser) {
            try {
                const myAtt = await DB.getMyAttendance(currentUser.id);
                myAtt.filter(a => a.event_slot_id)
                     .forEach(a => myAttendedSlotIds.add(Number(a.event_slot_id)));
            } catch (e) { console.warn('getMyAttendance failed:', e); }
        }

        container.innerHTML = events.map((ev, idx) => {
            const { display, dayName } = formatEventDate(ev.event_date, ev.day_label);
            const timeDisplay = formatEventTimes(ev.event_times, ev.event_time);
            const slots = slotsByEvent[ev.id] || [];

            // 상세 정보 항목들 — 장소는 이름 하나만 (Location 섹션 카드로 연결)
            let detailItems = '';
            if (ev.location) {
                const locSlug = encodeURIComponent(ev.location);
                detailItems += `
                    <div class="schedule-info-item">
                        <div class="schedule-info-icon">📍</div>
                        <div class="schedule-info-text">
                            <div class="info-label">장소</div>
                            <div class="info-value">
                                <a href="#location" class="location-jump-link" data-location-name="${locSlug}">${escapeHtml(ev.location)} →</a>
                                <span class="info-rooms">(햇살: 2번 회의실 · 달빛: 5번 회의실)</span>
                            </div>
                        </div>
                    </div>`;
            }
            // 모임 정원 표시는 신청하기 슬롯 카드에 이미 (n/n명) 형태로 나오므로 중복 제거
            // (제거됨 — 슬롯 카드에서 확인 가능)
            if (ev.description) {
                detailItems += `
                    <div class="schedule-info-item">
                        <div class="schedule-info-icon">📋</div>
                        <div class="schedule-info-text">
                            <div class="info-label">모임 내용</div>
                            <div class="info-value description-value">${escapeHtml(ev.description).replace(/\n/g, '<br>')}</div>
                        </div>
                    </div>`;
            }
            if (ev.provision) {
                detailItems += `
                    <div class="schedule-info-item">
                        <div class="schedule-info-icon">🎁</div>
                        <div class="schedule-info-text">
                            <div class="info-label">제공사항 및 참가비</div>
                            <div class="info-value provision-value">${formatProvision(ev.provision)}</div>
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

            // 정원 — 슬롯 안내문 문구에만 사용
            const capacity = Number(ev.capacity) || 20;

            // 슬롯별 신청자 명단 그룹핑
            const attendees = attendeesByEvent[ev.id] || [];
            const attendeesBySlot = {};
            attendees.forEach(a => {
                const sid = Number(a.event_slot_id);
                if (!attendeesBySlot[sid]) attendeesBySlot[sid] = [];
                attendeesBySlot[sid].push(a);
            });

            // "내 신청 현황" 박스 — 로그인 사용자 한정
            let myStatusHtml = '';
            if (currentUser) {
                const mySlotsInEvent = (slots || []).filter(s => myAttendedSlotIds.has(Number(s.id)));
                if (mySlotsInEvent.length > 0) {
                    const slotInfo = mySlotsInEvent.map(s => {
                        const sid = Number(s.id);
                        const list = attendeesBySlot[sid] || [];
                        // 서버에서 auth.uid() 비교한 is_me 플래그 사용 (동명이인 안전)
                        const myIdx = list.findIndex(a => a.is_me === true);
                        const total = list.length;
                        // is_me 매칭 실패 시 순번을 추측하지 않음 — "?" 표기로 안전 폴백
                        const orderStr = myIdx >= 0 ? (myIdx + 1) + '/' + total + '번째' : total + '명 중';
                        return `<span class="my-status-slot-tag">${escapeHtml(s.slot_emoji || '')} ${escapeHtml(s.slot_label || '')} — ${orderStr}</span>`;
                    }).join(' ');
                    myStatusHtml = `
                        <div class="my-attend-status attended">
                            <div class="my-attend-status-label">✓ 신청 완료</div>
                            <div class="my-attend-status-value">${slotInfo}</div>
                            <a href="profile.html" class="my-attend-status-link">내 신청 내역 보기 →</a>
                        </div>`;
                } else {
                    myStatusHtml = `
                        <div class="my-attend-status not-attended">
                            <div class="my-attend-status-label">📌 아직 신청 안 함</div>
                            <div class="my-attend-status-value">아래 시간대 중 원하는 것을 선택해 신청해주세요.</div>
                        </div>`;
                }
            }

            // 타임 슬롯 카드 (이벤트별, DB의 event_slots 동적 렌더)
            const slotsHtml = (slots && slots.length) ? `
                ${myStatusHtml}
                <div class="waat-slots">
                    ${slots.map(s => {
                        const sid = Number(s.id);
                        const count = Number(s.count || 0);
                        const slotCap = (s.capacity != null) ? Number(s.capacity) : capacity;
                        const attended = myAttendedSlotIds.has(sid);
                        const isFull = !attended && count >= slotCap;
                        let btnClass, btnText, btnDisabled;
                        if (attended) {
                            btnClass = 'waat-slot-btn slot-attended';
                            btnText = '✓ 신청됨 — 취소';
                            btnDisabled = '';
                        } else if (isFull) {
                            btnClass = 'waat-slot-btn slot-full';
                            btnText = '마감';
                            btnDisabled = 'disabled';
                        } else {
                            btnClass = 'btn-primary waat-slot-btn';
                            btnText = '신청하기';
                            btnDisabled = '';
                        }
                        const emoji = escapeHtml(s.slot_emoji || '');
                        const label = escapeHtml(s.slot_label || '');
                        const tStr = slotTimeStr(s);
                        const cardStateClass = attended ? ' is-attended' : (isFull ? ' is-full' : '');
                        const countClass = isFull ? 'slot-count slot-count-full' : 'slot-count';

                        // 슬롯별 신청자 명단 (회원·게스트 통합) — 본인 매칭은 서버 is_me 플래그
                        const slotAttendees = attendeesBySlot[sid] || [];
                        const attendeesHtml = slotAttendees.length ? `
                            <div class="slot-attendees">
                                <div class="slot-attendees-label">신청자 ${slotAttendees.length}명</div>
                                <div class="slot-attendees-list">
                                    ${slotAttendees.map(a => {
                                        const isMe = a.is_me === true;
                                        const tagCls = 'attendee-tag' + (isMe ? ' is-me' : '');
                                        const display = truncDisplayName(a.name);
                                        return `<span class="${tagCls}" title="${escapeHtml(a.name)}">${escapeHtml(display)}${isMe ? ' (나)' : ''}</span>`;
                                    }).join('')}
                                </div>
                            </div>` : '<div class="slot-attendees-empty">아직 신청자가 없어요. 첫 번째 신청자가 되어주세요!</div>';

                        return `
                        <div class="waat-slot-card${cardStateClass}" data-event-slot-id="${sid}">
                            <div class="waat-slot-emoji">${emoji}</div>
                            <div class="waat-slot-name">${label} <span class="${countClass}">(${count}/${slotCap}명)</span>${isFull ? '<span class="slot-full-badge">마감</span>' : ''}</div>
                            <div class="waat-slot-time">${escapeHtml(tStr)}</div>
                            <button type="button" class="${btnClass}" data-event-slot-id="${sid}" data-attended="${attended ? '1' : '0'}" data-full="${isFull ? '1' : '0'}" ${btnDisabled}>${btnText}</button>
                            ${attendeesHtml}
                        </div>`;
                    }).join('')}
                </div>
                <p class="waat-slots-note">원하는 시간대 하나를 골라서 신청하고 오시면 돼요. 슬롯마다 선착순 모집입니다.<br>사이사이 여유시간이 있어서, 자연스럽게 합류하거나 떠날 수 있습니다.</p>
            ` : '';

            // 모임 회차: 비활성 모임 포함 전체 순서 기준 (비활성화돼도 회차 번호 유지)
            const meetingNo = meetingNoMap[ev.id] || (idx + 1);

            return `
                <div class="schedule-card reveal">
                    <div class="schedule-highlight">
                        <div class="schedule-meeting-no">제${meetingNo}회 모임</div>
                        <div class="schedule-date-line">
                            <span class="month">${display}</span> <span class="day-name">${dayName}</span>
                        </div>
                        ${slotsHtml}
                    </div>
                    ${detailItems ? `
                    <div class="schedule-details">
                        <h3>모임 정보</h3>
                        <div class="schedule-info">
                            ${detailItems}
                        </div>
                    </div>` : ''}
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
        container.innerHTML = '<div style="text-align:center; padding:3rem 1rem; color:var(--accent-pink);">모임 로드 오류: ' + escapeHtml(String(e.message || e)) + '</div>';
    }
}

// ========== Schedule → Location 점프 링크 ==========
document.addEventListener('click', function(e) {
    const link = e.target.closest('.location-jump-link');
    if (!link) return;
    e.preventDefault();
    const targetName = link.getAttribute('data-location-name');
    const section = document.getElementById('location');
    if (!section) return;
    section.scrollIntoView({ behavior: 'smooth', block: 'start' });
    // 매칭 카드 강조 (300ms 뒤에 시작 — 스크롤 후)
    setTimeout(function() {
        document.querySelectorAll('.location-card').forEach(function(card) {
            if (card.getAttribute('data-location-name') === targetName) {
                card.classList.add('loc-highlight');
                setTimeout(function() { card.classList.remove('loc-highlight'); }, 2400);
            }
        });
    }, 350);
});

// ========== Rebind attend buttons after dynamic render ==========
function rebindAttendButtons() {
    // 타임 슬롯 버튼: 로그인 상태 + 신청 상태 분기
    document.querySelectorAll('.waat-slot-btn').forEach(btn => {
        btn.addEventListener('click', async (e) => {
            e.preventDefault();
            const eventSlotId = Number(btn.getAttribute('data-event-slot-id'));
            const attended = btn.getAttribute('data-attended') === '1';
            const isFull = btn.getAttribute('data-full') === '1';
            currentEventSlotId = eventSlotId;
            const slot = getSlotById(eventSlotId);
            const eventIdForSlot = (slot && slot.event_id) ? slot.event_id : currentEventId;

            if (attended && currentUser) {
                // 이미 신청 → 취소 확인
                const ok = confirm(slotDisplayName(slot) + ' 신청을 취소하시겠습니까?');
                if (!ok) return;
                await memberCancelSlot(eventIdForSlot, eventSlotId, slot);
                return;
            }

            if (isFull) {
                showToast(slotDisplayName(slot) + ' 마감되었습니다. 다른 시간대를 선택해주세요.', 'error');
                return;
            }

            if (currentUser) {
                // 회원: 즉시 신청
                await memberAttendSlot(eventIdForSlot, eventSlotId, slot);
            } else {
                // 비로그인: 신원 선택 모달
                showIdentityChoiceModal(slot);
            }
        });
    });

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
        const badges = { primary: 'Primary', secondary: 'Secondary' };

        container.innerHTML = locations.map(loc => {
            const icon = icons[loc.loc_type] || '📍';
            const badge = badges[loc.loc_type] || 'Location';

            const mapLink = loc.map_url
                ? `<a href="${escapeHtml(loc.map_url)}" target="_blank" rel="noopener noreferrer" class="loc-link">지도 →</a>`
                : '';

            const addressLine = loc.address
                ? `<p class="loc-address">${escapeHtml(loc.address)}${mapLink ? ' &nbsp;·&nbsp; ' + mapLink : ''}</p>`
                : (mapLink ? `<p class="loc-address">${mapLink}</p>` : '');

            return `
                <div class="location-card ${escapeHtml(loc.loc_type)}" data-location-name="${encodeURIComponent(loc.name)}">
                    <span class="loc-badge">${escapeHtml(badge)}</span>
                    <h3>${icon} ${escapeHtml(loc.name)}</h3>
                    ${addressLine}
                </div>`;
        }).join('');

    } catch (e) {
        console.error('renderLocations error:', e);
        container.innerHTML = '<div style="grid-column:1/-1; text-align:center; padding:2rem; color:var(--accent-pink);">장소 로드 오류: ' + escapeHtml(String(e.message || e)) + '</div>';
    }
}

// ========== Member Count ==========
async function loadMemberCount() {
    var el = document.getElementById('member-count-display');
    if (!el) return;
    try {
        var count = await DB.getMemberCount();
        el.textContent = count;
    } catch (e) {
        console.error('loadMemberCount error:', e);
        el.textContent = '-';
    }
}

async function loadFreeTalkCount() {
    var el = document.getElementById('freetalk-count-display');
    if (!el) return;
    try {
        var count = await DB.getPostCount();
        el.textContent = count;
    } catch (e) {
        console.error('loadFreeTalkCount error:', e);
        el.textContent = '-';
    }
}

// ========== Speak Up Preview ==========
async function renderSpeakUpPreview() {
    var container = document.getElementById('speakup-preview-container');
    if (!container) return;

    try {
        var posts = await DB.getPosts(5, 0);

        if (posts.length === 0) {
            container.innerHTML = '<div class="speakup-empty" style="grid-column:1/-1;text-align:center;padding:2rem;color:var(--text-muted);">아직 게시글이 없습니다.</div>';
            return;
        }

        var html = '';
        var count = Math.min(posts.length, 5);
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

            var cat = post.category || '일반';
            var catCls = ({
                '일반': 'cat-general', '자랑하기': 'cat-showcase', '공부하기': 'cat-study',
                '협력하기': 'cat-collab', '질문하기': 'cat-question', '요청하기': 'cat-request'
            })[cat] || 'cat-general';
            html += '<a href="speakup.html?post=' + encodeURIComponent(post.id) + '" class="speakup-preview-card">' +
                '<div class="spc-header">' +
                    '<span class="post-category-badge ' + catCls + '">' + escapeHtml(cat) + '</span>' +
                    '<span class="spc-author">' + escapeHtml(authorName) + '</span>' +
                    '<span class="spc-time">' + timeAgoShort(post.created_at) + '</span>' +
                '</div>' +
                '<h4 class="spc-title">' + escapeHtml(post.title) + '</h4>' +
                '<div class="spc-stats">' +
                    '<span>👍 ' + reactionData.likes + '</span>' +
                    '<span>👎 ' + reactionData.dislikes + '</span>' +
                    '<span>💬 ' + commentCount + '</span>' +
                    '<span>👁 ' + (post.view_count || 0) + '</span>' +
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
    const message = document.getElementById('s-message').value.trim();
    // 관심분야 — textarea 자유입력
    var interestsRaw = (document.getElementById('s-interests') || {}).value || '';
    const interests = interestsRaw.trim();

    // 전화번호 필수
    if (!phone || phone.length < 10) {
        setStatus(statusEl, '전화번호를 정확히 입력해주세요. (10~11자리 숫자)', 'error');
        return;
    }

    // 비밀번호 유효성: 공백 없이 8자 이상 (영문/숫자/특수문자 허용)
    if (password.length < 8) {
        setStatus(statusEl, '비밀번호는 8자 이상이어야 합니다.', 'error');
        return;
    }
    if (/\s/.test(password)) {
        setStatus(statusEl, '비밀번호에 공백을 사용할 수 없습니다.', 'error');
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
            msg = '비밀번호는 8자 이상이어야 합니다.';
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

    if (newPw.length < 8) {
        setStatus(statusEl, '비밀번호는 8자 이상이어야 합니다.', 'error');
        return;
    }
    if (/\s/.test(newPw)) {
        setStatus(statusEl, '비밀번호에 공백을 사용할 수 없습니다.', 'error');
        return;
    }
    if (newPw !== confirmPw) {
        setStatus(statusEl, '비밀번호가 일치하지 않습니다.', 'error');
        return;
    }

    setStatus(statusEl, '변경 중...', 'loading');
    btn.disabled = true;

    try {
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
    const message = document.getElementById('p-message').value.trim();
    // 관심분야 — textarea 자유입력
    var interestsRaw = (document.getElementById('p-interests') || {}).value || '';
    const interests = interestsRaw.trim();

    // 핸드폰 번호 — 빈 값은 허용 (Google 가입 직후 등), 입력했을 때만 형식 검증
    if (phone && !/^(010\d{8}|01[16789]\d{7})$/.test(phone)) {
        setStatus(statusEl, '핸드폰 번호 형식이 올바르지 않습니다. (예: [masked-phone])', 'error');
        return;
    }

    setStatus(statusEl, '저장 중...', 'loading');
    btn.disabled = true;

    try {
        currentProfile = await DB.updateProfile(currentUser.id, {
            name,
            phone,
            current_job: currentJob,
            interests,
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

    if (newPw.length < 8) {
        setStatus(statusEl, '비밀번호는 8자 이상이어야 합니다.', 'error');
        return;
    }
    if (/\s/.test(newPw)) {
        setStatus(statusEl, '비밀번호에 공백을 사용할 수 없습니다.', 'error');
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

var _inquiryTrigger = document.getElementById('footer-inquiry-link') || document.getElementById('nav-inquiry-link');
function _closeInquiryModal() {
    inquiryModal.classList.remove('open');
    inquiryModal.setAttribute('aria-hidden', 'true');
    document.body.style.overflow = '';
    releaseFocus(inquiryModal);
}
if (_inquiryTrigger) {
    _inquiryTrigger.addEventListener('click', (e) => {
        e.preventDefault();
        fillInquiryForm();
        inquiryModal.classList.add('open');
        inquiryModal.setAttribute('aria-hidden', 'false');
        document.body.style.overflow = 'hidden';
        trapFocus(inquiryModal);
    });
}

document.getElementById('inquiry-close-btn').addEventListener('click', _closeInquiryModal);

inquiryModal.addEventListener('click', (e) => {
    if (e.target === inquiryModal) _closeInquiryModal();
});
document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && inquiryModal.classList.contains('open')) _closeInquiryModal();
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
        console.error('[inquiry] createInquiry failed:', err);
        var msg = err && (err.message || err.error_description || err.hint) ? (err.message || err.error_description || err.hint) : '알 수 없는 오류';
        setStatus(statusEl, '문의 접수 실패: ' + msg, 'error');
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
        var msg = escapeHtml('Supabase 로드 실패 (DB:' + dbReady + ', Auth:' + authReady + '). 페이지를 새로고침 해주세요.');
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
    loadFreeTalkCount();
    renderSpeakUpPreview().catch(function(e) {
        console.error('SpeakUp preview error:', e);
        var c = document.getElementById('speakup-preview-container');
        if (c) c.innerHTML = '<div style="text-align:center;padding:2rem;color:var(--accent-pink);">미리보기 로드 오류: ' + escapeHtml(String(e.message || e)) + '</div>';
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
