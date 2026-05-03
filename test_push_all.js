const webpush = require('web-push');
const { createClient } = require('@supabase/supabase-js');

const VAPID_PUBLIC_KEY = 'BFWyZ6MEFHssDn60mInJAdhvq_T-xPCV4uMCNi3KJZWT5Ke0_CwtG8WN5LyN_np565XX3obm9uAplylcR5S1A_g';
const VAPID_PRIVATE_KEY = 'T4hBiMB6oobeBUIeUlaBQmmsJM6foBfhfB3pRkFwoL4';
const VAPID_SUBJECT = 'mailto:test@example.com';
webpush.setVapidDetails(VAPID_SUBJECT, VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY);

const supabase = createClient('https://sucywzycbaknqzekcfoa.supabase.co', 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InN1Y3l3enljYmFrbnF6ZWtjZm9hIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3MzI4NjkxNiwiZXhwIjoyMDg4ODYyOTE2fQ.eyGqK_yJQ-ihVIILxdGo-iyD3dwhpBQpVZOBIXXKUg4');

async function run() {
  const { data: subs, error } = await supabase.from('push_subscriptions').select('*').eq('user_id', 'b74378e1-559b-4302-817d-24f2d496fd0e');
  if (error || !subs) return console.error('Error fetching subs', error);
  console.log(`Found ${subs.length} subscriptions`);

  for (const sub of subs) {
    const pushSub = {
      endpoint: sub.endpoint,
      keys: { p256dh: sub.p256dh, auth: sub.auth }
    };
    const payload = JSON.stringify({
      title: 'INSTALLED APP TEST',
      body: 'It works on the installed app!',
      icon: '/icons/icon-192.png'
    });
    try {
      await webpush.sendNotification(pushSub, payload);
      console.log('Success sending to', sub.endpoint.substring(0, 40) + '...');
    } catch (e) {
      console.error('Failed sending to', sub.endpoint.substring(0, 40) + '...', e.statusCode);
      if (e.statusCode === 410 || e.statusCode === 404) {
        await supabase.from('push_subscriptions').delete().eq('id', sub.id);
      }
    }
  }
}

run();
