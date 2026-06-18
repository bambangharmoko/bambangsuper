CREATE EXTENSION IF NOT EXISTS pg_net WITH SCHEMA extensions;

GRANT ALL ON public.customer_push_tokens TO service_role;
GRANT ALL ON public.staff_push_tokens TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.staff_push_tokens TO authenticated;

CREATE OR REPLACE FUNCTION public.trigger_push_on_status_change()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  function_url text;
  request_id bigint;
BEGIN
  IF OLD.status IS DISTINCT FROM NEW.status THEN
    function_url := 'https://wytbkueaymkpbwmbvkul.supabase.co/functions/v1/notify-status-change';

    SELECT net.http_post(
      url := function_url,
      headers := jsonb_build_object('Content-Type', 'application/json'),
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
$$;

CREATE OR REPLACE FUNCTION public.trigger_staff_push_on_service_update()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  function_url text;
  request_id bigint;
BEGIN
  function_url := 'https://wytbkueaymkpbwmbvkul.supabase.co/functions/v1/notify-staff-update';

  SELECT net.http_post(
    url := function_url,
    headers := jsonb_build_object('Content-Type', 'application/json'),
    body := jsonb_build_object(
      'update_id', NEW.id,
      'order_id', NEW.order_id,
      'status', NEW.status,
      'updated_by', NEW.updated_by
    ),
    timeout_milliseconds := 5000
  ) INTO request_id;

  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  RAISE WARNING 'Staff push notification trigger failed: %', SQLERRM;
  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.trigger_push_on_status_change() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.trigger_staff_push_on_service_update() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.trigger_push_on_status_change() TO service_role;
GRANT EXECUTE ON FUNCTION public.trigger_staff_push_on_service_update() TO service_role;

DROP TRIGGER IF EXISTS on_service_order_status_change ON public.service_orders;
CREATE TRIGGER on_service_order_status_change
AFTER UPDATE OF status ON public.service_orders
FOR EACH ROW
WHEN (OLD.status IS DISTINCT FROM NEW.status)
EXECUTE FUNCTION public.trigger_push_on_status_change();

DROP TRIGGER IF EXISTS on_service_update_staff_push ON public.service_updates;
CREATE TRIGGER on_service_update_staff_push
AFTER INSERT ON public.service_updates
FOR EACH ROW
EXECUTE FUNCTION public.trigger_staff_push_on_service_update();