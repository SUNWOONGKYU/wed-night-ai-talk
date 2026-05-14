// ========== Supabase Configuration ==========
const SUPABASE_URL = 'https://vmiyqfkcoqdnkxjnxijt.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZtaXlxZmtjb3Fkbmt4am54aWp0Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzAwMjgwNjYsImV4cCI6MjA4NTYwNDA2Nn0.f7CCtWxojyvvbmlG-zwujDIylqjqhBpE11uI1J8Vrj4';

var _supabase = null;
var _sbInitError = null;

// URL 해시에서 type=recovery 감지 (createClient가 해시를 소비하기 전에 저장)
var _pendingPasswordRecovery = window.location.hash.indexOf('type=recovery') !== -1;

try {
    _supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
} catch (e) {
    _sbInitError = e;
    console.error('Supabase createClient 실패:', e);
}

// PKCE 비밀번호 재설정: PASSWORD_RECOVERY 이벤트를 조기에 캡처
// initAuth()가 renderScheduleEvents() 완료 후 실행되므로, 그 전에 이벤트가 유실될 수 있음
var _recoverySession = null;
if (_supabase) {
    _supabase.auth.onAuthStateChange(function(event, session) {
        if (event === 'PASSWORD_RECOVERY') {
            _recoverySession = session;
        }
    });
}

// ========== Admin Emails ==========
var ADMIN_EMAILS = [
    'wksun999@gmail.com',
    'lsonic.lee@gmail.com'
];

// ========== Auth Helpers ==========
var Auth = {
    async signUp(email, password, metadata) {
        var { data, error } = await _supabase.auth.signUp({
            email,
            password,
            options: { data: metadata }
        });
        if (error) throw error;
        return data;
    },

    async signIn(email, password) {
        var { data, error } = await _supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
        return data;
    },

    async signInWithGoogle() {
        // origin만 사용 (pathname/쿼리 제거) — Supabase Redirect URL 허용목록 매칭을 단순화
        var redirectTo = window.location.origin + '/';
        var { data, error } = await _supabase.auth.signInWithOAuth({
            provider: 'google',
            options: {
                redirectTo: redirectTo,
                queryParams: { access_type: 'offline', prompt: 'consent' }
            }
        });
        if (error) throw error;
        return data;
    },

    async signOut() {
        var { error } = await _supabase.auth.signOut();
        if (error) throw error;
    },

    async getSession() {
        var { data: { session } } = await _supabase.auth.getSession();
        return session;
    },

    async getUser() {
        var { data: { user } } = await _supabase.auth.getUser();
        return user;
    },

    async sendPasswordResetEmail(email) {
        var { error } = await _supabase.auth.resetPasswordForEmail(email);
        if (error) throw error;
    },

    async updatePassword(newPassword) {
        var { error } = await _supabase.auth.updateUser({ password: newPassword });
        if (error) throw error;
    },

    onAuthStateChange(callback) {
        return _supabase.auth.onAuthStateChange(callback);
    }
};

