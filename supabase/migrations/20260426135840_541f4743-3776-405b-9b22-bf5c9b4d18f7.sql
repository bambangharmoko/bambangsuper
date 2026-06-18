ALTER TABLE public.service_orders
ADD COLUMN IF NOT EXISTS update_delay_reason TEXT;