DROP INDEX IF EXISTS public.idx_service_orders_archived;
ALTER TABLE public.service_orders DROP COLUMN IF EXISTS is_archived;