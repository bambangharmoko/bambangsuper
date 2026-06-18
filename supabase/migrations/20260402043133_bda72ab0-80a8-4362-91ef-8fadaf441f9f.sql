CREATE OR REPLACE TRIGGER generate_ticket_number_trigger
BEFORE INSERT ON public.service_orders
FOR EACH ROW
EXECUTE FUNCTION public.generate_ticket_number();