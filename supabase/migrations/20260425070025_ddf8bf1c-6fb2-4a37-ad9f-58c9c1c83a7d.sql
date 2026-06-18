DROP POLICY IF EXISTS "Anyone can subscribe push token" ON public.customer_push_tokens;
DROP POLICY IF EXISTS "Anyone can update own push token" ON public.customer_push_tokens;
DROP POLICY IF EXISTS "Anyone can delete own push token" ON public.customer_push_tokens;

CREATE POLICY "Customers can subscribe push token for existing ticket"
ON public.customer_push_tokens
FOR INSERT
TO anon, authenticated
WITH CHECK (
  length(ticket_number) > 0
  AND length(fcm_token) > 0
  AND EXISTS (
    SELECT 1
    FROM public.service_orders so
    WHERE so.ticket_number = customer_push_tokens.ticket_number
  )
);

CREATE POLICY "Customers can update matching push token for existing ticket"
ON public.customer_push_tokens
FOR UPDATE
TO anon, authenticated
USING (
  length(ticket_number) > 0
  AND length(fcm_token) > 0
  AND EXISTS (
    SELECT 1
    FROM public.service_orders so
    WHERE so.ticket_number = customer_push_tokens.ticket_number
  )
)
WITH CHECK (
  length(ticket_number) > 0
  AND length(fcm_token) > 0
  AND EXISTS (
    SELECT 1
    FROM public.service_orders so
    WHERE so.ticket_number = customer_push_tokens.ticket_number
  )
);