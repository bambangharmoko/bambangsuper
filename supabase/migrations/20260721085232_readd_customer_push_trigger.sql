DROP TRIGGER IF EXISTS on_service_order_status_change_push ON public.service_orders;
CREATE TRIGGER on_service_order_status_change_push
    AFTER UPDATE OF status
    ON public.service_orders
    FOR EACH ROW
    EXECUTE FUNCTION public.trigger_push_on_status_change();
