const CACHE_NAME = 'routine-tracker-v6';
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

// ─── Reminder State (lives in service worker scope) ───
let habitReminders = [];     // [{id, name, reminderTime, completed}]
let dailyReminder = null;    // {enabled, time}  — the global daily reminder
let firedToday = {};         // {reminderId: dateString} — prevents re-firing same day
let reminderCheckInterval = null;

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
        )
    );
    self.clients.claim();
    startReminderLoop();
});

// ─── Message handler — receive data from the app ───
self.addEventListener('message', (e) => {
    const msg = e.data;
    if (!msg || !msg.type) return;

    if (msg.type === 'UPDATE_HABIT_REMINDERS') {
        // App sends: {type, habits: [{id, name, reminderTime, completed}]}
        habitReminders = msg.habits || [];
        startReminderLoop();
    }

    if (msg.type === 'UPDATE_DAILY_REMINDER') {
        // App sends: {type, enabled, time}
        dailyReminder = { enabled: msg.enabled, time: msg.time };
        startReminderLoop();
    }

    if (msg.type === 'MARK_COMPLETED') {
        // App tells SW a habit was completed — stop reminding
        const id = msg.habitId;
        habitReminders = habitReminders.map(h =>
            h.id === id ? { ...h, completed: true } : h
        );
    }

    if (msg.type === 'PING') {
        // Keep-alive ping from the app
        startReminderLoop();
    }
});

// ─── Start the reminder check loop ───
function startReminderLoop() {
    if (reminderCheckInterval) clearInterval(reminderCheckInterval);
    // Check every 15 seconds for due reminders
    reminderCheckInterval = setInterval(checkAllReminders, 15000);
    // Also run immediately
    checkAllReminders();
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
    for (const key of Object.keys(firedToday)) {
        if (firedToday[key] !== today) {
            delete firedToday[key];
        }
    }
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
        if (firedToday[reminderId] === today) return; // Already fired today

        const [h, m] = habit.reminderTime.split(':').map(Number);
        const targetMinutes = h * 60 + m;

        // Fire if we're at or past the target time (within a 5-minute window to avoid missing)
        if (nowMinutes >= targetMinutes && nowMinutes <= targetMinutes + 5) {
            firedToday[reminderId] = today;
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

// ─── Fetch — network-first for Supabase, cache-first for everything else ───
self.addEventListener('fetch', (e) => {
    if (e.request.method !== 'GET') return;

    const url = new URL(e.request.url);

    if (url.hostname.includes('supabase.co') || url.hostname.includes('supabase.in')) {
        e.respondWith(fetch(e.request));
        return;
    }

    e.respondWith(
        caches.match(e.request).then((cached) => {
            return cached || fetch(e.request).then((response) => {
                if (response.status === 200) {
                    const clone = response.clone();
                    caches.open(CACHE_NAME).then((cache) => cache.put(e.request, clone));
                }
                return response;
            });
        }).catch(() => {
            if (e.request.mode === 'navigate') {
                return caches.match('./auth.html');
            }
        })
    );
});
