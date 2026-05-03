// Supabase Edge Function: send-reminders
// Deploy: supabase functions deploy send-reminders
// Secrets needed:
//   VAPID_PRIVATE_KEY  (the private key from web-push generate-vapid-keys)
//   VAPID_PUBLIC_KEY   (the public key)
//   VAPID_SUBJECT      (mailto:your@email.com)
//
// Called every minute by cron-job.org

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import webpush from 'npm:web-push@3.6.7';

const VAPID_PUBLIC_KEY = Deno.env.get('VAPID_PUBLIC_KEY')!;
const VAPID_PRIVATE_KEY = Deno.env.get('VAPID_PRIVATE_KEY')!;
const VAPID_SUBJECT = Deno.env.get('VAPID_SUBJECT') || 'mailto:routinetracker@example.com';
const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

// Configure web-push with VAPID keys
webpush.setVapidDetails(VAPID_SUBJECT, VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY);

// ─── Main handler ───
Deno.serve(async (_req) => {
  try {
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    const now = new Date();
    const today = now.toISOString().slice(0, 10);

    // Get ALL reminders that haven't been notified today (or ever)
    const { data: reminders, error: remErr } = await supabase
      .from('habit_reminders')
      .select('*')
      .eq('completed', false)
      .or(`last_notified.is.null,last_notified.neq.${today}`);

    if (remErr) {
      console.error('Error fetching reminders:', remErr);
      return new Response(JSON.stringify({ error: remErr.message }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    if (!reminders || reminders.length === 0) {
      return new Response(JSON.stringify({ message: 'No due reminders', now: now.toISOString(), today }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    let sentCount = 0;
    let errorCount = 0;
    const debugLogs: string[] = [];

    for (const reminder of reminders) {
      const userId = reminder.user_id;

      // Get the user's push subscriptions (and timezone)
      const { data: subs, error: subErr } = await supabase
        .from('push_subscriptions')
        .select('*')
        .eq('user_id', userId);

      if (subErr || !subs || subs.length === 0) {
        debugLogs.push(`User ${userId} | Habit: ${reminder.name} | No push subscriptions found, skipping.`);
        continue;
      }

      // Use the timezone from the first subscription (all same user = same timezone)
      const userTimezoneOffset = subs[0].timezone_offset ?? 330; // default IST (+5:30 = 330 min)

      // Calculate the user's current local time
      // UTC time + offset = local time
      const userLocalMs = now.getTime() + userTimezoneOffset * 60 * 1000;
      const userLocalDate = new Date(userLocalMs);
      const userHour = userLocalDate.getUTCHours();
      const userMinute = userLocalDate.getUTCMinutes();
      const userNowMinutes = userHour * 60 + userMinute;

      // Parse reminder time (stored as "HH:MM" in user's local time)
      const [rH, rM] = reminder.reminder_time.split(':').map(Number);
      const reminderMinutes = rH * 60 + rM;

      const logMsg = `User ${userId} | Habit: ${reminder.name} | TZ: +${userTimezoneOffset}min | Local Time: ${String(userHour).padStart(2,'0')}:${String(userMinute).padStart(2,'0')} | Target: ${String(rH).padStart(2,'0')}:${String(rM).padStart(2,'0')}`;
      console.log(logMsg);
      debugLogs.push(logMsg);

      // IMPORTANT: Fire if we're AT or PAST the target time (within today).
      // This ensures the notification fires even if cron is late.
      // The `last_notified` field prevents duplicate notifications for the same day.
      if (userNowMinutes < reminderMinutes) {
        debugLogs.push(`  -> Skipped. Not yet time (${userNowMinutes} < ${reminderMinutes}).`);
        continue;
      }

      debugLogs.push(`  -> Time matched! Sending push to ${subs.length} device(s)...`);

      // Build the notification payload
      const notificationPayload = JSON.stringify({
        title: reminder.name,
        body: `⏰ It's time for: ${reminder.name}`,
        icon: '/icons/icon-192.png',
        badge: '/icons/icon-192.png',
        tag: `habit-${reminder.id}-${today}`,
        data: { habitId: reminder.id, type: 'habit' },
      });

      // Send to all user's devices
      for (const sub of subs) {
        const pushSubscription = {
          endpoint: sub.endpoint,
          keys: {
            p256dh: sub.p256dh,
            auth: sub.auth,
          },
        };

        try {
          const result = await webpush.sendNotification(pushSubscription, notificationPayload, {
            TTL: 86400,
          });
          sentCount++;
          const successMsg = `  ✓ Push sent to device ${sub.id} (status: ${result.statusCode})`;
          console.log(successMsg);
          debugLogs.push(successMsg);
        } catch (err: any) {
          errorCount++;
          const errMsg = `  ✗ Push FAILED for device ${sub.id}: ${err.statusCode} ${err.body || err.message}`;
          console.error(errMsg);
          debugLogs.push(errMsg);

          // Remove expired/invalid subscriptions (410 Gone, 404 Not Found)
          if (err.statusCode === 410 || err.statusCode === 404) {
            console.log(`  Removing expired subscription ${sub.id}`);
            debugLogs.push(`  Removing expired subscription ${sub.id}`);
            await supabase
              .from('push_subscriptions')
              .delete()
              .eq('id', sub.id);
          }
        }
      }

      // Mark as notified today (prevents duplicate sends)
      await supabase
        .from('habit_reminders')
        .update({ last_notified: today })
        .eq('user_id', userId)
        .eq('id', reminder.id);
      
      debugLogs.push(`  ✓ Marked reminder "${reminder.name}" as notified for ${today}`);
    }

    return new Response(
      JSON.stringify({
        message: `Processed ${reminders.length} reminders, sent ${sentCount} notifications, ${errorCount} errors`,
        serverTime: now.toISOString(),
        today,
        debugLogs,
      }),
      { status: 200, headers: { 'Content-Type': 'application/json' } }
    );
  } catch (err) {
    console.error('Function error:', err);
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
});
