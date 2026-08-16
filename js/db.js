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
    // ===== 예비 멤버 관련 함수 =====

    // 예비 멤버 조회 (이메일로)
    async getProvisionalMember(email) {
        try {
            const { data, error } = await supabase
                .from('provisional_members')
                .select('*')
                .eq('email', email.toLowerCase())
                .single();

            if (error && error.code !== 'PGRST116') throw error;
            return data || null;
        } catch (e) {
            console.error('getProvisionalMember error:', e);
            throw e;
        }
    },

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

    // 모든 예비 멤버 조회
    async getAllProvisionalMembers(includeSubmitted = false) {
        try {
            let query = supabase
                .from('provisional_members')
                .select('*')
                .order('created_at', { ascending: false });

            if (!includeSubmitted) {
                query = query.is('submitted_at', null);
            }

            const { data, error } = await query;
            if (error) throw error;
            return data || [];
        } catch (e) {
            console.error('getAllProvisionalMembers error:', e);
            throw e;
        }
    },

    // 예비 멤버 일괄 등록
    async insertProvisionalMembers(members) {
        try {
            // members: [{ email, name, source }, ...]
            const { data, error } = await supabase
                .from('provisional_members')
                .insert(members)
                .select();

            if (error) throw error;
            return data || [];
        } catch (e) {
            console.error('insertProvisionalMembers error:', e);
            throw e;
        }
    },

    // 예비 멤버 제출 완료 마킹
    async markProvisionalSubmitted(provisionalId, profileData = {}) {
        try {
            const { data, error } = await supabase
                .from('provisional_members')
                .update({
                    submitted_at: new Date().toISOString(),
                    notes: profileData ? JSON.stringify(profileData) : null
                })
                .eq('id', provisionalId)
                .select();

            if (error) throw error;
            return data?.[0] || null;
        } catch (e) {
            console.error('markProvisionalSubmitted error:', e);
            throw e;
        }
    },

    // 예비 멤버 삭제
    async deleteProvisionalMember(provisionalId) {
        try {
            const { error } = await supabase
                .from('provisional_members')
                .delete()
                .eq('id', provisionalId);

            if (error) throw error;
            return true;
        } catch (e) {
            console.error('deleteProvisionalMember error:', e);
            throw e;
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

    // 프로필 조회 (이메일로)
    async getProfileByEmail(email) {
        try {
            // profiles.email 에는 UNIQUE 제약이 없어 같은 이메일 행이 여러 개일 수 있다.
            // .single() 은 그때 PGRST116 으로 실패해 예비멤버를 놓치므로 쓰지 않는다.
            const { data, error } = await supabase
                .from('profiles')
                .select('*')
                .eq('email', String(email || '').toLowerCase())
                .order('created_at', { ascending: true })
                .limit(20);

            if (error) throw error;
            if (!data || data.length === 0) return null;

            // 여러 행이면 '예비 멤버' 마크가 붙은 행을 우선 반환한다(전환 안내가 목적).
            const provisional = data.find(function(row) {
                return row.notes && row.notes.indexOf('예비 멤버') !== -1;
            });
            return provisional || data[0];
        } catch (e) {
            console.error('getProfileByEmail error:', e);
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

    // 예비 멤버 통계
    async getProvisionalStats() {
        try {
            const all = await this.getAllProvisionalMembers(true);
            const submitted = all.filter(p => p.submitted_at).length;
            const pending = all.length - submitted;

            return {
                total: all.length,
                submitted: submitted,
                pending: pending,
                bySource: this._groupBySource(all),
                byDate: this._groupByDate(all)
            };
        } catch (e) {
            console.error('getProvisionalStats error:', e);
            throw e;
        }
    },

    _groupBySource(members) {
        const result = {};
        members.forEach(m => {
            const src = m.source || 'unknown';
            result[src] = (result[src] || 0) + 1;
        });
        return result;
    },

    _groupByDate(members) {
        const result = {};
        members.forEach(m => {
            const date = m.created_at.split('T')[0];
            result[date] = (result[date] || 0) + 1;
        });
        return result;
    }
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
