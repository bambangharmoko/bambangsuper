
-- Add soft delete column
ALTER TABLE public.service_orders
ADD COLUMN deleted_at TIMESTAMP WITH TIME ZONE DEFAULT NULL;

-- Create index for efficient querying of non-deleted records
CREATE INDEX idx_service_orders_deleted_at ON public.service_orders (deleted_at);
