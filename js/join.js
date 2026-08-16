// ========== Join Page — 프로필 만들기 ==========
let joinState = {
    provisionalId: null,
    email: null,
    name: null
};

// Step 1: 이메일 확인
document.getElementById('btn-check-email').addEventListener('click', checkProvisionalEmail);
document.getElementById('join-email').addEventListener('keypress', function(e) {
    if (e.key === 'Enter') checkProvisionalEmail();
});

async function checkProvisionalEmail() {
    const email = document.getElementById('join-email').value.trim().toLowerCase();
    const errorBox = document.getElementById('email-error');

    if (!email) {
        errorBox.textContent = '이메일을 입력하세요';
        errorBox.style.display = 'block';
        return;
    }

    const btn = document.getElementById('btn-check-email');
    btn.disabled = true;
    btn.innerHTML = '<span class="loading"></span> 확인 중...';

    try {
        // 1. 예비 멤버 확인
        const provisional = await DB.getProvisionalMember(email);
        if (!provisional) {
            errorBox.textContent = '⚠️ 입력하신 이메일이 예비 멤버 목록에 없습니다.\n운영진에게 문의해주세요: support@waat.community';
            errorBox.style.display = 'block';
            btn.disabled = false;
            btn.textContent = '확인하기';
            return;
        }

        // 2. 기존 정식 멤버인지 확인
        const existing = await DB.getExistingMember(email);
        if (existing) {
            errorBox.textContent = '이미 가입한 멤버입니다. 로그인 해주세요.';
            errorBox.style.display = 'block';
            btn.disabled = false;
            btn.textContent = '확인하기';
            return;
        }

        // 3. 성공: 예비 멤버 정보 저장 및 Step 2로 이동
        joinState.provisionalId = provisional.id;
        joinState.email = email;
        joinState.name = provisional.name;

        document.getElementById('step-1-email').style.display = 'none';
        document.getElementById('step-2-form').style.display = 'block';
        document.getElementById('display-name').textContent = provisional.name;

        // 진행 표시 업데이트
        document.querySelector('.progress-step:nth-child(1)').classList.add('completed');
        document.querySelector('.progress-step:nth-child(2)').classList.add('active');

        errorBox.style.display = 'none';
        btn.disabled = false;
        btn.textContent = '확인하기';

    } catch (e) {
        console.error('checkProvisionalEmail error:', e);
        errorBox.textContent = '오류가 발생했습니다: ' + (e.message || '다시 시도해주세요');
        errorBox.style.display = 'block';
        btn.disabled = false;
        btn.textContent = '확인하기';
    }
}

// Step 2: 스킵 버튼
document.getElementById('btn-skip').addEventListener('click', function() {
    completeWithMessage('👍 좋습니다!', `
        <p>${joinState.name}님, WAAT에 오신 것을 환영합니다! 🎉</p>
        <p>지금부터 모임 신청과 게시판 활동이 가능합니다.</p>
        <p style="margin-top: 1rem; font-size: 0.9em;">프로필을 추가하고 싶으면 언제든 [프로필 수정]에서 해주세요.</p>
    `, false); // 정보 저장 안 함
});

// Step 2: 저장 버튼
document.getElementById('btn-save').addEventListener('click', saveProfile);

async function saveProfile() {
    const phone = document.getElementById('join-phone').value.trim();
    const bio = document.getElementById('join-bio').value.trim();
    const interests = document.getElementById('join-interests').value.trim();

    const btn = document.getElementById('btn-save');
    btn.disabled = true;
    btn.innerHTML = '<span class="loading"></span> 저장 중...';

    try {
        // 1. 예비 멤버 제출 완료 마킹
        await DB.markProvisionalSubmitted(joinState.provisionalId, {
            phone,
            bio,
            interests
        });

        // 2. 성공 메시지 표시
        if (phone && bio && interests) {
            completeWithMessage('✅ 프로필이 완성되었습니다!', `
                <p>${joinState.name}님, 환영합니다! 🎉</p>
                <p>프로필이 저장되었습니다.</p>
                <p style="margin-top: 1rem; font-size: 0.9em;">이제 모임에 신청하고 게시판에서 활동할 수 있습니다.</p>
            `, true);
        } else {
            completeWithMessage('✅ 저장되었습니다!', `
                <p>${joinState.name}님, 감사합니다! 👋</p>
                <p>프로필이 저장되었습니다.</p>
                <p style="margin-top: 1rem; font-size: 0.9em;">
                    💡 프로필을 추가하고 싶으면 나중에 [프로필 수정]에서 해주세요.<br>
                    지금부터 모임 신청과 게시판 활동이 가능합니다!
                </p>
            `, true);
        }

    } catch (e) {
        console.error('saveProfile error:', e);
        alert('저장 중 오류가 발생했습니다: ' + (e.message || '다시 시도해주세요'));
        btn.disabled = false;
        btn.innerHTML = '✓ 저장하기';
    }
}

function completeWithMessage(title, message, saved) {
    // Step 2 숨기기, Step 3 표시
    document.getElementById('step-2-form').style.display = 'none';
    document.getElementById('step-3-complete').style.display = 'block';

    // 진행 표시 업데이트
    document.querySelector('.progress-step:nth-child(2)').classList.add(saved ? 'completed' : '');
    document.querySelector('.progress-step:nth-child(3)').classList.add('active');

    // 메시지 표시
    document.getElementById('complete-message').innerHTML = `
        <strong>${title}</strong>
        ${message}
    `;

    // 홈 이동 버튼
    document.getElementById('btn-go-home').addEventListener('click', function() {
        window.location.href = 'index.html';
    });
}

// ========== DB 함수 ==========
// (이 함수들은 db.js에 추가됨)
