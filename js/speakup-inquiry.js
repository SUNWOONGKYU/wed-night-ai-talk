// speakup.html 문의하기 모달
//
// 2026-09-02 CSP 에서 script-src 의 'unsafe-inline' 을 제거하면서
// speakup.html 안에 있던 인라인 <script> 블록을 그대로 옮겼다. 동작 변경 없음.

// 문의하기 모달
        document.addEventListener('DOMContentLoaded', function() {
            const inquiryModal = document.getElementById('inquiry-modal');
            const inquiryCloseBtn = document.getElementById('inquiry-close-btn');
            const navInquiryLink = document.getElementById('nav-inquiry-link');

            if (navInquiryLink) {
                navInquiryLink.addEventListener('click', function(e) {
                    e.preventDefault();
                    if (inquiryModal) {
                        inquiryModal.classList.add('open');
                        document.body.style.overflow = 'hidden';
                    }
                });
            }

            if (inquiryCloseBtn) {
                inquiryCloseBtn.addEventListener('click', function() {
                    if (inquiryModal) {
                        inquiryModal.classList.remove('open');
                        document.body.style.overflow = '';
                    }
                });
            }

            if (inquiryModal) {
                inquiryModal.addEventListener('click', function(e) {
                    if (e.target === inquiryModal) {
                        inquiryModal.classList.remove('open');
                        document.body.style.overflow = '';
                    }
                });
            }

            // 문의하기 폼 제출
            const inquiryForm = document.getElementById('inquiry-form');
            if (inquiryForm) {
                inquiryForm.addEventListener('submit', async function(e) {
                    e.preventDefault();
                    const statusEl = document.getElementById('inquiry-status');
                    const btn = e.target.querySelector('.form-submit');

                    const name = document.getElementById('inq-name').value.trim();
                    const phone = document.getElementById('inq-phone').value.replace(/[^0-9]/g, '');
                    const email = document.getElementById('inq-email').value.trim();
                    const subject = document.getElementById('inq-subject').value.trim();
                    const message = document.getElementById('inq-message').value.trim();

                    if (!name || !subject || !message) {
                        statusEl.textContent = '이름, 제목, 내용은 필수입니다.';
                        statusEl.className = 'form-status error';
                        return;
                    }

                    statusEl.textContent = '문의 접수 중...';
                    statusEl.className = 'form-status loading';
                    btn.disabled = true;

                    try {
                        await DB.createInquiry({
                            name: name,
                            phone: phone,
                            email: email,
                            subject: subject,
                            message: message,
                            user_id: null
                        });
                        statusEl.textContent = '문의가 접수되었습니다. 감사합니다!';
                        statusEl.className = 'form-status success';
                        document.getElementById('inq-subject').value = '';
                        document.getElementById('inq-message').value = '';

                        // 2초 후 모달 자동 닫기
                        setTimeout(function() {
                            if (inquiryModal) {
                                inquiryModal.classList.remove('open');
                                document.body.style.overflow = '';
                            }
                        }, 2000);
                    } catch (err) {
                        statusEl.textContent = '문의 접수 중 오류가 발생했습니다.';
                        statusEl.className = 'form-status error';
                    } finally {
                        btn.disabled = false;
                    }
                });
            }
        });
