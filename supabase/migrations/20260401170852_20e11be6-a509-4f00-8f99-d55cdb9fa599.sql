
-- Allow owner to delete service_updates
CREATE POLICY "Owner can delete updates"
ON public.service_updates
FOR DELETE
TO authenticated
USING (has_role(auth.uid(), 'owner'::app_role));

-- Allow owner to delete service_photos
CREATE POLICY "Owner can delete photos (owner)"
ON public.service_photos
FOR DELETE
TO authenticated
USING (has_role(auth.uid(), 'owner'::app_role));

-- Allow owner to delete profiles
CREATE POLICY "Owner can delete profiles"
ON public.profiles
FOR DELETE
TO authenticated
USING (has_role(auth.uid(), 'owner'::app_role));

-- Ensure cascade delete on service_updates -> service_orders
ALTER TABLE public.service_updates
DROP CONSTRAINT IF EXISTS service_updates_order_id_fkey,
ADD CONSTRAINT service_updates_order_id_fkey
  FOREIGN KEY (order_id) REFERENCES public.service_orders(id) ON DELETE CASCADE;

-- Ensure cascade delete on service_photos -> service_orders  
ALTER TABLE public.service_photos
DROP CONSTRAINT IF EXISTS service_photos_order_id_fkey,
ADD CONSTRAINT service_photos_order_id_fkey
  FOREIGN KEY (order_id) REFERENCES public.service_orders(id) ON DELETE CASCADE;
