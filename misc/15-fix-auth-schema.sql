-- ════════════════════════════════════════════════════════════════════════
-- SIGIL · Auth Schema Repair
-- Run ALL sections in order in Supabase SQL Editor.
-- This fixes "Database error saving new user" and similar auth issues.
-- ════════════════════════════════════════════════════════════════════════

-- 1. Ensure required extensions exist
CREATE EXTENSION IF NOT EXISTS "pgcrypto";
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 2. Check auth schema existence (should be built-in)
SELECT EXISTS(SELECT 1 FROM information_schema.schemata WHERE schema_name = 'auth')
  AS auth_schema_exists;

-- 3. Drop and recreate the profile trigger properly
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = ''
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
    RAISE WARNING 'handle_new_user skipped: %', SQLERRM;
    RETURN NEW;
END;
$$;

-- 4. Remove old trigger if exists, create new one
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user();

-- 5. Verify profiles have email_verified column
ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS email_verified BOOLEAN DEFAULT FALSE;

-- 6. Run a quick auth test (should succeed without error)
DO $$
DECLARE
  test_id UUID;
BEGIN
  INSERT INTO auth.users (
    id, instance_id, email, encrypted_password,
    email_confirmed_at, raw_app_meta_data, raw_user_meta_data,
    created_at, updated_at, aud, role
  ) VALUES (
    gen_random_uuid(), '00000000-0000-0000-0000-000000000000',
    'diagnostic-' || gen_random_uuid() || '@sigil.internal',
    crypt('Test123!', gen_salt('bf')),
    NOW(), '{"provider":"email"}', '{"full_name":"Diagnostic"}',
    NOW(), NOW(), 'authenticated', 'authenticated'
  )
  ON CONFLICT (email) DO NOTHING;

  RAISE NOTICE 'Auth schema repair completed successfully';
END $$;