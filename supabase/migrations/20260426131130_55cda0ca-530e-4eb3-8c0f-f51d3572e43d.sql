ALTER TABLE public.service_orders
ADD COLUMN IF NOT EXISTS is_picked_up boolean NOT NULL DEFAULT false;

CREATE INDEX IF NOT EXISTS idx_service_orders_cancel_pickup
ON public.service_orders (status, is_picked_up)
WHERE deleted_at IS NULL;