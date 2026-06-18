
-- Create role enum
CREATE TYPE public.app_role AS ENUM ('owner', 'admin', 'technician');

-- Create service status enum
CREATE TYPE public.service_status AS ENUM (
  'Diterima', 'Diagnosa', 'Menunggu Konfirmasi', 'Pending', 
  'Perbaikan', 'Selesai', 'Siap diAmbil', 'Close', 'Cancelled'
);

-- Create profiles table
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name TEXT NOT NULL,
  email TEXT NOT NULL,
  is_approved BOOLEAN DEFAULT FALSE,
  requested_role app_role NOT NULL DEFAULT 'technician',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Create user_roles table
CREATE TABLE public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role app_role NOT NULL,
  UNIQUE(user_id, role)
);

-- Create service_orders table
CREATE TABLE public.service_orders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ticket_number TEXT UNIQUE NOT NULL,
  customer_name TEXT NOT NULL,
  customer_phone TEXT NOT NULL,
  customer_email TEXT,
  device_type TEXT NOT NULL,
  device_brand TEXT NOT NULL,
  device_model TEXT NOT NULL,
  device_password TEXT,
  damage_description TEXT,
  unit_condition TEXT NOT NULL,
  unit_accessories TEXT,
  unit_checks JSONB DEFAULT '{}',
  service_type TEXT NOT NULL,
  status service_status NOT NULL DEFAULT 'Diterima',
  estimated_cost NUMERIC,
  final_cost NUMERIC,
  invoice_items JSONB,
  assigned_technician UUID REFERENCES auth.users(id),
  created_by UUID REFERENCES auth.users(id) NOT NULL,
  notes TEXT,
  edited_by TEXT,
  edited_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Create service_updates table
CREATE TABLE public.service_updates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID NOT NULL REFERENCES public.service_orders(id) ON DELETE CASCADE,
  status service_status NOT NULL,
  description TEXT,
  cancel_type TEXT,
  updated_by UUID REFERENCES auth.users(id) NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Create service_photos table
CREATE TABLE public.service_photos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID NOT NULL REFERENCES public.service_orders(id) ON DELETE CASCADE,
  photo_url TEXT NOT NULL,
  label TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Create saved_customers table for "remember customer" feature
CREATE TABLE public.saved_customers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_name TEXT NOT NULL,
  customer_phone TEXT NOT NULL,
  customer_email TEXT,
  created_by UUID REFERENCES auth.users(id) NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Enable RLS on all tables
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.service_orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.service_updates ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.service_photos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.saved_customers ENABLE ROW LEVEL SECURITY;

-- Create SECURITY DEFINER function for role checking
CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role app_role)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id AND role = _role
  )
$$;

-- Create helper: check if user has any staff role
CREATE OR REPLACE FUNCTION public.is_staff(_user_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id
  )
$$;

-- Create helper: check if user is approved
CREATE OR REPLACE FUNCTION public.is_approved(_user_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = _user_id AND is_approved = TRUE
  )
$$;

-- Updated_at trigger function
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

-- Apply updated_at triggers
CREATE TRIGGER update_profiles_updated_at
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_service_orders_updated_at
  BEFORE UPDATE ON public.service_orders
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Auto-generate ticket number function
CREATE OR REPLACE FUNCTION public.generate_ticket_number()
RETURNS TRIGGER AS $$
DECLARE
  month_letter CHAR(1);
  next_num INTEGER;
  current_month INTEGER;
BEGIN
  current_month := EXTRACT(MONTH FROM now())::INTEGER;
  month_letter := CHR(64 + current_month); -- A=Jan, B=Feb, etc.
  
  SELECT COALESCE(MAX(
    CAST(SUBSTRING(ticket_number FROM '[0-9]+$') AS INTEGER)
  ), 0) + 1
  INTO next_num
  FROM public.service_orders
  WHERE ticket_number LIKE month_letter || '-%';
  
  NEW.ticket_number := month_letter || '-' || LPAD(next_num::TEXT, 4, '0');
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

CREATE TRIGGER auto_ticket_number
  BEFORE INSERT ON public.service_orders
  FOR EACH ROW
  WHEN (NEW.ticket_number IS NULL OR NEW.ticket_number = '')
  EXECUTE FUNCTION public.generate_ticket_number();

-- Auto-create profile on signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, full_name, email, requested_role, is_approved)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.email),
    NEW.email,
    COALESCE((NEW.raw_user_meta_data->>'requested_role')::app_role, 'technician'),
    CASE 
      WHEN (NEW.raw_user_meta_data->>'requested_role') = 'owner' THEN TRUE
      ELSE FALSE
    END
  );
  
  -- If owner role requested and approved, auto-insert role
  IF (NEW.raw_user_meta_data->>'requested_role') = 'owner' THEN
    INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, 'owner');
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- ============ RLS POLICIES ============

-- profiles policies
CREATE POLICY "Users can view own profile"
  ON public.profiles FOR SELECT
  TO authenticated
  USING (id = auth.uid());

CREATE POLICY "Owner can view all profiles"
  ON public.profiles FOR SELECT
  TO authenticated
  USING (public.has_role(auth.uid(), 'owner'));

CREATE POLICY "Admin can view all profiles"
  ON public.profiles FOR SELECT
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Users can update own profile"
  ON public.profiles FOR UPDATE
  TO authenticated
  USING (id = auth.uid())
  WITH CHECK (id = auth.uid());

CREATE POLICY "Owner can update any profile"
  ON public.profiles FOR UPDATE
  TO authenticated
  USING (public.has_role(auth.uid(), 'owner'));

