
CREATE TABLE public.internal_notes (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  order_id UUID NOT NULL REFERENCES public.service_orders(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  content TEXT NOT NULL,
  is_read_by UUID[] DEFAULT '{}',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.internal_notes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Staff can view internal notes"
ON public.internal_notes FOR SELECT TO authenticated
USING (is_staff(auth.uid()) AND is_approved(auth.uid()));

CREATE POLICY "Staff can create internal notes"
ON public.internal_notes FOR INSERT TO authenticated
WITH CHECK (is_staff(auth.uid()) AND is_approved(auth.uid()));

CREATE POLICY "Staff can update internal notes"
ON public.internal_notes FOR UPDATE TO authenticated
USING (is_staff(auth.uid()) AND is_approved(auth.uid()));

CREATE POLICY "Owner can delete internal notes"
ON public.internal_notes FOR DELETE TO authenticated
USING (has_role(auth.uid(), 'owner'::app_role));

CREATE INDEX idx_internal_notes_order ON public.internal_notes(order_id);

CREATE TRIGGER update_internal_notes_updated_at
BEFORE UPDATE ON public.internal_notes
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
