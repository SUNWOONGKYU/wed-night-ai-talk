// ========== Database Module — Supabase 함수 ==========
//
// ⚠️ 이 파일은 supabase-config.js 다음에 로드된다.
//    거기서 이미 `var DB = {...}` 로 전역 DB 를 선언하므로, 여기서 `const DB` 로 재선언하면
//    "SyntaxError: Identifier 'DB' has already been declared" 로 이 파일 전체가 로드에 실패한다.
//    (실제로 join.html·admin.html 에서 그렇게 죽어 있었다 — 예비멤버 조회가 통째로 미작동)
//    → 재선언하지 않고 기존 DB 에 메서드를 '추가'한다.
//
// ⚠️ 클라이언트 변수명도 supabase-config.js 와 맞춰야 한다.
//    전역 `supabase` 는 CDN 라이브러리 객체(createClient 를 가진)이지 클라이언트가 아니다.
//    실제 클라이언트는 `_supabase`.
//
// ⚠️ 이 파일 전체를 IIFE 로 감싼다.
//    전역 스코프에서 `const supabase = _supabase` 를 하면 CDN 이 이미 선언한 전역 `supabase` 와 충돌해
//    "SyntaxError: Identifier 'supabase' has already been declared" 로 파일 전체가 죽는다.
//    (2026-08-16 index.html 에 db.js 를 처음 넣었을 때 실제로 그렇게 죽어 예비멤버 안내가 미작동했다)
//    → 별칭은 IIFE 안에서만 쓰는 지역 변수로 둔다.
(function () {

var supabase = _supabase;

var _dbExtensions = {
    // ⚠️ provisional_members 테이블 접근 함수들은 2026-09-02 테이블과 함께 제거했다.
    //    (20260902010000_drop_provisional_members.sql — RLS 가 USING (true) 라 이름·이메일이
    //     익명 조회로 전부 열려 있었고, 정작 호출자는 이미 없었다)
    //    현행 예비멤버 판별·병합은 `profiles.notes` 의 '예비 멤버' 마크를 쓴다.
    //    → 아래 checkProvisionalMember() 와 claim_provisional_profile() RPC 가 그 경로다.

    // ⚠️ 2026-09-02 정리 — 아래 함수들을 제거했다. 전부 호출자가 없는 죽은 코드였고,
    //    profiles 컬럼 권한을 (id, name) 으로 줄이면서 동작하지도 않게 됐다.
    //      · getExistingMember — auth.admin.listUsers(). 브라우저 anon 키로는 애초에 불가.
    //      · createProfile     — 프로필은 가입 트리거(handle_new_user)가 만든다.
    //      · getProfile / updateProfile / getAllProfiles
    //                          — supabase-config.js 판본이 쓰이고 있었다(아래 병합 규칙 참고).
    //                            그쪽은 get_my_profile() / admin_list_profiles() RPC 로 옮겼다.
    //      · getExistingEmails — 회원 전원의 이메일을 통째로 읽는 함수. 호출자 없음.

    // 예비멤버 여부 확인 (이메일로) — 가입 모달이 '로그인 전'에 쓴다.
    //
    // ⚠️ 2026-09-02 이전에는 여기서 profiles 행을 통째로 select 했다. 그게 가능하려면
    //    anon 에게 profiles 컬럼이 열려 있어야 했고, 실제로 이름·이메일·전화번호가
    //    회원 298명분 전부 익명 조회되고 있었다.
    //    → 지금은 서버의 check_provisional_member() RPC 가 '예/아니오 + 이름'만 돌려준다.
    //       (전화번호는 반환하지 않는다 — 남의 이메일로도 채워지던 노출이었다)
    //
    // 반환: { is_provisional: bool, email?: string, name?: string }
    async checkProvisionalMember(email) {
        try {
            const { data, error } = await supabase
                .rpc('check_provisional_member', { p_email: String(email || '') });
            if (error) throw error;
            return data || { is_provisional: false };
        } catch (e) {
            console.error('checkProvisionalMember error:', e);
            throw e;
        }
    },

};

// 기존 DB(supabase-config.js)에 '없는 메서드만' 추가한다.
// (예전엔 getProfile / updateProfile / getAllProfiles 가 양쪽에 다 있었고 이 규칙 덕에
//  supabase-config.js 판본이 쓰였다. 2026-09-02 에 중복분을 지워 이제 겹치지 않는다)
Object.keys(_dbExtensions).forEach(function (k) {
    if (!(k in DB)) DB[k] = _dbExtensions[k];
});

// 전역 객체로 사용 가능하도록 할당
if (typeof window !== 'undefined') {
    window.DB = DB;
}

})();
