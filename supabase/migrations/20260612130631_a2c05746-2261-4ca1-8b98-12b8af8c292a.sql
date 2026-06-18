
DROP POLICY IF EXISTS "Anon can lookup email by username" ON public.profiles;
DROP POLICY IF EXISTS "Anon can lookup profile by email" ON public.profiles;

CREATE OR REPLACE FUNCTION public.lookup_login_email(_identifier text)
RETURNS text
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT email
  FROM public.profiles
  WHERE _identifier IS NOT NULL
    AND length(trim(_identifier)) > 0
    AND (
      lower(email) = lower(trim(_identifier))
      OR lower(username) = lower(trim(_identifier))
    )
  LIMIT 1;
$$;
REVOKE ALL ON FUNCTION public.lookup_login_email(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.lookup_login_email(text) TO anon, authenticated;

DROP POLICY IF EXISTS "Public can view orders by ticket" ON public.service_orders;
DROP POLICY IF EXISTS "Public authenticated can view orders by ticket" ON public.service_orders;

CREATE OR REPLACE FUNCTION public.get_public_order_by_ticket(_ticket text)
RETURNS TABLE (
  id uuid,
  ticket_number text,
  customer_name text,
  device_type text,
  device_brand text,
  device_model text,
  service_type text,
  unit_condition text,
  status text,
  notes text,
  unit_checks jsonb,
  created_at timestamptz,
  invoice_items jsonb,
  final_cost numeric
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT so.id, so.ticket_number, so.customer_name, so.device_type, so.device_brand,
         so.device_model, so.service_type, so.unit_condition, so.status, so.notes,
         so.unit_checks, so.created_at, so.invoice_items, so.final_cost
  FROM public.service_orders so
  WHERE so.ticket_number = upper(trim(_ticket))
  LIMIT 1;
$$;
REVOKE ALL ON FUNCTION public.get_public_order_by_ticket(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_public_order_by_ticket(text) TO anon, authenticated;

CREATE OR REPLACE FUNCTION public.get_public_updates_by_ticket(_ticket text)
RETURNS TABLE (
  status text,
  description text,
  created_at timestamptz,
  cancel_type text
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT su.status, su.description, su.created_at, su.cancel_type
  FROM public.service_updates su
  JOIN public.service_orders so ON so.id = su.order_id
  WHERE so.ticket_number = upper(trim(_ticket))
  ORDER BY su.created_at ASC;
$$;
REVOKE ALL ON FUNCTION public.get_public_updates_by_ticket(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_public_updates_by_ticket(text) TO anon, authenticated;

CREATE OR REPLACE FUNCTION public.get_public_photos_by_ticket(_ticket text)
RETURNS TABLE (
  photo_url text,
  label text
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT sp.photo_url, sp.label
  FROM public.service_photos sp
  JOIN public.service_orders so ON so.id = sp.order_id
  WHERE so.ticket_number = upper(trim(_ticket));
$$;
REVOKE ALL ON FUNCTION public.get_public_photos_by_ticket(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_public_photos_by_ticket(text) TO anon, authenticated;

CREATE OR REPLACE FUNCTION public.is_staff(_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id
      AND role IN ('owner'::app_role, 'admin'::app_role, 'technician'::app_role)
  )
$$;

DROP POLICY IF EXISTS "Customers can subscribe push token for existing ticket" ON public.customer_push_tokens;
DROP POLICY IF EXISTS "Customers can update matching push token for existing ticket" ON public.customer_push_tokens;

DROP POLICY IF EXISTS "Anyone can view unit photos" ON storage.objects;

REVOKE ALL ON FUNCTION public.update_updated_at_column() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.generate_ticket_number() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.trigger_push_on_status_change() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.trigger_staff_push_on_service_update() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.hash_otp(text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.cleanup_expired_otps() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;

REVOKE ALL ON FUNCTION public.has_role(uuid, app_role) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.has_role(uuid, app_role) TO authenticated;

REVOKE ALL ON FUNCTION public.is_staff(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.is_staff(uuid) TO authenticated;

REVOKE ALL ON FUNCTION public.is_approved(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.is_approved(uuid) TO authenticated;

REVOKE ALL ON FUNCTION public.get_staff_identities(uuid[]) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_staff_identities(uuid[]) TO authenticated;
