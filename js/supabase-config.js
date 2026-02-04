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
        var { error } = await _supabase.auth.resetPasswordForEmail(email, {
            redirectTo: 'https://sunwoongkyu.github.io/AI_Study_Circle/'
        });
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
    async attendEvent(userId, eventId, note) {
        // RPC 함수로 RLS 우회 (SECURITY DEFINER)
        var { error } = await _supabase.rpc('attend_event', {
            p_event_id: eventId,
            p_note: note || ''
        });
        if (error) throw error;
    },

    async cancelAttendance(userId, eventId) {
        var { error } = await _supabase
            .from('attendance')
            .delete()
            .eq('user_id', userId)
            .eq('event_id', eventId);
        if (error) throw error;
    },

    async getMyAttendance(userId) {
        var { data, error } = await _supabase
            .from('attendance')
            .select('*')
            .eq('user_id', userId);
        if (error) throw error;
        return data;
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
        var { data, error } = await _supabase
            .from('inquiries')
            .insert(inquiry)
            .select()
            .single();
        if (error) throw error;
        return data;
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
        // 참여 기록 가져오기
        var { data: attendances, error } = await _supabase
            .from('attendance')
            .select('*')
            .eq('event_id', eventId)
            .order('created_at', { ascending: true });
        if (error) throw error;
        if (!attendances || attendances.length === 0) return [];

        // 참여자 프로필 개별 조회 (FK 조인 실패 방지)
        var userIds = attendances.map(function(a) { return a.user_id; });
        var { data: profiles } = await _supabase
            .from('profiles')
            .select('id, name, phone, email')
            .in('id', userIds);

        var profileMap = {};
        if (profiles) {
            profiles.forEach(function(p) { profileMap[p.id] = p; });
        }

        return attendances.map(function(a) {
            a.profiles = profileMap[a.user_id] || null;
            return a;
        });
    }
};
