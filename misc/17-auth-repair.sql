-- ════════════════════════════════════════════════════════════════════════
-- SIGIL · Auth Schema Repair — run ALL lines in Supabase SQL Editor
-- Fixed "Database error creating new user" / "Database error saving new user"
-- ════════════════════════════════════════════════════════════════════════

-- 1. Extensions needed by auth
CREATE EXTENSION IF NOT EXISTS pgcrypto WITH SCHEMA extensions;
CREATE EXTENSION IF NOT EXISTS "uuid-ossp" WITH SCHEMA extensions;

-- 2. Verify auth schema exists (should be built-in)
CREATE SCHEMA IF NOT EXISTS auth;

-- 3. Drop and recreate the trigger function (handles profile creation)
--    This is the most common cause of the "Database error" issue
--    The function must use SECURITY DEFINER to bypass RLS
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = 'public'
AS $$
BEGIN
  INSERT INTO public.profiles (id, email, full_name)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(
      NEW.raw_user_meta_data ->> 'full_name',
      NEW.raw_user_meta_data ->> 'name',
      split_part(NEW.email, '@', 1)
    )
  );
  RETURN NEW;
EXCEPTION
  WHEN unique_violation THEN
    RETURN NEW;
  WHEN foreign_key_violation THEN
    RETURN NEW;
  WHEN others THEN
    RAISE WARNING 'handle_new_user error (non-fatal): %', SQLERRM;
    RETURN NEW;
END;
$$;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user();

-- 4. Grant auth schema permissions to service role and authenticator
GRANT USAGE ON SCHEMA auth TO service_role, authenticator;
GRANT ALL ON ALL TABLES IN SCHEMA auth TO service_role, authenticator;
GRANT ALL ON ALL SEQUENCES IN SCHEMA auth TO service_role, authenticator;

-- 5. Grant public schema permissions
GRANT USAGE ON SCHEMA public TO service_role, authenticator, anon;
GRANT ALL ON ALL TABLES IN SCHEMA public TO service_role;

-- 5. Ensure profiles table has all required columns
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS email_verified BOOLEAN DEFAULT FALSE;

-- 6. RLS policies for profiles
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view own profile" ON public.profiles;
DROP POLICY IF EXISTS "Users can update own profile" ON public.profiles;
DROP POLICY IF EXISTS "Trigger can insert profiles" ON public.profiles;

CREATE POLICY "Users can view own profile"
  ON public.profiles FOR SELECT
  USING (auth.uid() = id);

CREATE POLICY "Users can update own profile"
  ON public.profiles FOR UPDATE
  USING (auth.uid() = id);

CREATE POLICY "Trigger can insert profiles"
  ON public.profiles FOR INSERT
  WITH CHECK (true);

-- 7. Diagnostic: check auth schema version
SELECT * FROM auth.schema_version ORDER BY version DESC LIMIT 5;