-- user_roles policies
CREATE POLICY "Owner can view all roles"
  ON public.user_roles FOR SELECT
  TO authenticated
  USING (public.has_role(auth.uid(), 'owner'));

CREATE POLICY "Users can view own role"
  ON public.user_roles FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "Owner can insert roles"
  ON public.user_roles FOR INSERT
  TO authenticated
  WITH CHECK (public.has_role(auth.uid(), 'owner'));

CREATE POLICY "Owner can update roles"
  ON public.user_roles FOR UPDATE
  TO authenticated
  USING (public.has_role(auth.uid(), 'owner'));

CREATE POLICY "Owner can delete roles"
  ON public.user_roles FOR DELETE
  TO authenticated
  USING (public.has_role(auth.uid(), 'owner'));

-- service_orders policies
CREATE POLICY "Staff can view all orders"
  ON public.service_orders FOR SELECT
  TO authenticated
  USING (public.is_staff(auth.uid()) AND public.is_approved(auth.uid()));

CREATE POLICY "Public can view orders by ticket"
  ON public.service_orders FOR SELECT
  TO anon
  USING (TRUE);

CREATE POLICY "Public authenticated can view orders by ticket"
  ON public.service_orders FOR SELECT
  TO authenticated
  USING (TRUE);

CREATE POLICY "Admin and owner can create orders"
  ON public.service_orders FOR INSERT
  TO authenticated
  WITH CHECK (
    (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'owner'))
    AND public.is_approved(auth.uid())
  );

CREATE POLICY "Staff can update orders"
  ON public.service_orders FOR UPDATE
  TO authenticated
  USING (
    public.is_staff(auth.uid()) AND public.is_approved(auth.uid())
  );

CREATE POLICY "Owner can delete orders"
  ON public.service_orders FOR DELETE
  TO authenticated
  USING (public.has_role(auth.uid(), 'owner'));

-- service_updates policies
CREATE POLICY "Staff can view all updates"
  ON public.service_updates FOR SELECT
  TO authenticated
  USING (public.is_staff(auth.uid()) AND public.is_approved(auth.uid()));

CREATE POLICY "Public can view updates"
  ON public.service_updates FOR SELECT
  TO anon
  USING (TRUE);

CREATE POLICY "Public auth can view updates"
  ON public.service_updates FOR SELECT
  TO authenticated
  USING (TRUE);

CREATE POLICY "Staff can create updates"
  ON public.service_updates FOR INSERT
  TO authenticated
  WITH CHECK (
    public.is_staff(auth.uid()) AND public.is_approved(auth.uid())
  );

-- service_photos policies
CREATE POLICY "Staff can view all photos"
  ON public.service_photos FOR SELECT
  TO authenticated
  USING (public.is_staff(auth.uid()) AND public.is_approved(auth.uid()));

CREATE POLICY "Public can view photos"
  ON public.service_photos FOR SELECT
  TO anon
  USING (TRUE);

CREATE POLICY "Public auth can view photos"
  ON public.service_photos FOR SELECT
  TO authenticated
  USING (TRUE);

CREATE POLICY "Staff can insert photos"
  ON public.service_photos FOR INSERT
  TO authenticated
  WITH CHECK (
    public.is_staff(auth.uid()) AND public.is_approved(auth.uid())
  );

CREATE POLICY "Staff can delete photos"
  ON public.service_photos FOR DELETE
  TO authenticated
  USING (
    public.is_staff(auth.uid()) AND public.is_approved(auth.uid())
  );

-- saved_customers policies
CREATE POLICY "Staff can view saved customers"
  ON public.saved_customers FOR SELECT
  TO authenticated
  USING (public.is_staff(auth.uid()) AND public.is_approved(auth.uid()));

CREATE POLICY "Staff can insert saved customers"
  ON public.saved_customers FOR INSERT
  TO authenticated
  WITH CHECK (public.is_staff(auth.uid()) AND public.is_approved(auth.uid()));

CREATE POLICY "Staff can delete saved customers"
  ON public.saved_customers FOR DELETE
  TO authenticated
  USING (public.is_staff(auth.uid()) AND public.is_approved(auth.uid()));

-- ============ STORAGE ============

-- Create unit-photos bucket (public for tracking page viewing)
INSERT INTO storage.buckets (id, name, public) VALUES ('unit-photos', 'unit-photos', true);

-- Storage policies
CREATE POLICY "Anyone can view unit photos"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'unit-photos');

CREATE POLICY "Staff can upload unit photos"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'unit-photos' 
    AND public.is_staff(auth.uid()) 
    AND public.is_approved(auth.uid())
  );

CREATE POLICY "Staff can update unit photos"
  ON storage.objects FOR UPDATE
  TO authenticated
  USING (
    bucket_id = 'unit-photos' 
    AND public.is_staff(auth.uid()) 
    AND public.is_approved(auth.uid())
  );

CREATE POLICY "Staff can delete unit photos"
  ON storage.objects FOR DELETE
  TO authenticated
  USING (
    bucket_id = 'unit-photos' 
    AND public.is_staff(auth.uid()) 
    AND public.is_approved(auth.uid())
  );

-- Indexes for performance
CREATE INDEX idx_service_orders_ticket ON public.service_orders(ticket_number);
CREATE INDEX idx_service_orders_phone ON public.service_orders(customer_phone);
CREATE INDEX idx_service_orders_status ON public.service_orders(status);
CREATE INDEX idx_service_updates_order ON public.service_updates(order_id);
CREATE INDEX idx_service_photos_order ON public.service_photos(order_id);
CREATE INDEX idx_user_roles_user ON public.user_roles(user_id);
