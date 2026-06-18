-- Ensure role checks cannot be satisfied by unapproved profiles
CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role app_role)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles ur
    JOIN public.profiles p ON p.id = ur.user_id
    WHERE ur.user_id = _user_id
      AND ur.role = _role
      AND p.is_approved = TRUE
  )
$$;

REVOKE ALL ON FUNCTION public.has_role(uuid, app_role) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.has_role(uuid, app_role) TO authenticated;
GRANT EXECUTE ON FUNCTION public.has_role(uuid, app_role) TO service_role;

-- Add explicit approval checks to all policies that grant elevated access by role
ALTER POLICY "Owner can delete internal notes"
ON public.internal_notes
USING (public.has_role(auth.uid(), 'owner'::app_role) AND public.is_approved(auth.uid()));

ALTER POLICY "Admin can view all profiles"
ON public.profiles
USING (public.has_role(auth.uid(), 'admin'::app_role) AND public.is_approved(auth.uid()));

ALTER POLICY "Owner can delete profiles"
ON public.profiles
USING (public.has_role(auth.uid(), 'owner'::app_role) AND public.is_approved(auth.uid()));

ALTER POLICY "Owner can update any profile"
ON public.profiles
USING (public.has_role(auth.uid(), 'owner'::app_role) AND public.is_approved(auth.uid()));

ALTER POLICY "Owner can view all profiles"
ON public.profiles
USING (public.has_role(auth.uid(), 'owner'::app_role) AND public.is_approved(auth.uid()));

ALTER POLICY "Owner can delete orders"
ON public.service_orders
USING (public.has_role(auth.uid(), 'owner'::app_role) AND public.is_approved(auth.uid()));

ALTER POLICY "Owner can delete photos (owner)"
ON public.service_photos
USING (public.has_role(auth.uid(), 'owner'::app_role) AND public.is_approved(auth.uid()));

ALTER POLICY "Owner can delete updates"
ON public.service_updates
USING (public.has_role(auth.uid(), 'owner'::app_role) AND public.is_approved(auth.uid()));

ALTER POLICY "Admin can view all roles"
ON public.user_roles
USING (public.has_role(auth.uid(), 'admin'::app_role) AND public.is_approved(auth.uid()));

ALTER POLICY "Owner can delete roles"
ON public.user_roles
USING (public.has_role(auth.uid(), 'owner'::app_role) AND public.is_approved(auth.uid()));

ALTER POLICY "Owner can insert roles"
ON public.user_roles
WITH CHECK (public.has_role(auth.uid(), 'owner'::app_role) AND public.is_approved(auth.uid()));

ALTER POLICY "Owner can update roles"
ON public.user_roles
USING (public.has_role(auth.uid(), 'owner'::app_role) AND public.is_approved(auth.uid()))
WITH CHECK (public.has_role(auth.uid(), 'owner'::app_role) AND public.is_approved(auth.uid()));

ALTER POLICY "Owner can view all roles"
ON public.user_roles
USING (public.has_role(auth.uid(), 'owner'::app_role) AND public.is_approved(auth.uid()));

-- Explicitly deny direct browser writes to customer push tokens; edge functions use service role
DROP POLICY IF EXISTS "Customer push tokens browser inserts are denied" ON public.customer_push_tokens;
DROP POLICY IF EXISTS "Customer push tokens browser updates are denied" ON public.customer_push_tokens;
DROP POLICY IF EXISTS "Customer push tokens browser deletes are denied" ON public.customer_push_tokens;

CREATE POLICY "Customer push tokens browser inserts are denied"
ON public.customer_push_tokens
FOR INSERT
TO anon, authenticated
WITH CHECK (false);

CREATE POLICY "Customer push tokens browser updates are denied"
ON public.customer_push_tokens
FOR UPDATE
TO anon, authenticated
USING (false)
WITH CHECK (false);

CREATE POLICY "Customer push tokens browser deletes are denied"
ON public.customer_push_tokens
FOR DELETE
TO anon, authenticated
USING (false);

-- Restrict Realtime channel authorization to approved staff accounts
DROP POLICY IF EXISTS "Approved staff can receive realtime messages" ON realtime.messages;
DROP POLICY IF EXISTS "Approved staff can send realtime messages" ON realtime.messages;

CREATE POLICY "Approved staff can receive realtime messages"
ON realtime.messages
FOR SELECT
TO authenticated
USING (public.is_staff(auth.uid()) AND public.is_approved(auth.uid()));

CREATE POLICY "Approved staff can send realtime messages"
ON realtime.messages
FOR INSERT
TO authenticated
WITH CHECK (public.is_staff(auth.uid()) AND public.is_approved(auth.uid()));