-- ════════════════════════════════════════════════════════════════════════
-- SIGIL · Create user via SQL (bypasses broken GoTrue API)
-- Run this in Supabase SQL Editor, then the register API will work.
-- ════════════════════════════════════════════════════════════════════════

-- Create a function that creates auth users directly in the database
-- This bypasses the GoTrue API which is returning "Database error"
CREATE OR REPLACE FUNCTION public.create_auth_user(
  p_email TEXT,
  p_password TEXT,
  p_full_name TEXT,
  p_phone TEXT DEFAULT NULL,
  p_preferred_language TEXT DEFAULT 'he'
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = 'public, extensions'
AS $$
DECLARE
  v_user_id UUID := gen_random_uuid();
  v_encrypted_password TEXT;
  v_now TIMESTAMPTZ := NOW();
  v_result JSON;
BEGIN
  -- Check if user already exists
  IF EXISTS (SELECT 1 FROM auth.users WHERE email = p_email) THEN
    RETURN json_build_object(
      'error', 'User already registered',
      'code', 'user_exists'
    );
  END IF;

  -- Encrypt password using pgcrypto
  v_encrypted_password := crypt(p_password, gen_salt('bf'));

  -- Insert into auth.users
  INSERT INTO auth.users (
    id, instance_id, email, encrypted_password,
    email_confirmed_at, confirmation_sent_at,
    raw_app_meta_data, raw_user_meta_data,
    created_at, updated_at, aud, role
  ) VALUES (
    v_user_id, '00000000-0000-0000-0000-000000000000',
    p_email, v_encrypted_password,
    v_now, v_now,
    jsonb_build_object('provider', 'email', 'providers', ARRAY['email']),
    jsonb_build_object(
      'full_name', p_full_name,
      'phone', COALESCE(p_phone, ''),
      'preferred_language', p_preferred_language
    ),
    v_now, v_now, 'authenticated', 'authenticated'
  );

  -- Insert identity record (required for auth to work)
  INSERT INTO auth.identities (
    id, user_id, identity_data, provider, provider_id,
    created_at, updated_at, last_sign_in_at
  ) VALUES (
    v_user_id, v_user_id,
    jsonb_build_object('sub', v_user_id::TEXT, 'email', p_email),
    'email', p_email,
    v_now, v_now, v_now
  );

  -- Insert profile (in case trigger doesn't work)
  INSERT INTO public.profiles (
    id, email, full_name, phone, preferred_language,
    terms_accepted_at, privacy_accepted_at, created_at, updated_at
  ) VALUES (
    v_user_id, p_email, p_full_name,
    COALESCE(p_phone, ''), p_preferred_language,
    v_now, v_now, v_now, v_now
  )
  ON CONFLICT (id) DO UPDATE SET
    email = EXCLUDED.email,
    full_name = EXCLUDED.full_name,
    phone = EXCLUDED.phone,
    preferred_language = EXCLUDED.preferred_language,
    terms_accepted_at = EXCLUDED.terms_accepted_at,
    privacy_accepted_at = EXCLUDED.privacy_accepted_at;

  v_result := json_build_object('id', v_user_id, 'email', p_email);

  RETURN v_result;
EXCEPTION
  WHEN unique_violation THEN
    RETURN json_build_object('error', 'User already exists', 'code', 'unique_violation');
  WHEN OTHERS THEN
    RETURN json_build_object('error', SQLERRM, 'code', SQLSTATE);
END;
$$;