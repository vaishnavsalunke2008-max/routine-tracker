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
