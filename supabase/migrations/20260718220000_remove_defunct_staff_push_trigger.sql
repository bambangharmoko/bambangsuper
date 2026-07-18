-- Migration: Remove defunct staff push trigger to prevent duplicate notifications
-- The responsibility of notifying staff has been moved to the frontend using the Edge Function 
-- to avoid 401 Unauthorized errors caused by missing JWTs in the database trigger.

DROP TRIGGER IF EXISTS on_service_update_staff_push ON public.service_updates;
DROP FUNCTION IF EXISTS public.trigger_staff_push_on_service_update();
