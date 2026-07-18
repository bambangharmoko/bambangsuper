-- Add saved_customer_id to service_orders to link tickets with saved customers.
-- This column is nullable (backward-compatible):
--   NULL  → manual customer (name/phone editable directly on the ticket)
--   NOT NULL → linked to a saved_customers record (name/phone managed via Kelola Pelanggan)
--
-- ON DELETE SET NULL: if the saved_customer record is deleted, the ticket becomes "manual"
-- ON UPDATE CASCADE: if saved_customers.id changes (shouldn't happen with UUIDs, but safe)

ALTER TABLE public.service_orders
  ADD COLUMN IF NOT EXISTS saved_customer_id uuid NULL
    REFERENCES public.saved_customers(id)
    ON DELETE SET NULL
    ON UPDATE CASCADE;

-- Index for fast batch-update lookups (CustomerManagement update flow)
CREATE INDEX IF NOT EXISTS idx_service_orders_saved_customer_id
  ON public.service_orders (saved_customer_id)
  WHERE saved_customer_id IS NOT NULL;
