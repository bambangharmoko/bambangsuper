REVOKE ALL ON FUNCTION public.trigger_staff_push_on_service_update() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.trigger_staff_push_on_service_update() FROM anon;
REVOKE ALL ON FUNCTION public.trigger_staff_push_on_service_update() FROM authenticated;

REVOKE ALL ON FUNCTION public.trigger_push_on_status_change() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.trigger_push_on_status_change() FROM anon;
REVOKE ALL ON FUNCTION public.trigger_push_on_status_change() FROM authenticated;