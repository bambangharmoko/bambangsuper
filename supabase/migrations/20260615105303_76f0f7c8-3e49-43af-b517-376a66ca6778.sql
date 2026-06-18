-- Standardize approval enforcement inside public.is_staff() and public.has_role()
ALTER POLICY "Staff can view all push tokens"
ON public.customer_push_tokens
USING (public.is_staff(auth.uid()));

ALTER POLICY "Owner can delete internal notes"
ON public.internal_notes
USING (public.has_role(auth.uid(), 'owner'::app_role));

ALTER POLICY "Staff can create internal notes"
ON public.internal_notes
WITH CHECK (public.is_staff(auth.uid()));

ALTER POLICY "Staff can update internal notes"
ON public.internal_notes
USING (public.is_staff(auth.uid()));

ALTER POLICY "Staff can view internal notes"
ON public.internal_notes
USING (public.is_staff(auth.uid()));

ALTER POLICY "Staff can create notifications"
ON public.notifications
WITH CHECK (public.is_staff(auth.uid()));

ALTER POLICY "Admin can view all profiles"
ON public.profiles
USING (public.has_role(auth.uid(), 'admin'::app_role));

ALTER POLICY "Owner can delete profiles"
ON public.profiles
USING (public.has_role(auth.uid(), 'owner'::app_role));

ALTER POLICY "Owner can update any profile"
ON public.profiles
USING (public.has_role(auth.uid(), 'owner'::app_role));

ALTER POLICY "Owner can view all profiles"
ON public.profiles
USING (public.has_role(auth.uid(), 'owner'::app_role));

ALTER POLICY "Staff can delete saved customers"
ON public.saved_customers
USING (public.is_staff(auth.uid()));

ALTER POLICY "Staff can insert saved customers"
ON public.saved_customers
WITH CHECK (public.is_staff(auth.uid()));

ALTER POLICY "Staff can update saved customers"
ON public.saved_customers
USING (public.is_staff(auth.uid()))
WITH CHECK (public.is_staff(auth.uid()));

ALTER POLICY "Staff can view saved customers"
ON public.saved_customers
USING (public.is_staff(auth.uid()));

ALTER POLICY "Admin and owner can create orders"
ON public.service_orders
WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role) OR public.has_role(auth.uid(), 'owner'::app_role));

ALTER POLICY "Owner can delete orders"
ON public.service_orders
USING (public.has_role(auth.uid(), 'owner'::app_role));

ALTER POLICY "Staff can update orders"
ON public.service_orders
USING (public.is_staff(auth.uid()));

ALTER POLICY "Staff can view all orders"
ON public.service_orders
USING (public.is_staff(auth.uid()));

ALTER POLICY "Owner can delete photos (owner)"
ON public.service_photos
USING (public.has_role(auth.uid(), 'owner'::app_role));

ALTER POLICY "Staff can delete photos"
ON public.service_photos
USING (public.is_staff(auth.uid()));

ALTER POLICY "Staff can insert photos"
ON public.service_photos
WITH CHECK (public.is_staff(auth.uid()));

ALTER POLICY "Staff can view all photos"
ON public.service_photos
USING (public.is_staff(auth.uid()));

ALTER POLICY "Owner can delete updates"
ON public.service_updates
USING (public.has_role(auth.uid(), 'owner'::app_role));

ALTER POLICY "Staff can create updates"
ON public.service_updates
WITH CHECK (public.is_staff(auth.uid()));

ALTER POLICY "Staff can view all updates"
ON public.service_updates
USING (public.is_staff(auth.uid()));

ALTER POLICY "Staff can create own push tokens"
ON public.staff_push_tokens
WITH CHECK ((user_id = auth.uid()) AND public.is_staff(auth.uid()));

ALTER POLICY "Staff can update own push tokens"
ON public.staff_push_tokens
USING ((user_id = auth.uid()) AND public.is_staff(auth.uid()))
WITH CHECK ((user_id = auth.uid()) AND public.is_staff(auth.uid()));

DROP POLICY IF EXISTS "Staff can delete own push tokens" ON public.staff_push_tokens;
CREATE POLICY "Staff can delete own push tokens"
ON public.staff_push_tokens
FOR DELETE
TO authenticated
USING ((user_id = auth.uid()) AND public.is_staff(auth.uid()));

ALTER POLICY "Admin can view all roles"
ON public.user_roles
USING (public.has_role(auth.uid(), 'admin'::app_role));

ALTER POLICY "Owner can delete roles"
ON public.user_roles
USING (public.has_role(auth.uid(), 'owner'::app_role));

ALTER POLICY "Owner can insert roles"
ON public.user_roles
WITH CHECK (public.has_role(auth.uid(), 'owner'::app_role));

ALTER POLICY "Owner can update roles"
ON public.user_roles
USING (public.has_role(auth.uid(), 'owner'::app_role))
WITH CHECK (public.has_role(auth.uid(), 'owner'::app_role));

ALTER POLICY "Owner can view all roles"
ON public.user_roles
USING (public.has_role(auth.uid(), 'owner'::app_role));

ALTER POLICY "Approved staff can receive realtime messages"
ON realtime.messages
USING (public.is_staff(auth.uid()));

ALTER POLICY "Approved staff can send realtime messages"
ON realtime.messages
WITH CHECK (public.is_staff(auth.uid()));

COMMENT ON FUNCTION public.has_role(uuid, app_role) IS 'Central role check for RLS; returns true only when the user has the requested role and the profile is approved.';
COMMENT ON FUNCTION public.is_staff(uuid) IS 'Central staff check for RLS; returns true only for owner/admin/technician roles with approved profiles.';