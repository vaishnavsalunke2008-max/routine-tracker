-- ============================================
-- Routine Tracker: Push Notifications Setup
-- Run this in Supabase Dashboard → SQL Editor
-- ============================================

-- 1. Table: push_subscriptions
CREATE TABLE IF NOT EXISTS push_subscriptions (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  endpoint TEXT NOT NULL,
  p256dh TEXT NOT NULL,
  auth TEXT NOT NULL,
  timezone_offset INTEGER DEFAULT 0,  -- User's timezone offset in minutes from UTC (e.g. IST = 330)
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(user_id, endpoint)
);

-- 2. Table: habit_reminders
CREATE TABLE IF NOT EXISTS habit_reminders (
  id TEXT NOT NULL,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  name TEXT NOT NULL,
  reminder_time TEXT NOT NULL,
  completed BOOLEAN DEFAULT false,
  last_notified DATE,
  PRIMARY KEY (user_id, id)
);

-- 2.5 Table: user_habits (Full Backup Sync)
CREATE TABLE IF NOT EXISTS user_habits (
  id TEXT NOT NULL,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  name TEXT NOT NULL,
  category TEXT,
  timed BOOLEAN DEFAULT false,
  reminder_time TEXT,
  is_daily BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  PRIMARY KEY (user_id, id)
);

-- 3. RLS policies
ALTER TABLE push_subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE habit_reminders ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_habits ENABLE ROW LEVEL SECURITY;

-- Push subscriptions: users can manage their own
CREATE POLICY "Users manage own push subscriptions"
  ON push_subscriptions FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Habit reminders: users can manage their own
CREATE POLICY "Users manage own reminders"
  ON habit_reminders FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- User habits: users can manage their own
CREATE POLICY "Users manage own habits"
  ON user_habits FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- 4. Grant access to service role for Edge Functions
-- (service_role bypasses RLS by default, so this is just for safety)
GRANT ALL ON push_subscriptions TO service_role;
GRANT ALL ON habit_reminders TO service_role;
GRANT ALL ON user_habits TO service_role;
GRANT ALL ON push_subscriptions TO authenticated;
GRANT ALL ON habit_reminders TO authenticated;
GRANT ALL ON user_habits TO authenticated;

-- ============================================
-- MIGRATION: If tables already exist, add timezone_offset column
-- ============================================
-- Run this if you already created the tables before:
-- ALTER TABLE push_subscriptions ADD COLUMN IF NOT EXISTS timezone_offset INTEGER DEFAULT 0;

-- ============================================
-- CRON: Schedule the Edge Function (requires pg_cron + pg_net extensions)
-- ============================================
-- Enable extensions first:
-- CREATE EXTENSION IF NOT EXISTS pg_cron;
-- CREATE EXTENSION IF NOT EXISTS pg_net;
--
-- Then schedule:
-- SELECT cron.schedule(
--   'check-habit-reminders',
--   '* * * * *',
--   $$
--   SELECT net.http_post(
--     url := 'https://sucywzycbaknqzekcfoa.supabase.co/functions/v1/send-reminders',
--     headers := jsonb_build_object(
--       'Content-Type', 'application/json',
--       'Authorization', 'Bearer <SERVICE_ROLE_KEY>'
--     )
--   );
--   $$
-- );
