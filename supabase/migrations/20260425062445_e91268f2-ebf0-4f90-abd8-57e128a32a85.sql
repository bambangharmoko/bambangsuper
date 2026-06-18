CREATE EXTENSION IF NOT EXISTS http WITH SCHEMA extensions;

CREATE OR REPLACE FUNCTION public.trigger_push_on_status_change()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  function_url TEXT;
BEGIN
  IF OLD.status IS DISTINCT FROM NEW.status THEN
    function_url := 'https://njytakdtmaudolpovvbg.supabase.co/functions/v1/notify-status-change';

    PERFORM extensions.http_post(
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
      )
    );
  END IF;

  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  RAISE WARNING 'Push notification trigger failed: %', SQLERRM;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_service_order_status_change ON public.service_orders;
CREATE TRIGGER on_service_order_status_change
AFTER UPDATE OF status ON public.service_orders
FOR EACH ROW
WHEN (OLD.status IS DISTINCT FROM NEW.status)
EXECUTE FUNCTION public.trigger_push_on_status_change();

DROP TRIGGER IF EXISTS update_customer_push_tokens_updated_at ON public.customer_push_tokens;
CREATE TRIGGER update_customer_push_tokens_updated_at
BEFORE UPDATE ON public.customer_push_tokens
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();