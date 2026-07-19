-- Enforce role validation for Diterima -> Diagnosa transition

CREATE OR REPLACE FUNCTION check_diterima_diagnosa_transition()
RETURNS TRIGGER AS 
DECLARE
  user_role public.app_role;
BEGIN
  -- Only validate if transitioning from Diterima to Diagnosa
  IF OLD.status = 'Diterima' AND NEW.status = 'Diagnosa' THEN
    -- Get current user role
    SELECT role INTO user_role FROM public.user_roles WHERE user_id = auth.uid();
    
    IF user_role IN ('admin', 'owner') THEN
      RAISE EXCEPTION 'Role % tidak dapat melakukan aksi ini.', INITCAP(user_role::text);
    END IF;
  END IF;
  
  RETURN NEW;
END;
 LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_check_diterima_diagnosa_transition ON public.service_orders;
CREATE TRIGGER trg_check_diterima_diagnosa_transition
BEFORE UPDATE ON public.service_orders
FOR EACH ROW
EXECUTE FUNCTION check_diterima_diagnosa_transition();