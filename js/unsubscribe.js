// ========== 메일 수신거부 페이지 ==========
//
// 메일 하단 링크(https://waat.community/unsubscribe.html?t=<토큰>)로 들어온다.
// 토큰은 회원마다 다르고 Edge Function 이 메일을 만들 때만 붙인다 — 클라이언트가
// 조회할 수 있는 값이 아니다. 여기서는 URL 로 받은 값을 그대로 서버에 넘길 뿐이다.
//
// 서버 함수
//   unsubscribe_by_token(uuid)  → { ok, already, name, email_masked }
//   resubscribe_by_token(uuid)  → { ok, name, email_masked }
// 둘 다 토큰이 틀리면 이유를 말하지 않고 { ok:false, reason:'invalid' } 만 준다.
//
// ⚠️ 페이지를 열면 곧바로 수신거부가 처리된다(확인 버튼을 두지 않았다).
//    메일 클라이언트의 링크 프리페치로 의도치 않게 처리될 수 있어, 되돌리는
//    [다시 받을래요] 버튼을 같은 화면에 둔다.

(function () {
    'use strict';

    function show(id) {
        ['unsub-loading', 'unsub-done', 'unsub-resubbed', 'unsub-error'].forEach(function (k) {
            var el = document.getElementById(k);
            if (el) el.classList.toggle('unsub-hidden', k !== id);
        });
    }

    function getToken() {
        var t = new URLSearchParams(window.location.search).get('t') || '';
        t = t.trim();
        // UUID 형식이 아니면 서버에 물어볼 것도 없다.
        return /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/.test(t)
            ? t : null;
    }

    function showError(msg) {
        if (msg) {
            var el = document.getElementById('unsub-error-msg');
            if (el) el.textContent = msg;
        }
        show('unsub-error');
    }

    async function run() {
        var token = getToken();
        if (!token) { showError(); return; }

        if (typeof _supabase === 'undefined' || !_supabase) {
            showError('페이지를 불러오지 못했습니다. 잠시 후 다시 시도해 주세요.');
            return;
        }

        try {
            var res = await _supabase.rpc('unsubscribe_by_token', { p_token: token });
            if (res.error) throw res.error;

            var d = res.data || {};
            if (!d.ok) { showError(); return; }

            document.getElementById('unsub-email').textContent = d.email_masked || '';
            // 이미 수신거부 상태였으면 "처리했습니다"가 아니라 사실대로 알려준다.
            //
            // 단, 메일의 수신거부 링크를 눌러 들어온 경우(done=1)는 예외다.
            // 그 링크는 Edge Function 을 거치는데 거기서 이미 처리를 끝내고 오므로,
            // 여기서 다시 물으면 처음 누른 사람도 항상 '이미 상태'가 된다.
            var viaEndpoint = new URLSearchParams(window.location.search).get('done') === '1';
            if (d.already && !viaEndpoint) {
                document.getElementById('unsub-done-title').textContent = '이미 수신거부 상태입니다';
            }
            show('unsub-done');

            document.getElementById('unsub-resub-btn').onclick = async function () {
                var btn = this;
                btn.disabled = true;
                btn.textContent = '처리 중...';
                try {
                    var r2 = await _supabase.rpc('resubscribe_by_token', { p_token: token });
                    if (r2.error) throw r2.error;
                    if (!r2.data || !r2.data.ok) throw new Error('처리 실패');
                    document.getElementById('unsub-resub-email').textContent =
                        r2.data.email_masked || '';
                    show('unsub-resubbed');
                } catch (e) {
                    console.error('resubscribe error:', e);
                    btn.disabled = false;
                    btn.textContent = '다시 시도';
                }
            };
        } catch (e) {
            console.error('unsubscribe error:', e);
            showError('처리 중 문제가 생겼습니다. 메일에 회신해 주시면 직접 처리해 드리겠습니다.');
        }
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', run);
    } else {
        run();
    }
})();
