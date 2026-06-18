DROP TRIGGER IF EXISTS generate_ticket_number_trigger ON public.service_orders;

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
  IF NEW.ticket_number IS NOT NULL AND NEW.ticket_number <> '' THEN
    RETURN NEW;
  END IF;

  current_month := EXTRACT(MONTH FROM now())::INTEGER;
  current_year := EXTRACT(YEAR FROM now())::INTEGER;
  month_letter := CHR(64 + current_month);
  year_digits := LPAD((current_year % 100)::TEXT, 2, '0');
  prefix := month_letter || year_digits;

  SELECT COALESCE(MAX(CAST(SUBSTRING(ticket_number FROM 4) AS INTEGER)), 0) + 1
  INTO next_num
  FROM public.service_orders
  WHERE ticket_number LIKE prefix || '%'
    AND ticket_number ~ ('^' || prefix || '[0-9]{3,}$');

  NEW.ticket_number := prefix || LPAD(next_num::TEXT, 3, '0');
  RETURN NEW;
END;
$function$;