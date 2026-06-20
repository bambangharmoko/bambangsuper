CREATE OR REPLACE FUNCTION public.get_public_orders_by_phone(_phone text)
RETURNS TABLE (
  id uuid,
  ticket_number text,
  customer_name text,
  device_type text,
  device_brand text,
  device_model text,
  service_type text,
  status text,
  created_at timestamptz
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _clean_phone text;
  _local_phone text;
BEGIN
  -- Clean input to digits only
  _clean_phone := regexp_replace(_phone, '\D', '', 'g');
  
  IF _clean_phone IS NULL OR length(_clean_phone) < 5 THEN
    RETURN;
  END IF;

  -- Extract local number (remove leading 0 or 62)
  _local_phone := _clean_phone;
  IF _clean_phone LIKE '0%' THEN
    _local_phone := substring(_clean_phone from 2);
  ELSIF _clean_phone LIKE '62%' THEN
    _local_phone := substring(_clean_phone from 3);
  END IF;

  RETURN QUERY
  SELECT so.id, so.ticket_number, so.customer_name, so.device_type, so.device_brand,
         so.device_model, so.service_type, so.status::text, so.created_at
  FROM public.service_orders so
  WHERE 
    -- Match if clean DB phone equals clean input
    regexp_replace(so.customer_phone, '\D', '', 'g') = _clean_phone
    -- Or if clean DB phone contains the local number
    OR (length(_local_phone) >= 8 AND regexp_replace(so.customer_phone, '\D', '', 'g') LIKE '%' || _local_phone || '%')
    -- Or if raw DB phone matches variations directly
    OR so.customer_phone = _phone;
END;
$$;

REVOKE ALL ON FUNCTION public.get_public_orders_by_phone(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_public_orders_by_phone(text) TO anon, authenticated;
