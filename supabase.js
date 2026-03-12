// ─── Supabase Auth Module ───
// Replace these with your actual Supabase project credentials
const SUPABASE_URL = 'https://sucywzycbaknqzekcfoa.supabase.co';
const SUPABASE_ANON_KEY = 'sb_publishable_ztIMok8ySMYqA8Kzx1WUWw_pcsnOPx_';

// Initialize Supabase client
const supabaseClient = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// ─── Auth Helpers ───

async function supaSignUp(email, password) {
    const { data, error } = await supabaseClient.auth.signUp({ email, password });
    return { data, error };
}

async function supaSignIn(email, password) {
    const { data, error } = await supabaseClient.auth.signInWithPassword({ email, password });
    return { data, error };
}

async function supaSignInWithGoogle() {
    const { data, error } = await supabaseClient.auth.signInWithOAuth({
        provider: 'google',
        options: {
            redirectTo: window.location.origin + window.location.pathname.replace(/[^/]*$/, '') + 'index.html',
        },
    });
    return { data, error };
}

async function supaSignOut() {
    const { error } = await supabaseClient.auth.signOut();
    return { error };
}

async function supaGetUser() {
    const { data: { user } } = await supabaseClient.auth.getUser();
    return user;
}

async function supaGetSession() {
    const { data: { session } } = await supabaseClient.auth.getSession();
    return session;
}

function supaOnAuthStateChange(callback) {
    return supabaseClient.auth.onAuthStateChange((_event, session) => {
        callback(session);
    });
}
