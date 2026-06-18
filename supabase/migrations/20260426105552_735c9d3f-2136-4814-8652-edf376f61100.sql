DROP POLICY IF EXISTS "OTP records are backend only" ON public.otp_verifications;

CREATE POLICY "OTP records are backend only"
ON public.otp_verifications
FOR ALL
USING (false)
WITH CHECK (false);