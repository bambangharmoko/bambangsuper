CREATE OR REPLACE FUNCTION public.remove_push_token(token_to_remove text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  DELETE FROM public.staff_push_tokens WHERE fcm_token = token_to_remove;
END;
$$;