// ========== DB Helpers ==========
var DB = {
    // -- Profiles --
    async getProfile(userId) {
        var { data, error } = await _supabase
            .from('profiles')
            .select('*')
            .eq('id', userId)
            .single();
        if (error) throw error;
        return data;
    },

    async updateProfile(userId, updates) {
        var { data, error } = await _supabase
            .from('profiles')
            .update(updates)
            .eq('id', userId)
            .select()
            .single();
        if (error) throw error;
        return data;
    },

    async getMemberCount() {
        var { data, error } = await _supabase.rpc('get_member_count');
        if (error) throw error;
        return data;
    },

    async getPostCount() {
        var { count, error } = await _supabase
            .from('posts')
            .select('*', { count: 'exact', head: true });
        if (error) throw error;
        return count || 0;
    },

    // -- Events --
    async getEvents() {
        var { data, error } = await _supabase
            .from('events')
            .select('*')
            .eq('is_active', true)
            .order('event_date', { ascending: true });
        if (error) throw error;
        return data;
    },

    // 회차 번호 계산용 — 비활성 포함 전체 이벤트 (event_date ASC = 생성 순서)
    async getAllEventsForNumbering() {
        var { data, error } = await _supabase
            .from('events')
            .select('id, event_date')
            .order('event_date', { ascending: true });
        if (error) throw error;
        return data;
    },

    async getEvent(eventId) {
        var { data, error } = await _supabase
            .from('events')
            .select('*')
            .eq('id', eventId)
            .single();
        if (error) throw error;
        return data;
    },

    // -- Attendance --
    async attendEvent(userId, eventId, note, eventSlotId) {
        if (!eventSlotId) throw new Error('타임 슬롯을 먼저 선택해주세요.');
        var { error } = await _supabase.rpc('attend_event', {
            p_event_id: eventId,
            p_event_slot_id: eventSlotId,
            p_note: note || ''
        });
        if (error) throw error;
    },

    async cancelAttendance(userId, eventId, eventSlotId) {
        var { error } = await _supabase.rpc('cancel_attendance', {
            p_event_id: eventId,
            p_event_slot_id: eventSlotId || null
        });
        if (error) throw error;
    },

    async getSlotCounts(eventId) {
        // get_slot_counts RPC가 슬롯 정보 + 카운트를 모두 반환
        // [{ event_slot_id, slot_label, slot_emoji, slot_time, sort_order, is_active, member_count, guest_count }, ...]
        var { data, error } = await _supabase.rpc('get_slot_counts', {
            p_event_id: eventId
        });
        if (error) throw error;
        return (data || []).map(function(r) {
            return {
                id: r.event_slot_id,
                slot_label: r.slot_label,
                slot_emoji: r.slot_emoji,
                slot_time: r.slot_time,
                slot_end_time: r.slot_end_time,
                capacity: (r.capacity != null ? Number(r.capacity) : null),
                sort_order: r.sort_order,
                is_active: r.is_active,
                count: Number(r.member_count || 0) + Number(r.guest_count || 0),
                member_count: Number(r.member_count || 0),
                guest_count: Number(r.guest_count || 0)
            };
        });
    },

    // -- Event Slots (admin & 메인 공용) --
    async getEventSlots(eventId) {
        var { data, error } = await _supabase
            .from('event_slots')
            .select('*')
            .eq('event_id', eventId)
            .order('sort_order', { ascending: true });
        if (error) throw error;
        return data;
    },

    async createEventSlot(slot) {
        var { data, error } = await _supabase
            .from('event_slots')
            .insert(slot)
            .select()
            .single();
        if (error) throw error;
        return data;
    },

    async updateEventSlot(slotId, updates) {
        var { data, error } = await _supabase
            .from('event_slots')
            .update(updates)
            .eq('id', slotId)
            .select()
            .single();
        if (error) throw error;
        return data;
    },

    async deleteEventSlot(slotId) {
        var { error } = await _supabase
            .from('event_slots')
            .delete()
            .eq('id', slotId);
        if (error) throw error;
    },

    async replaceEventSlots(eventId, slots) {
        // 기존 슬롯 모두 비활성화 후 새로 입력 (참여자 보존을 위해 delete가 아닌 deactivate)
        // slots: [{ id?, slot_label, slot_emoji, slot_time, sort_order, is_active }]
        var existing = await this.getEventSlots(eventId);
        var keepIds = slots.filter(function(s) { return s.id; }).map(function(s) { return s.id; });
        // 새 폼에 없는 기존 슬롯 → 비활성화 (delete 시 attendance CASCADE 위험)
        for (var i = 0; i < existing.length; i++) {
            var ex = existing[i];
            if (keepIds.indexOf(ex.id) === -1) {
                await this.updateEventSlot(ex.id, { is_active: false });
            }
        }
        // 업데이트 또는 생성
        for (var j = 0; j < slots.length; j++) {
            var s = slots[j];
            var payload = {
                event_id: eventId,
                slot_label: s.slot_label,
                slot_emoji: s.slot_emoji || null,
                slot_time: s.slot_time || null,
                slot_end_time: s.slot_end_time || null,
                sort_order: s.sort_order || (j + 1),
                is_active: s.is_active !== false
            };
            if (s.id) {
                await this.updateEventSlot(s.id, payload);
            } else {
                await this.createEventSlot(payload);
            }
        }
    },

    async getMyAttendance(userId) {
        var { data, error } = await _supabase
            .from('attendance')
            .select('*')
            .eq('user_id', userId);
        if (error) throw error;
        return data;
    },

    // 슬롯별 신청자 명단 (회원·게스트 통합, name만)
    async getSlotAttendees(eventId) {
        var { data, error } = await _supabase.rpc('get_slot_attendees', { p_event_id: eventId });
        if (error) throw error;
        return data || [];
    },

    // 내 신청 전체 (프로필 페이지용) — 이벤트·슬롯 정보 포함
    async getMyAttendancesFull() {
        var { data, error } = await _supabase.rpc('get_my_attendances');
        if (error) throw error;
        return data || [];
    },

    // -- Admin: Members --
    async getAllProfiles() {
        var { data, error } = await _supabase
            .from('profiles')
            .select('*')
            .order('created_at', { ascending: false });
        if (error) throw error;
        return data;
    },

    // -- Admin: Events CRUD --
    async createEvent(event) {
        var { data, error } = await _supabase
            .from('events')
            .insert(event)
            .select()
            .single();
        if (error) throw error;
        return data;
    },

    async updateEvent(eventId, updates) {
        var { data, error } = await _supabase
            .from('events')
            .update(updates)
            .eq('id', eventId)
            .select()
            .single();
        if (error) throw error;
        return data;
    },

    async deleteEvent(eventId) {
        var { error } = await _supabase
            .from('events')
            .delete()
            .eq('id', eventId);
        if (error) throw error;
    },

    async getAllEvents() {
        var { data, error } = await _supabase
            .from('events')
            .select('*')
            .order('event_date', { ascending: false });
        if (error) throw error;
        return data;
    },

    // -- Locations --
    async getLocations() {
        var { data, error } = await _supabase
            .from('locations')
            .select('*')
            .eq('is_active', true)
            .order('sort_order', { ascending: true });
        if (error) throw error;
        return data;
    },

    async getAllLocations() {
        var { data, error } = await _supabase
            .from('locations')
            .select('*')
            .order('sort_order', { ascending: true });
        if (error) throw error;
        return data;
    },

    async createLocation(loc) {
        var { data, error } = await _supabase
            .from('locations')
            .insert(loc)
            .select()
            .single();
        if (error) throw error;
        return data;
    },

    async updateLocation(id, updates) {
        var { data, error } = await _supabase
            .from('locations')
            .update(updates)
            .eq('id', id)
            .select()
            .single();
        if (error) throw error;
        return data;
    },

    async deleteLocation(id) {
        var { error } = await _supabase
            .from('locations')
            .delete()
            .eq('id', id);
        if (error) throw error;
    },

    // -- Inquiries --
    async createInquiry(inquiry) {
        // 비로그인/비관리자는 SELECT가 RLS로 막혀있으므로 .select() 빼고 INSERT만
        var { error } = await _supabase
            .from('inquiries')
            .insert(inquiry);
        if (error) throw error;
        return true;
    },

    async getAllInquiries() {
        var { data, error } = await _supabase
            .from('inquiries')
            .select('*')
            .order('created_at', { ascending: false });
        if (error) throw error;
        return data;
    },

    async deleteInquiry(id) {
        var { error } = await _supabase
            .from('inquiries')
            .delete()
            .eq('id', id);
        if (error) throw error;
    },

    // -- Guest Attendance (게스트 모임 참여 신청) --
    async createGuestAttendance(payload) {
        // payload: { name, phone, email, message, event_id, event_slot_id }
        var { data, error } = await _supabase.rpc('create_guest_attendance', {
            p_name: payload.name,
            p_phone: payload.phone,
            p_email: payload.email || null,
            p_message: payload.message || null,
            p_event_id: payload.event_id,
            p_event_slot_id: payload.event_slot_id
        });
        if (error) throw error;
        return data;
    },

    async deleteGuestAttendance(id) {
        var { error } = await _supabase
            .from('guest_attendance')
            .delete()
            .eq('id', id);
        if (error) throw error;
    },

    async adminDeleteAttendance(userId, eventId) {
        var { error } = await _supabase.rpc('admin_delete_attendance', {
            p_user_id: userId,
            p_event_id: eventId
        });
        if (error) throw error;
    },

    // -- Admin: Attendance by event --
    // -- Posts --
    async getPosts(limit, offset) {
        limit = limit || 10;
        offset = offset || 0;
        var { data, error } = await _supabase
            .from('posts')
            .select('*, profiles:user_id(id, name)')
            .order('created_at', { ascending: false })
            .range(offset, offset + limit - 1);
        if (error) throw error;
        return data;
    },

    async getPost(postId) {
        var { data, error } = await _supabase
            .from('posts')
            .select('*, profiles:user_id(id, name)')
            .eq('id', postId)
            .single();
        if (error) throw error;
        return data;
    },

    async incrementViewCount(postId) {
        var { error } = await _supabase.rpc('increment_post_view', { p_post_id: postId });
        if (error) throw error;
    },

    async createPost(userId, title, content) {
        var { error } = await _supabase
            .from('posts')
            .insert({ user_id: userId, title: title, content: content });
        if (error) throw error;
    },

    async updatePost(postId, title, content) {
        var { error } = await _supabase
            .from('posts')
            .update({ title: title, content: content, updated_at: new Date().toISOString() })
            .eq('id', postId);
        if (error) throw error;
    },

    async deletePost(postId) {
        var { error } = await _supabase
            .from('posts')
            .delete()
            .eq('id', postId);
        if (error) throw error;
    },

    // -- Comments --
    async getComments(postId) {
        var { data, error } = await _supabase
            .from('comments')
            .select('*, profiles:user_id(id, name)')
            .eq('post_id', postId)
            .order('created_at', { ascending: true });
        if (error) throw error;
        return data;
    },

    async createComment(postId, userId, content, parentId) {
        var row = { post_id: postId, user_id: userId, content: content };
        if (parentId) row.parent_id = parentId;
        var { error } = await _supabase
            .from('comments')
            .insert(row);
        if (error) throw error;
    },

    async deleteComment(commentId) {
        var { error } = await _supabase
            .from('comments')
            .delete()
            .eq('id', commentId);
        if (error) throw error;
    },

    // -- Reactions --
    async getReactionCounts(postId) {
        var { data, error } = await _supabase
            .from('post_reactions')
            .select('reaction_type')
            .eq('post_id', postId);
        if (error) throw error;
        var likes = 0, dislikes = 0;
        (data || []).forEach(function(r) {
            if (r.reaction_type === 'like') likes++;
            else if (r.reaction_type === 'dislike') dislikes++;
        });
        return { likes: likes, dislikes: dislikes };
    },

    async getMyReaction(postId, userId) {
        var { data, error } = await _supabase
            .from('post_reactions')
            .select('*')
            .eq('post_id', postId)
            .eq('user_id', userId)
            .maybeSingle();
        if (error) throw error;
        return data;
    },

    async upsertReaction(postId, userId, type) {
        // Check existing
        var existing = await this.getMyReaction(postId, userId);
        if (existing) {
            if (existing.reaction_type === type) {
                // Same type: remove
                await this.removeReaction(postId, userId);
                return null;
            } else {
                // Different type: update
                var { error } = await _supabase
                    .from('post_reactions')
                    .update({ reaction_type: type })
                    .eq('post_id', postId)
                    .eq('user_id', userId);
                if (error) throw error;
            }
        } else {
            // New reaction
            var { error } = await _supabase
                .from('post_reactions')
                .insert({ post_id: postId, user_id: userId, reaction_type: type });
            if (error) throw error;
        }
    },

    async removeReaction(postId, userId) {
        var { error } = await _supabase
            .from('post_reactions')
            .delete()
            .eq('post_id', postId)
            .eq('user_id', userId);
        if (error) throw error;
    },

    async getCommentCount(postId) {
        var { count, error } = await _supabase
            .from('comments')
            .select('*', { count: 'exact', head: true })
            .eq('post_id', postId);
        if (error) throw error;
        return count || 0;
    },

    async getEventAttendees(eventId) {
        // 회원 참여 기록 (없을 수 있음)
        var { data: attendances, error } = await _supabase
            .from('attendance')
            .select('*')
            .eq('event_id', eventId)
            .order('created_at', { ascending: true });
        if (error) throw error;
        attendances = attendances || [];

        // 회원 프로필 매핑
        var profileMap = {};
        if (attendances.length > 0) {
            var userIds = attendances.map(function(a) { return a.user_id; });
            var { data: profiles } = await _supabase
                .from('profiles')
                .select('id, name, phone, email')
                .in('id', userIds);
            if (profiles) {
                profiles.forEach(function(p) { profileMap[p.id] = p; });
            }
        }

        // 이벤트 슬롯 매핑 (event_slot_id → label/emoji)
        var slotMap = {};
        try {
            var { data: slotRows } = await _supabase
                .from('event_slots')
                .select('id, slot_label, slot_emoji, slot_time, slot_end_time, sort_order')
                .eq('event_id', eventId);
            if (slotRows) {
                slotRows.forEach(function(s) { slotMap[s.id] = s; });
            }
        } catch (e) { /* ignore */ }

        var memberRows = attendances.map(function(a) {
            a.profiles = profileMap[a.user_id] || null;
            a.slot = a.event_slot_id ? (slotMap[a.event_slot_id] || null) : null;
            a.is_guest = false;
            return a;
        });

        // 게스트(비회원) 신청: guest_attendance 테이블에서 조회
        var guestRows = [];
        try {
            var { data: guests } = await _supabase
                .from('guest_attendance')
                .select('id, name, phone, email, message, event_id, event_slot_id, created_at')
                .eq('event_id', eventId)
                .order('created_at', { ascending: true });
            if (guests) {
                guestRows = guests.map(function(g) {
                    return {
                        id: 'g_' + g.id,
                        guest_id: g.id,
                        is_guest: true,
                        user_id: null,
                        event_id: g.event_id,
                        event_slot_id: g.event_slot_id,
                        note: g.message || '',
                        created_at: g.created_at,
                        profiles: { name: g.name || '', phone: g.phone || '', email: g.email || '' },
                        slot: g.event_slot_id ? (slotMap[g.event_slot_id] || null) : null
                    };
                });
            }
        } catch (e) { console.warn('guest_attendance fetch failed:', e); }

        return memberRows.concat(guestRows);
    },

    // ========== Email (Resend via Edge Function) ==========
    async sendBulkEmail(opts) {
        // opts: { to: string[], subject: string, html: string, test?: boolean }
        if (!opts || !Array.isArray(opts.to) || !opts.subject || !opts.html) {
            throw new Error('to, subject, html 필수');
        }
        var { data, error } = await _supabase.functions.invoke('send-email', {
            body: {
                to: opts.to,
                subject: opts.subject,
                html: opts.html,
                test: !!opts.test
            }
        });
        if (error) throw error;
        if (data && data.success === false) {
            throw new Error(data.error || '발송 실패');
        }
        return data; // { success, sent, failed, details, test_mode }
    },

    async getEmailLogs(limit) {
        var lim = Math.min(Math.max(parseInt(limit) || 30, 1), 200);
        var { data, error } = await _supabase
            .from('email_logs')
            .select('id, subject, recipients_count, success_count, fail_count, sent_by_email, created_at')
            .order('created_at', { ascending: false })
            .limit(lim);
        if (error) throw error;
        return data || [];
    },

    async getEventsForEmail() {
        // 이메일 발송 대상 회차 선택용 (최근 6개월 + 활성/비활성 모두)
        var sixMonthsAgo = new Date();
        sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);
        var { data, error } = await _supabase
            .from('events')
            .select('id, title, event_date, location, is_active')
            .gte('event_date', sixMonthsAgo.toISOString().slice(0, 10))
            .order('event_date', { ascending: false })
            .limit(50);
        if (error) throw error;
        // active 라는 약식 이름으로 admin.js에 노출
        return (data || []).map(function(e) {
            return {
                id: e.id,
                title: e.title,
                event_date: e.event_date,
                location_name: e.location || '',
                active: !!e.is_active
            };
        });
    }
};
