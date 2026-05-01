
const CACHE_NAME = 'routine-tracker-v9';
const ASSETS = [
    './',
    './index.html',
    './auth.html',
    './style.css',
    './auth.css',
    './app.js',
    './supabase.js',
    './manifest.json',
    './icons/icon-192.png',
    './icons/icon-512.png',
    'https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap',
    'https://cdn.jsdelivr.net/npm/chart.js@4.4.7/dist/chart.umd.min.js',
];

// ─── IndexedDB helpers for persistent reminder state ───
const DB_NAME = 'routine-tracker-sw';
const DB_VERSION = 1;
const STORE_NAME = 'reminder-state';

function openDB() {
    return new Promise((resolve, reject) => {
        const req = indexedDB.open(DB_NAME, DB_VERSION);
        req.onupgradeneeded = (e) => {
            const db = e.target.result;
            if (!db.objectStoreNames.contains(STORE_NAME)) {
                db.createObjectStore(STORE_NAME);
            }
        };
        req.onsuccess = () => resolve(req.result);
        req.onerror = () => reject(req.error);
    });
}

async function dbGet(key) {
    try {
        const db = await openDB();
        return new Promise((resolve, reject) => {
            const tx = db.transaction(STORE_NAME, 'readonly');
            const store = tx.objectStore(STORE_NAME);
            const req = store.get(key);
            req.onsuccess = () => resolve(req.result);
            req.onerror = () => reject(req.error);
        });
    } catch (e) {
        console.warn('[SW] dbGet error:', e);
        return undefined;
    }
}

async function dbSet(key, value) {
    try {
        const db = await openDB();
        return new Promise((resolve, reject) => {
            const tx = db.transaction(STORE_NAME, 'readwrite');
            const store = tx.objectStore(STORE_NAME);
            const req = store.put(value, key);
            req.onsuccess = () => resolve();
            req.onerror = () => reject(req.error);
        });
    } catch (e) {
        console.warn('[SW] dbSet error:', e);
    }
}

// ─── In-memory cache (loaded from IndexedDB on each wake) ───
let habitReminders = [];     // [{id, name, reminderTime, completed}]
let dailyReminder = null;    // {enabled, time}
let firedToday = {};         // {reminderId: dateString}
let reminderCheckTimer = null;

// Load persisted state from IndexedDB
async function loadState() {
    const habits = await dbGet('habitReminders');
    if (habits) habitReminders = habits;

    const daily = await dbGet('dailyReminder');
    if (daily) dailyReminder = daily;

    const fired = await dbGet('firedToday');
    if (fired) firedToday = fired;
}

// Save current state to IndexedDB
async function saveState() {
    await dbSet('habitReminders', habitReminders);
    await dbSet('dailyReminder', dailyReminder);
    await dbSet('firedToday', firedToday);
}

// ─── Install — cache all assets ───
self.addEventListener('install', (e) => {
    e.waitUntil(
        caches.open(CACHE_NAME).then((cache) => cache.addAll(ASSETS))
    );
    self.skipWaiting();
});

// ─── Activate — clean old caches, start reminder loop ───
self.addEventListener('activate', (e) => {
    e.waitUntil(
        caches.keys().then((keys) =>
            Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k)))
        ).then(() => loadState()).then(() => startReminderLoop())
    );
    self.clients.claim();
});

// ─── Message handler — receive data from the app ───
self.addEventListener('message', (e) => {
    const msg = e.data;
    if (!msg || !msg.type) return;

    if (msg.type === 'UPDATE_HABIT_REMINDERS') {
        habitReminders = msg.habits || [];
        saveState();
        startReminderLoop();
    }

    if (msg.type === 'UPDATE_DAILY_REMINDER') {
        dailyReminder = { enabled: msg.enabled, time: msg.time };
        saveState();
        startReminderLoop();
    }

    if (msg.type === 'MARK_COMPLETED') {
        const id = msg.habitId;
        habitReminders = habitReminders.map(h =>
            h.id === id ? { ...h, completed: true } : h
        );
        saveState();
    }

    if (msg.type === 'PING') {
        // Keep-alive ping — reload state and restart loop
        loadState().then(() => startReminderLoop());
    }
});

// ─── Start the reminder check loop ───
// Uses self-rescheduling setTimeout (more reliable than setInterval in SW)
function startReminderLoop() {
    if (reminderCheckTimer) clearTimeout(reminderCheckTimer);

    function tick() {
        checkAllReminders();
        // Re-schedule next check in 15 seconds
        reminderCheckTimer = setTimeout(tick, 15000);
    }
    tick();
}

