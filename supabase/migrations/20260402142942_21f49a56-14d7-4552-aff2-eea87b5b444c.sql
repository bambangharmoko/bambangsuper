CREATE OR REPLACE FUNCTION public.get_staff_identities(_user_ids uuid[])
RETURNS TABLE (
  user_id uuid,
  full_name text,
  username text,
  role public.app_role
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.is_staff(auth.uid()) OR NOT public.is_approved(auth.uid()) THEN
    RAISE EXCEPTION 'not authorized';
  END IF;

  RETURN QUERY
  SELECT p.id, p.full_name, p.username, ur.role
  FROM public.profiles p
  JOIN public.user_roles ur ON ur.user_id = p.id
  WHERE p.id = ANY(COALESCE(_user_ids, ARRAY[]::uuid[]));
END;
$$;

REVOKE ALL ON FUNCTION public.get_staff_identities(uuid[]) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_staff_identities(uuid[]) TO authenticated;