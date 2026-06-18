CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  requested public.app_role;
  owner_otp_verified BOOLEAN;
BEGIN
  requested := COALESCE((NEW.raw_user_meta_data->>'requested_role')::public.app_role, 'technician');

  SELECT EXISTS (
    SELECT 1
    FROM public.otp_verifications
    WHERE purpose = 'owner_register'
      AND lower(email) = lower(NEW.email)
      AND verified_at IS NOT NULL
      AND expires_at > now()
  ) INTO owner_otp_verified;

  IF requested = 'owner' AND NOT owner_otp_verified THEN
    requested := 'technician';
  END IF;

  INSERT INTO public.profiles (id, full_name, email, requested_role, is_approved, username)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.email),
    NEW.email,
    requested,
    CASE WHEN requested = 'owner' AND owner_otp_verified THEN TRUE ELSE FALSE END,
    NULLIF(NEW.raw_user_meta_data->>'username', '')
  );

  IF requested = 'owner' AND owner_otp_verified THEN
    INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, 'owner')
    ON CONFLICT (user_id, role) DO NOTHING;
  END IF;

  RETURN NEW;
END;
$function$;