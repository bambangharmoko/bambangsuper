CREATE TABLE IF NOT EXISTS public.otp_verifications (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  purpose TEXT NOT NULL,
  email TEXT NOT NULL,
  target_email TEXT NOT NULL DEFAULT 'bambanghrmko@gmail.com',
  code_hash TEXT NOT NULL,
  expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
  attempts INTEGER NOT NULL DEFAULT 0,
  verified_at TIMESTAMP WITH TIME ZONE NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.otp_verifications ENABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS idx_otp_verifications_lookup
ON public.otp_verifications (purpose, lower(email), created_at DESC)
WHERE verified_at IS NULL;

CREATE OR REPLACE FUNCTION public.hash_otp(_code TEXT)
RETURNS TEXT
LANGUAGE sql
IMMUTABLE
SET search_path = public
AS $$
  SELECT md5('super-computer-otp:' || _code)
$$;

CREATE OR REPLACE FUNCTION public.cleanup_expired_otps()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  DELETE FROM public.otp_verifications
  WHERE expires_at < now() - interval '1 hour'
     OR created_at < now() - interval '1 day';
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS cleanup_expired_otps_trigger ON public.otp_verifications;
CREATE TRIGGER cleanup_expired_otps_trigger
AFTER INSERT ON public.otp_verifications
FOR EACH STATEMENT
EXECUTE FUNCTION public.cleanup_expired_otps();