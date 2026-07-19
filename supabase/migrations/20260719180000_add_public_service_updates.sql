-- Create the proxy table that exposes only non-PII fields needed for realtime status updates
CREATE TABLE IF NOT EXISTS public.public_service_updates (
    order_id UUID PRIMARY KEY REFERENCES public.service_orders(id) ON DELETE CASCADE,
    status TEXT NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

-- Enable RLS
ALTER TABLE public.public_service_updates ENABLE ROW LEVEL SECURITY;

-- Allow anon to SELECT from this table. This is safe because it only contains UUIDs and statuses.
CREATE POLICY "Anon can view public updates"
    ON public.public_service_updates
    FOR SELECT
    TO anon, authenticated
    USING (TRUE);

-- Add to supabase_realtime publication
ALTER PUBLICATION supabase_realtime ADD TABLE public.public_service_updates;

-- Create function to sync status changes from service_orders
CREATE OR REPLACE FUNCTION public.sync_public_service_updates()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    INSERT INTO public.public_service_updates (order_id, status, updated_at)
    VALUES (NEW.id, NEW.status, NOW())
    ON CONFLICT (order_id)
    DO UPDATE SET 
        status = EXCLUDED.status,
        updated_at = NOW();
    RETURN NEW;
END;
$$;

-- Create trigger on service_orders to fire when status changes
DROP TRIGGER IF EXISTS on_service_order_status_change ON public.service_orders;
CREATE TRIGGER on_service_order_status_change
    AFTER INSERT OR UPDATE OF status
    ON public.service_orders
    FOR EACH ROW
    EXECUTE FUNCTION public.sync_public_service_updates();

-- Populate the table with existing data
INSERT INTO public.public_service_updates (order_id, status, updated_at)
SELECT id, status, updated_at
FROM public.service_orders
ON CONFLICT (order_id) DO NOTHING;
