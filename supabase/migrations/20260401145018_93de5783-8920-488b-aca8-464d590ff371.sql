
CREATE OR REPLACE FUNCTION public.generate_ticket_number()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
DECLARE
  month_letter CHAR(1);
  year_digits CHAR(2);
  next_num INTEGER;
  current_month INTEGER;
  current_year INTEGER;
  prefix TEXT;
BEGIN
  current_month := EXTRACT(MONTH FROM now())::INTEGER;
  current_year := EXTRACT(YEAR FROM now())::INTEGER;
  month_letter := CHR(64 + current_month); -- A=Jan, B=Feb, ... L=Dec
  year_digits := LPAD((current_year % 100)::TEXT, 2, '0'); -- e.g. 26
  prefix := month_letter || year_digits; -- e.g. C26

  SELECT COALESCE(MAX(
    CAST(SUBSTRING(ticket_number FROM 4) AS INTEGER)
  ), 0) + 1
  INTO next_num
  FROM public.service_orders
  WHERE ticket_number LIKE prefix || '%';

  NEW.ticket_number := prefix || LPAD(next_num::TEXT, 3, '0');
  RETURN NEW;
END;
$function$;
