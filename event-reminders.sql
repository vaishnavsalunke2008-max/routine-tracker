-- ============================================
-- Routine Tracker: Event Reminders Table Setup
-- Run this in Supabase Dashboard → SQL Editor
-- ============================================

-- 1. Table: event_reminders
CREATE TABLE IF NOT EXISTS event_reminders (
  id TEXT NOT NULL,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  name TEXT NOT NULL,
  event_date DATE NOT NULL,
  event_time TEXT,
  yearly BOOLEAN DEFAULT false,
  last_notified DATE,
  PRIMARY KEY (user_id, id)
);

-- 2. RLS policies
ALTER TABLE event_reminders ENABLE ROW LEVEL SECURITY;

-- Event reminders: users can manage their own
CREATE POLICY "Users manage own event reminders"
  ON event_reminders FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- 3. Grant access to service role for Edge Functions
GRANT ALL ON event_reminders TO service_role;
GRANT ALL ON event_reminders TO authenticated;
