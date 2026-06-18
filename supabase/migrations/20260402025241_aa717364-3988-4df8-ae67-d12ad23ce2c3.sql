-- INSERT INTO public.profiles (id, full_name, email, requested_role, is_approved, username)
-- VALUES ('929377a6-73ad-4761-9415-1773004c6cb7', 'bambang harmoko', 'bambang@gmail.com', 'owner', TRUE, 'beng')
-- ON CONFLICT (id) DO NOTHING;

-- INSERT INTO public.user_roles (user_id, role)
-- VALUES ('929377a6-73ad-4761-9415-1773004c6cb7', 'owner')
-- ON CONFLICT (user_id, role) DO NOTHING;