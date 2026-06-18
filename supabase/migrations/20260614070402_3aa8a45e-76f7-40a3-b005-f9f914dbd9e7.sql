-- Remove anonymous and unrestricted authenticated read on service_photos and service_updates
DROP POLICY IF EXISTS "Public can view photos" ON public.service_photos;
DROP POLICY IF EXISTS "Public auth can view photos" ON public.service_photos;
DROP POLICY IF EXISTS "Public can view updates" ON public.service_updates;
DROP POLICY IF EXISTS "Public auth can view updates" ON public.service_updates;

-- Harden is_staff to also require approval
CREATE OR REPLACE FUNCTION public.is_staff(_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles ur
    JOIN public.profiles p ON p.id = ur.user_id
    WHERE ur.user_id = _user_id
      AND ur.role IN ('owner'::app_role, 'admin'::app_role, 'technician'::app_role)
      AND p.is_approved = TRUE
  )
$function$;

-- Lock down customer_push_tokens writes to service role only (edge functions)
REVOKE INSERT, UPDATE, DELETE ON public.customer_push_tokens FROM anon, authenticated;