const { createClient } = require('@supabase/supabase-js');
const supabase = createClient('https://sucywzycbaknqzekcfoa.supabase.co', 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InN1Y3l3enljYmFrbnF6ZWtjZm9hIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3MzI4NjkxNiwiZXhwIjoyMDg4ODYyOTE2fQ.eyGqK_yJQ-ihVIILxdGo-iyD3dwhpBQpVZOBIXXKUg4');

async function test() {
  const { error } = await supabase.from('push_subscriptions').upsert({
    user_id: 'b74378e1-559b-4302-817d-24f2d496fd0e', // the user id from earlier debug logs!
    endpoint: 'https://test.com',
    p256dh: 'test',
    auth: 'test',
    timezone_offset: 330
  });
  console.log('Error:', error);
}
test();
