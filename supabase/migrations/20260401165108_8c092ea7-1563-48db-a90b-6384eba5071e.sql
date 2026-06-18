
ALTER TABLE public.service_orders
ADD COLUMN warranty_duration integer DEFAULT NULL,
ADD COLUMN warranty_unit text DEFAULT NULL,
ADD COLUMN warranty_notes text DEFAULT NULL,
ADD COLUMN warranty_expiry timestamp with time zone DEFAULT NULL;
