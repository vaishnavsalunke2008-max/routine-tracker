const { createClient } = require('@supabase/supabase-js');
const supabase = createClient('https://sucywzycbaknqzekcfoa.supabase.co', 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InN1Y3l3enljYmFrbnF6ZWtjZm9hIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3MzI4NjkxNiwiZXhwIjoyMDg4ODYyOTE2fQ.eyGqK_yJQ-ihVIILxdGo-iyD3dwhpBQpVZOBIXXKUg4');
const d = new Date(new Date().getTime() + 330 * 60000);
const h = d.getUTCHours().toString().padStart(2, '0');
const m = d.getUTCMinutes().toString().padStart(2, '0');
const time = `${h}:${m}`;
supabase.from('habit_reminders').update({reminder_time: time, last_notified: null}).eq('name', 'Agkdlfbbakkhd').then(() => console.log('Set to', time));