// ─── Get today's date string (YYYY-MM-DD) ───
function getTodayKey() {
    const now = new Date();
    const y = now.getFullYear();
    const m = String(now.getMonth() + 1).padStart(2, '0');
    const d = String(now.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
}

// ─── Clean old fired entries ───
function cleanFired() {
    const today = getTodayKey();
    let changed = false;
    for (const key of Object.keys(firedToday)) {
        if (firedToday[key] !== today) {
            delete firedToday[key];
            changed = true;
        }
    }
    if (changed) saveState();
}

// ─── Main check — runs every 15 seconds ───
function checkAllReminders() {
    const now = new Date();
    const nowMinutes = now.getHours() * 60 + now.getMinutes();
    const today = getTodayKey();

    cleanFired();

    // Check per-habit timed reminders
    habitReminders.forEach(habit => {
        if (!habit.reminderTime || habit.completed) return;

        const reminderId = 'habit_' + habit.id;
        if (firedToday[reminderId] === today) return;

        const [h, m] = habit.reminderTime.split(':').map(Number);
        const targetMinutes = h * 60 + m;

        // Fire if we're at or past the target time (within a 5-minute window)
        if (nowMinutes >= targetMinutes && nowMinutes <= targetMinutes + 5) {
            firedToday[reminderId] = today;
            saveState();
            self.registration.showNotification(habit.name, {
                body: `⏰ It's time for: ${habit.name}`,
                icon: 'icons/icon-192.png',
                badge: 'icons/icon-192.png',
                vibrate: [200, 100, 200],
                tag: 'habit-' + habit.id + '-' + today,
                renotify: true,
                requireInteraction: true,
                data: { habitId: habit.id, type: 'habit' },
            });
        }
    });

    // Check daily reminder
    if (dailyReminder && dailyReminder.enabled && dailyReminder.time) {
        const dailyId = 'daily_reminder';
        if (firedToday[dailyId] !== today) {
            const [h, m] = dailyReminder.time.split(':').map(Number);
            const targetMinutes = h * 60 + m;
            if (nowMinutes >= targetMinutes && nowMinutes <= targetMinutes + 5) {
                firedToday[dailyId] = today;
                saveState();
                self.registration.showNotification('Routines 🎯', {
                    body: 'Time to check in with your daily habits!',
                    icon: 'icons/icon-192.png',
                    badge: 'icons/icon-192.png',
                    vibrate: [200, 100, 200],
                    tag: 'daily-reminder-' + today,
                    renotify: true,
                    requireInteraction: true,
                    data: { type: 'daily' },
                });
            }
        }
    }
}

// ─── Notification click — open or focus the app ───
self.addEventListener('notificationclick', (e) => {
    e.notification.close();
    e.waitUntil(
        self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
            for (const client of clientList) {
                if ('focus' in client) {
                    return client.focus();
                }
            }
            if (self.clients.openWindow) {
                return self.clients.openWindow('./index.html');
            }
        })
    );
});

// ─── Wake up on fetch events — use this to restart reminder loop ───
// This ensures that even after the SW is terminated and restarted
// (e.g., by a background fetch), the reminder loop restarts.
let lastFetchWake = 0;

self.addEventListener('fetch', (e) => {
    if (e.request.method !== 'GET') return;

    const url = new URL(e.request.url);

    // On every fetch, check if we need to restart the reminder loop
    // (rate-limited to once per 30 seconds to avoid excessive IDB reads)
    const now = Date.now();
    if (now - lastFetchWake > 30000) {
        lastFetchWake = now;
        loadState().then(() => startReminderLoop());
    }

    if (url.hostname.includes('supabase.co') || url.hostname.includes('supabase.in')) {
        e.respondWith(fetch(e.request));
        return;
    }

    e.respondWith(
        fetch(e.request).then((response) => {
            if (response.status === 200) {
                const clone = response.clone();
                caches.open(CACHE_NAME).then((cache) => cache.put(e.request, clone));
            }
            return response;
        }).catch(() => {
            return caches.match(e.request).then((cached) => {
                if (cached) return cached;
                if (e.request.mode === 'navigate') {
                    return caches.match('./auth.html');
                }
            });
        })
    );
});

// ─── Periodic Background Sync ───
// This is the KEY mechanism for background notifications when the app is closed.
// The browser wakes the SW periodically (minimum ~12 hours on most browsers,
// but often more frequently for installed PWAs with high engagement).
self.addEventListener('periodicsync', (e) => {
    if (e.tag === 'check-reminders') {
        e.waitUntil(
            loadState().then(() => checkAllReminders())
        );
    }
});

// ─── Push event fallback ───
// If a push server is added later, this handles incoming push messages.
// For now, it also serves as a wake-up trigger.
self.addEventListener('push', (e) => {
    e.waitUntil(
        loadState().then(() => checkAllReminders())
    );
});
