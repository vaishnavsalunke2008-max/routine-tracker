const webpush = require('web-push');

const VAPID_PUBLIC_KEY = 'BFWyZ6MEFHssDn60mInJAdhvq_T-xPCV4uMCNi3KJZWT5Ke0_CwtG8WN5LyN_np565XX3obm9uAplylcR5S1A_g';
const VAPID_PRIVATE_KEY = 'T4hBiMB6oobeBUIeUlaBQmmsJM6foBfhfB3pRkFwoL4';
const VAPID_SUBJECT = 'mailto:test@example.com';

webpush.setVapidDetails(VAPID_SUBJECT, VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY);

const sub = {
  endpoint: 'https://fcm.googleapis.com/wp/fxHJEqg_2z8:APA91bFKSswz2sBZaP0Jk-1dX084I90_3hjzQQ3kRabPciYFvUTm5-OGp5K6VLgfLgVAKlyXi1bRjIyBlP7X0xIEzR-KMnpoB5UqDha6s0Q6OkYGUWxf4xf6q2KlTLzzaXG-hYkVIJR5',
  keys: {
    p256dh: 'BMNLI_qaingIXPjc99cgv752qHnYlkx9o3zGi6A92BF6OA3Q1IahtFdzrsBQBiXL07pBAKYbGZ4YXcHoQl-nwzw',
    auth: 'sbcy8gbYhYKdQT01-bF5Tg'
  }
};

const payload = JSON.stringify({
  title: 'TEST NOTIFICATION',
  body: 'If you see this, background notifications WORK!',
  icon: '/icons/icon-192.png'
});

webpush.sendNotification(sub, payload)
  .then(res => console.log('Success:', res.statusCode))
  .catch(err => console.error('Error:', err.statusCode, err.body));
