
CREATE POLICY "Anon can lookup email by username"
ON public.profiles
FOR SELECT
TO anon
USING (username IS NOT NULL);
