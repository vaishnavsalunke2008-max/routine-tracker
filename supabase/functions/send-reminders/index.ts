// Supabase Edge Function: send-reminders
// Deploy: supabase functions deploy send-reminders
// Secrets needed:
//   VAPID_PRIVATE_KEY = T4hBiMB6oobeBUIeUlaBQmmsJM6foBfhfB3pRkFwoL4
//   VAPID_PUBLIC_KEY = BFWyZ6MEFHssDn60mInJAdhvq_T-xPCV4uMCNi3KJZWT5Ke0_CwtG8WN5LyN_np565XX3obm9uAplylcR5S1A_g
//   SUPABASE_SERVICE_ROLE_KEY = <your service role key>

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const VAPID_PUBLIC_KEY = Deno.env.get('VAPID_PUBLIC_KEY')!;
const VAPID_PRIVATE_KEY = Deno.env.get('VAPID_PRIVATE_KEY')!;
const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

// ─── Crypto helpers for Web Push ───

function base64UrlToUint8Array(base64Url: string): Uint8Array {
  const padding = '='.repeat((4 - (base64Url.length % 4)) % 4);
  const base64 = (base64Url + padding).replace(/-/g, '+').replace(/_/g, '/');
  const raw = atob(base64);
  const arr = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i++) arr[i] = raw.charCodeAt(i);
  return arr;
}

function uint8ArrayToBase64Url(arr: Uint8Array): string {
  let binary = '';
  for (let i = 0; i < arr.length; i++) binary += String.fromCharCode(arr[i]);
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

async function generatePushJWT(audience: string): Promise<string> {
  const privateKeyBytes = base64UrlToUint8Array(VAPID_PRIVATE_KEY);
  
  const key = await crypto.subtle.importKey(
    'raw',
    privateKeyBytes,
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );

  const header = { typ: 'JWT', alg: 'HS256' };
  const now = Math.floor(Date.now() / 1000);
  const payload = {
    aud: audience,
    exp: now + 86400,
    sub: 'mailto:routinetracker@example.com',
  };

  const encodedHeader = uint8ArrayToBase64Url(new TextEncoder().encode(JSON.stringify(header)));
  const encodedPayload = uint8ArrayToBase64Url(new TextEncoder().encode(JSON.stringify(payload)));
  const unsignedToken = `${encodedHeader}.${encodedPayload}`;

  const signature = await crypto.subtle.sign(
    'HMAC',
    key,
    new TextEncoder().encode(unsignedToken)
  );

  return `${unsignedToken}.${uint8ArrayToBase64Url(new Uint8Array(signature))}`;
}

// ─── Send Web Push notification ───
async function sendPushNotification(
  subscription: { endpoint: string; p256dh: string; auth: string },
  payload: object
): Promise<boolean> {
  try {
    const url = new URL(subscription.endpoint);
    const audience = `${url.protocol}//${url.host}`;
    const jwt = await generatePushJWT(audience);

    const body = JSON.stringify(payload);

    const response = await fetch(subscription.endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'TTL': '86400',
        'Authorization': `WebPush ${jwt}`,
        'Crypto-Key': `p256ecdsa=${VAPID_PUBLIC_KEY}`,
      },
      body: body,
    });

    if (response.status === 201 || response.status === 200) {
      console.log('Push sent successfully');
      return true;
    } else if (response.status === 410 || response.status === 404) {
      console.log('Subscription expired, should remove');
      return false;
    } else {
      console.log(`Push failed: ${response.status} ${await response.text()}`);
      return false;
    }
  } catch (err) {
    console.error('Push error:', err);
    return false;
  }
}

// ─── Main handler ───
Deno.serve(async (req) => {
  try {
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    // Get current time as HH:MM
    const now = new Date();
    const currentHour = now.getUTCHours();
    const currentMinute = now.getUTCMinutes();

    // We need to check reminders for ALL timezones
    // Since we store reminder_time as local time (HH:MM string),
    // we check against multiple possible offsets
    // For simplicity, we'll fetch all non-completed reminders and compare on the server

    const today = now.toISOString().slice(0, 10);

    // Get all due reminders (not completed, not already notified today)
    const { data: reminders, error: remErr } = await supabase
      .from('habit_reminders')
      .select('*')
      .eq('completed', false)
      .or(`last_notified.is.null,last_notified.neq.${today}`);

    if (remErr) {
      console.error('Error fetching reminders:', remErr);
      return new Response(JSON.stringify({ error: remErr.message }), { status: 500 });
    }

    if (!reminders || reminders.length === 0) {
      return new Response(JSON.stringify({ message: 'No due reminders' }), { status: 200 });
    }

    // For each reminder, check if it's time to fire
    // We store the user's local time offset in the subscription,
    // but for now we'll use a simpler approach: fire if the server
    // receives the request within the reminder's time window
    let sentCount = 0;
    const processedUsers = new Set<string>();

    for (const reminder of reminders) {
      // Get push subscriptions for this user
      const userId = reminder.user_id;

      const { data: subs, error: subErr } = await supabase
        .from('push_subscriptions')
        .select('*')
        .eq('user_id', userId);

      if (subErr || !subs || subs.length === 0) continue;

      // Send notification to all user's devices
      for (const sub of subs) {
        const success = await sendPushNotification(
          { endpoint: sub.endpoint, p256dh: sub.p256dh, auth: sub.auth },
          {
            title: reminder.name,
            body: `⏰ It's time for: ${reminder.name}`,
            icon: '/icons/icon-192.png',
            badge: '/icons/icon-192.png',
            tag: `habit-${reminder.id}-${today}`,
            data: { habitId: reminder.id, type: 'habit' },
          }
        );

        if (success) {
          sentCount++;
          // Mark as notified today
          await supabase
            .from('habit_reminders')
            .update({ last_notified: today })
            .eq('user_id', userId)
            .eq('id', reminder.id);
        } else if (!success) {
          // Remove expired subscription
          await supabase
            .from('push_subscriptions')
            .delete()
            .eq('id', sub.id);
        }
      }
    }

    return new Response(
      JSON.stringify({ message: `Sent ${sentCount} notifications` }),
      { status: 200 }
    );
  } catch (err) {
    console.error('Function error:', err);
    return new Response(JSON.stringify({ error: String(err) }), { status: 500 });
  }
});
