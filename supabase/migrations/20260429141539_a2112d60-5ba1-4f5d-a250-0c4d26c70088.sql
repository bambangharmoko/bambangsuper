CREATE EXTENSION IF NOT EXISTS pg_net WITH SCHEMA extensions;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime'
      AND schemaname = 'public'
      AND tablename = 'service_orders'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.service_orders;
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime'
      AND schemaname = 'public'
      AND tablename = 'service_updates'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.service_updates;
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime'
      AND schemaname = 'public'
      AND tablename = 'internal_notes'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.internal_notes;
  END IF;
END $$;

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
  function_url := 'https://njytakdtmaudolpovvbg.supabase.co/functions/v1/notify-staff-update';

  SELECT extensions.net.http_post(
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

DROP TRIGGER IF EXISTS on_service_update_staff_push ON public.service_updates;
CREATE TRIGGER on_service_update_staff_push
AFTER INSERT ON public.service_updates
FOR EACH ROW
EXECUTE FUNCTION public.trigger_staff_push_on_service_update();

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
    function_url := 'https://njytakdtmaudolpovvbg.supabase.co/functions/v1/notify-status-change';

    SELECT extensions.net.http_post(
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

DROP TRIGGER IF EXISTS on_service_order_status_change ON public.service_orders;
CREATE TRIGGER on_service_order_status_change
AFTER UPDATE OF status ON public.service_orders
FOR EACH ROW
WHEN (OLD.status IS DISTINCT FROM NEW.status)
EXECUTE FUNCTION public.trigger_push_on_status_change();