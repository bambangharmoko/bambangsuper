CREATE TABLE IF NOT EXISTS public.staff_push_tokens (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  fcm_token text NOT NULL,
  user_agent text,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  UNIQUE (user_id, fcm_token)
);

ALTER TABLE public.staff_push_tokens ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Staff can view own push tokens" ON public.staff_push_tokens;
CREATE POLICY "Staff can view own push tokens"
ON public.staff_push_tokens
FOR SELECT
TO authenticated
USING (user_id = auth.uid());

DROP POLICY IF EXISTS "Staff can create own push tokens" ON public.staff_push_tokens;
CREATE POLICY "Staff can create own push tokens"
ON public.staff_push_tokens
FOR INSERT
TO authenticated
WITH CHECK (user_id = auth.uid() AND public.is_staff(auth.uid()) AND public.is_approved(auth.uid()));

DROP POLICY IF EXISTS "Staff can update own push tokens" ON public.staff_push_tokens;
CREATE POLICY "Staff can update own push tokens"
ON public.staff_push_tokens
FOR UPDATE
TO authenticated
USING (user_id = auth.uid())
WITH CHECK (user_id = auth.uid() AND public.is_staff(auth.uid()) AND public.is_approved(auth.uid()));

CREATE INDEX IF NOT EXISTS idx_staff_push_tokens_user_active
ON public.staff_push_tokens (user_id, is_active);

DROP TRIGGER IF EXISTS update_staff_push_tokens_updated_at ON public.staff_push_tokens;
CREATE TRIGGER update_staff_push_tokens_updated_at
BEFORE UPDATE ON public.staff_push_tokens
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

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

DROP TRIGGER IF EXISTS on_service_update_staff_push ON public.service_updates;
CREATE TRIGGER on_service_update_staff_push
AFTER INSERT ON public.service_updates
FOR EACH ROW
EXECUTE FUNCTION public.trigger_staff_push_on_service_update();