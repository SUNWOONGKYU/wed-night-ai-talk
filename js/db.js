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

    // 기존 정식 멤버 조회 (이메일로)
    async getExistingMember(email) {
        try {
            const { data, error } = await supabase.auth.admin.listUsers();
            if (error) throw error;

            return data?.users?.find(u => u.email === email.toLowerCase()) || null;
        } catch (e) {
            console.error('getExistingMember error:', e);
            // 권한 없음인 경우 클라이언트 쿼리로 대체
            return null;
        }
    },

    // ===== 정식 멤버 (프로필) 관련 함수 =====

    // 프로필 생성
    async createProfile(profileData) {
        try {
            const { data, error } = await supabase
                .from('profiles')
                .insert([profileData])
                .select();

            if (error) throw error;
            return data?.[0] || null;
        } catch (e) {
            console.error('createProfile error:', e);
            throw e;
        }
    },

    // 프로필 조회
    async getProfile(userId) {
        try {
            const { data, error } = await supabase
                .from('profiles')
                .select('*')
                .eq('id', userId)
                .single();

            if (error && error.code !== 'PGRST116') throw error;
            return data || null;
        } catch (e) {
            console.error('getProfile error:', e);
            throw e;
        }
    },

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

    // 프로필 업데이트
    async updateProfile(userId, updates) {
        try {
            // interests(TEXT[]) 문자열→배열 정규화 — supabase-config.js 의 공용 헬퍼 사용
            const normalized = (typeof waatNormalizeProfileUpdates === 'function')
                ? waatNormalizeProfileUpdates(updates)
                : updates;
            const { data, error } = await supabase
                .from('profiles')
                .update(normalized)
                .eq('id', userId)
                .select();

            if (error) throw error;
            if (!data || data.length === 0) {
                throw new Error('프로필 업데이트 실패: 해당 사용자 프로필이 없습니다. (ID: ' + userId + ')');
            }
            return data[0];
        } catch (e) {
            console.error('updateProfile error:', e);
            throw e;
        }
    },

    // 모든 프로필 조회 (관리자용)
    async getAllProfiles() {
        try {
            const { data, error } = await supabase
                .from('profiles')
                .select('*')
                .order('created_at', { ascending: false });

            if (error) throw error;
            return data || [];
        } catch (e) {
            console.error('getAllProfiles error:', e);
            throw e;
        }
    },

    // ===== 유틸 함수 =====

    // 이메일로 기존 멤버 조회
    async getExistingEmails() {
        try {
            const { data, error } = await supabase
                .from('profiles')
                .select('email');

            if (error) throw error;
            return (data || []).map(p => p.email?.toLowerCase()).filter(Boolean);
        } catch (e) {
            console.error('getExistingEmails error:', e);
            return [];
        }
    },

};

// 기존 DB(supabase-config.js)에 '없는 메서드만' 추가한다.
// getProfile / updateProfile / getAllProfiles 는 양쪽에 다 있는데,
// admin.html 등은 지금까지 supabase-config.js 판본으로 동작해 왔으므로 그쪽을 유지한다.
// (여기서 덮어쓰면 검증되지 않은 동작 변경이 된다)
Object.keys(_dbExtensions).forEach(function (k) {
    if (!(k in DB)) DB[k] = _dbExtensions[k];
});

// 전역 객체로 사용 가능하도록 할당
if (typeof window !== 'undefined') {
    window.DB = DB;
}

})();
