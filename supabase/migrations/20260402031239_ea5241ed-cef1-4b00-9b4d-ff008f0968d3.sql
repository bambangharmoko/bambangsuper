CREATE POLICY "Anon can lookup profile by email"
ON public.profiles
FOR SELECT
TO anon
USING (email IS NOT NULL);