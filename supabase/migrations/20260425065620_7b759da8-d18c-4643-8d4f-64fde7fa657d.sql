CREATE OR REPLACE FUNCTION public.trigger_push_on_status_change()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  function_url text;
  request_id bigint;
BEGIN
  IF OLD.status IS DISTINCT FROM NEW.status THEN
    function_url := 'https://njytakdtmaudolpovvbg.supabase.co/functions/v1/notify-status-change';

    SELECT net.http_post(
      url := function_url,
      headers := jsonb_build_object(
        'Content-Type', 'application/json'
      ),
      body := jsonb_build_object(
        'ticket_number', NEW.ticket_number,
        'old_status', OLD.status,
        'new_status', NEW.status,
        'customer_name', NEW.customer_name,
        'order_id', NEW.id
      ),
      timeout_milliseconds := 5000
    ) INTO request_id;
  END IF;

  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  RAISE WARNING 'Push notification trigger failed: %', SQLERRM;
  RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS on_service_order_status_change ON public.service_orders;

CREATE TRIGGER on_service_order_status_change
AFTER UPDATE OF status ON public.service_orders
FOR EACH ROW
WHEN (OLD.status IS DISTINCT FROM NEW.status)
EXECUTE FUNCTION public.trigger_push_on_status_change();