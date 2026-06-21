CREATE OR REPLACE FUNCTION public.get_public_order_by_ticket(_ticket text)
 RETURNS TABLE(id uuid, ticket_number text, customer_name text, device_type text, device_brand text, device_model text, service_type text, unit_condition text, status public.service_status, notes text, unit_checks jsonb, created_at timestamp with time zone, invoice_items jsonb, final_cost numeric, warranty_duration integer, warranty_unit text, warranty_expiry timestamp with time zone, warranty_notes text)
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
BEGIN
  RETURN QUERY
  SELECT 
    so.id,
    so.ticket_number,
    so.customer_name,
    so.device_type,
    so.device_brand,
    so.device_model,
    so.service_type,
    so.unit_condition,
    so.status,
    so.notes,
    so.unit_checks,
    so.created_at,
    so.invoice_items,
    so.final_cost,
    so.warranty_duration,
    so.warranty_unit,
    so.warranty_expiry,
    so.warranty_notes
  FROM public.service_orders so
  WHERE so.ticket_number = _ticket AND so.deleted_at IS NULL;
END;
$function$;

GRANT EXECUTE ON FUNCTION public.get_public_order_by_ticket(text) TO anon, authenticated;
