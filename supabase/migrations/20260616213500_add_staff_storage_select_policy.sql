-- Add SELECT policy for staff on storage.objects to allow listing files in 'unit-photos' bucket
CREATE POLICY "Staff can view unit photos"
  ON storage.objects FOR SELECT
  TO authenticated
  USING (
    bucket_id = 'unit-photos'
    AND public.is_staff(auth.uid())
    AND public.is_approved(auth.uid())
  );
