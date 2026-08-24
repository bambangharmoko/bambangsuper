-- Add warranty_linked_ticket_id to service_orders for linking warranty tickets to their original ticket
ALTER TABLE service_orders
  ADD COLUMN IF NOT EXISTS warranty_linked_ticket_id UUID REFERENCES service_orders(id) ON DELETE SET NULL;

-- Index for fast reverse lookup (find warranty tickets that link TO a given ticket)
CREATE INDEX IF NOT EXISTS idx_service_orders_warranty_linked
  ON service_orders(warranty_linked_ticket_id)
  WHERE warranty_linked_ticket_id IS NOT NULL;
