// ─── Supabase Auth Module ───
// Replace these with your actual Supabase project credentials
const SUPABASE_URL = 'https://sucywzycbaknqzekcfoa.supabase.co';
const SUPABASE_ANON_KEY = 'sb_publishable_ztIMok8ySMYqA8Kzx1WUWw_pcsnOPx_';

// Initialize Supabase client
const supabaseClient = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// ─── Retry Wrapper (handles Supabase cold starts) ───

/**
 * Retries a Supabase call up to `maxRetries` times with a delay between attempts.
 * @param {Function} fn        – async function to call
 * @param {number}   maxRetries – total attempts (default 3)
 * @param {number}   delayMs    – ms to wait between retries (default 2500)
 * @param {Function} onRetry    – optional callback(attempt, maxRetries) for UI updates
 */
async function retrySupabaseCall(fn, maxRetries = 3, delayMs = 2500, onRetry) {
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
        try {
            return await fn();
        } catch (err) {
            if (attempt === maxRetries) throw err;
            if (onRetry) onRetry(attempt, maxRetries);
            await new Promise(r => setTimeout(r, delayMs));
        }
    }
}

// ─── Auth Helpers ───

async function supaSignUp(email, password, onRetry) {
    return retrySupabaseCall(async () => {
        const { data, error } = await supabaseClient.auth.signUp({ email, password });
        if (error) throw error;
        return { data, error: null };
    }, 3, 2500, onRetry);
}

async function supaSignIn(email, password, onRetry) {
    return retrySupabaseCall(async () => {
        const { data, error } = await supabaseClient.auth.signInWithPassword({ email, password });
        if (error) throw error;
        return { data, error: null };
    }, 3, 2500, onRetry);
}

async function supaSignInWithGoogle(onRetry) {
    return retrySupabaseCall(async () => {
        const { data, error } = await supabaseClient.auth.signInWithOAuth({
            provider: 'google',
            options: {
                redirectTo: window.location.origin + window.location.pathname.replace(/[^/]*$/, '') + 'index.html',
            },
        });
        if (error) throw error;
        return { data, error: null };
    }, 3, 2500, onRetry);
}

async function supaSignOut() {
    const { error } = await supabaseClient.auth.signOut();
    return { error };
}

async function supaGetUser() {
    const { data: { user } } = await supabaseClient.auth.getUser();
    return user;
}

async function supaGetSession(onRetry) {
    return retrySupabaseCall(async () => {
        const { data: { session } } = await supabaseClient.auth.getSession();
        return session;
    }, 3, 2500, onRetry);
}

function supaOnAuthStateChange(callback) {
    return supabaseClient.auth.onAuthStateChange((_event, session) => {
        callback(session);
    });
}

// ─── Push Subscription Helpers ───

async function supaSavePushSubscription(userId, subscription) {
    const keys = subscription.toJSON().keys;
    // Get user's timezone offset in minutes from UTC
    // e.g. IST (UTC+5:30) = -(-330) = 330, EST (UTC-5) = -(-300) = 300
    const timezoneOffset = -(new Date().getTimezoneOffset()); // positive = ahead of UTC
    const { error } = await supabaseClient
        .from('push_subscriptions')
        .upsert({
            user_id: userId,
            endpoint: subscription.endpoint,
            p256dh: keys.p256dh,
            auth: keys.auth,
            timezone_offset: timezoneOffset,
        }, { onConflict: 'user_id,endpoint' });
    if (error) console.error('[Supabase] Save push sub error:', error);
    return { error };
}

async function supaDeletePushSubscription(userId, endpoint) {
    const { error } = await supabaseClient
        .from('push_subscriptions')
        .delete()
        .eq('user_id', userId)
        .eq('endpoint', endpoint);
    return { error };
}

// ─── Habit Reminder Sync ───

async function supaSyncReminders(userId, timedHabits) {
    // timedHabits: [{id, name, reminderTime, completed}]
    if (!timedHabits || timedHabits.length === 0) {
        // Delete all reminders for this user
        await supabaseClient
            .from('habit_reminders')
            .delete()
            .eq('user_id', userId);
        return;
    }

    // Upsert all current timed habits
    const rows = timedHabits.map(h => ({
        id: h.id,
        user_id: userId,
        name: h.name,
        reminder_time: h.reminderTime,
        completed: h.completed || false,
    }));

    const { error } = await supabaseClient
        .from('habit_reminders')
        .upsert(rows, { onConflict: 'user_id,id' });

    if (error) {
        console.error('[Supabase] Sync reminders error:', error);
        return;
    }

    // Delete reminders that no longer exist locally
    const currentIds = timedHabits.map(h => h.id);
    const { data: existing } = await supabaseClient
        .from('habit_reminders')
        .select('id')
        .eq('user_id', userId);
        
    if (existing) {
        const toDelete = existing.map(r => r.id).filter(id => !currentIds.includes(id));
        if (toDelete.length > 0) {
            await supabaseClient
                .from('habit_reminders')
                .delete()
                .eq('user_id', userId)
                .in('id', toDelete);
        }
    }
}

async function supaMarkReminderCompleted(userId, habitId) {
    await supabaseClient
        .from('habit_reminders')
        .update({ completed: true })
        .eq('user_id', userId)
        .eq('id', habitId);
}

async function supaResetRemindersForNewDay(userId) {
    // Reset completed status and last_notified for a new day
    await supabaseClient
        .from('habit_reminders')
        .update({ completed: false, last_notified: null })
        .eq('user_id', userId);
}

