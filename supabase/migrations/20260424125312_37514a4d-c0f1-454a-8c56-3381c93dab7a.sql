-- 1. Tabel untuk menyimpan FCM token pelanggan
CREATE TABLE public.customer_push_tokens (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  ticket_number TEXT NOT NULL,
  fcm_token TEXT NOT NULL,
  user_agent TEXT,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE (ticket_number, fcm_token)
);

CREATE INDEX idx_cpt_ticket ON public.customer_push_tokens(ticket_number) WHERE is_active = TRUE;
CREATE INDEX idx_cpt_token ON public.customer_push_tokens(fcm_token);

ALTER TABLE public.customer_push_tokens ENABLE ROW LEVEL SECURITY;

-- Siapa saja boleh mendaftarkan token (pelanggan tanpa login)
CREATE POLICY "Anyone can subscribe push token"
ON public.customer_push_tokens
FOR INSERT
TO anon, authenticated
WITH CHECK (true);

-- Siapa saja boleh update is_active untuk token mereka (unsubscribe)
CREATE POLICY "Anyone can update own push token"
ON public.customer_push_tokens
FOR UPDATE
TO anon, authenticated
USING (true)
WITH CHECK (true);

-- Siapa saja boleh menghapus token mereka
CREATE POLICY "Anyone can delete own push token"
ON public.customer_push_tokens
FOR DELETE
TO anon, authenticated
USING (true);

-- Hanya staff yang bisa view semua (untuk admin/debug)
CREATE POLICY "Staff can view all push tokens"
ON public.customer_push_tokens
FOR SELECT
TO authenticated
USING (is_staff(auth.uid()) AND is_approved(auth.uid()));

-- Trigger updated_at
CREATE TRIGGER update_customer_push_tokens_updated_at
BEFORE UPDATE ON public.customer_push_tokens
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- 2. Enable pg_net extension untuk memanggil edge function dari trigger
CREATE EXTENSION IF NOT EXISTS pg_net WITH SCHEMA extensions;

-- 3. Function untuk trigger push notification saat status berubah
CREATE OR REPLACE FUNCTION public.trigger_push_on_status_change()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  function_url TEXT;
  service_key TEXT;
BEGIN
  -- Hanya trigger jika status benar-benar berubah
  IF OLD.status IS DISTINCT FROM NEW.status THEN
    -- URL Edge Function
    function_url := 'https://njytakdtmaudolpovvbg.supabase.co/functions/v1/notify-status-change';
    
    -- Service role key dari vault (atau hardcode untuk sekarang via secret)
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
  -- Jangan gagalkan UPDATE jika notif gagal
  RAISE WARNING 'Push notification trigger failed: %', SQLERRM;
  RETURN NEW;
END;
$$;

-- 4. Pasang trigger di service_orders
DROP TRIGGER IF EXISTS on_service_order_status_change ON public.service_orders;
CREATE TRIGGER on_service_order_status_change
AFTER UPDATE OF status ON public.service_orders
FOR EACH ROW
EXECUTE FUNCTION public.trigger_push_on_status_change();