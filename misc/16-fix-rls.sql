-- ════════════════════════════════════════════════════════════════════════
-- SIGIL · RLS Policy Fix for Auth Registration
-- Run in Supabase SQL Editor.
-- Trigger functions with SECURITY DEFINER bypass RLS, but the trigger
-- must exist and function correctly for auth to create users.
-- ════════════════════════════════════════════════════════════════════════

-- 1. Grant necessary permissions to the trigger function
ALTER FUNCTION public.handle_new_user() SECURITY DEFINER SET search_path = '';

-- 2. Drop existing policies then create them
DROP POLICY IF EXISTS "Users can view own profile" ON profiles;
DROP POLICY IF EXISTS "Users can update own profile" ON profiles;
DROP POLICY IF EXISTS "Trigger can insert profiles" ON profiles;
DROP POLICY IF EXISTS "Users can insert own profile" ON profiles;

CREATE POLICY "Users can view own profile"
  ON profiles FOR SELECT
  USING (auth.uid() = id);

CREATE POLICY "Trigger can insert profiles"
  ON profiles FOR INSERT
  WITH CHECK (true);

-- 3. Verify RLS is enabled on profiles
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

-- 4. Confirm the trigger function references are valid
SELECT proname, prosecdef
  FROM pg_proc
  WHERE proname = 'handle_new_user';