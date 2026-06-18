CREATE POLICY "Staff can update saved customers"
ON public.saved_customers
FOR UPDATE
TO authenticated
USING (is_staff(auth.uid()) AND is_approved(auth.uid()))
WITH CHECK (is_staff(auth.uid()) AND is_approved(auth.uid()));