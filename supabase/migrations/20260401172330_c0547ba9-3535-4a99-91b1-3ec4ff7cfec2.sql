
ALTER TABLE public.service_orders
ADD COLUMN is_archived BOOLEAN NOT NULL DEFAULT FALSE;

CREATE INDEX idx_service_orders_archived ON public.service_orders (is_archived);
