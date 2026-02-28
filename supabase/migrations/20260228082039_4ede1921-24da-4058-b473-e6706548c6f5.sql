
-- 1. Create enums
CREATE TYPE public.app_role AS ENUM ('admin', 'manager', 'staff');
CREATE TYPE public.task_status AS ENUM ('pending', 'in_progress', 'completed');
CREATE TYPE public.task_priority AS ENUM ('low', 'medium', 'high', 'urgent');

-- 2. Departments table
CREATE TABLE public.departments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL UNIQUE,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 3. Profiles table
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name TEXT,
  department_id UUID REFERENCES public.departments(id),
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 4. User roles table
CREATE TABLE public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role public.app_role NOT NULL DEFAULT 'staff',
  UNIQUE(user_id, role)
);

-- 5. Tasks table
CREATE TABLE public.tasks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  description TEXT,
  priority public.task_priority NOT NULL DEFAULT 'medium',
  status public.task_status NOT NULL DEFAULT 'pending',
  due_date DATE,
  created_by UUID NOT NULL REFERENCES auth.users(id),
  assigned_to_user UUID REFERENCES auth.users(id),
  assigned_to_department UUID REFERENCES public.departments(id),
  source_department UUID REFERENCES public.departments(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 6. Task attachments table
CREATE TABLE public.task_attachments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  task_id UUID NOT NULL REFERENCES public.tasks(id) ON DELETE CASCADE,
  file_name TEXT NOT NULL,
  storage_path TEXT NOT NULL,
  file_size BIGINT,
  content_type TEXT,
  uploaded_by UUID NOT NULL REFERENCES auth.users(id),
  uploaded_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 7. Task history table
CREATE TABLE public.task_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  task_id UUID NOT NULL REFERENCES public.tasks(id) ON DELETE CASCADE,
  field_changed TEXT NOT NULL,
  old_value TEXT,
  new_value TEXT,
  changed_by UUID NOT NULL REFERENCES auth.users(id),
  changed_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 8. Storage bucket for task files
INSERT INTO storage.buckets (id, name, public) VALUES ('task-files', 'task-files', false);

-- 9. Seed departments
INSERT INTO public.departments (name) VALUES
  ('HR'),
  ('Finance'),
  ('IT'),
  ('Operations'),
  ('Marketing');

-- 10. Helper functions (SECURITY DEFINER to avoid RLS recursion)
CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role public.app_role)
RETURNS BOOLEAN
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role
  )
$$;

CREATE OR REPLACE FUNCTION public.get_user_department_id(_user_id UUID)
RETURNS UUID
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT department_id FROM public.profiles WHERE user_id = _user_id
$$;

CREATE OR REPLACE FUNCTION public.can_access_task(_task_id UUID, _user_id UUID)
RETURNS BOOLEAN
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.tasks t
    WHERE t.id = _task_id
    AND (
      public.has_role(_user_id, 'admin')
      OR t.created_by = _user_id
      OR t.assigned_to_user = _user_id
      OR (t.assigned_to_department IS NOT NULL AND t.assigned_to_department = public.get_user_department_id(_user_id))
      OR (t.source_department IS NOT NULL AND t.source_department = public.get_user_department_id(_user_id))
    )
  )
$$;

-- 11. Auto-create profile on signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (user_id, full_name)
  VALUES (NEW.id, COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.email));
  -- First user gets admin role, rest get staff
  IF (SELECT COUNT(*) FROM public.user_roles) = 0 THEN
    INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, 'admin');
  ELSE
    INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, 'staff');
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- 12. Updated_at trigger
CREATE OR REPLACE FUNCTION public.update_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql SET search_path = public
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

CREATE TRIGGER update_profiles_updated_at BEFORE UPDATE ON public.profiles FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();
CREATE TRIGGER update_tasks_updated_at BEFORE UPDATE ON public.tasks FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

-- 13. Task history trigger (auto-log status changes)
CREATE OR REPLACE FUNCTION public.log_task_status_change()
RETURNS TRIGGER
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  IF OLD.status IS DISTINCT FROM NEW.status THEN
    INSERT INTO public.task_history (task_id, field_changed, old_value, new_value, changed_by)
    VALUES (NEW.id, 'status', OLD.status::text, NEW.status::text, auth.uid());
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER log_task_status AFTER UPDATE ON public.tasks FOR EACH ROW EXECUTE FUNCTION public.log_task_status_change();

-- 14. Enable RLS on all tables
ALTER TABLE public.departments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.task_attachments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.task_history ENABLE ROW LEVEL SECURITY;

-- 15. RLS Policies

-- Departments: all authenticated can read
CREATE POLICY "Authenticated users can view departments" ON public.departments FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admins can manage departments" ON public.departments FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin'));

-- Profiles: all authenticated can read, users update own
CREATE POLICY "Authenticated users can view profiles" ON public.profiles FOR SELECT TO authenticated USING (true);
CREATE POLICY "Users can insert own profile" ON public.profiles FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());
CREATE POLICY "Users can update own profile" ON public.profiles FOR UPDATE TO authenticated USING (user_id = auth.uid());
CREATE POLICY "Admins can update any profile" ON public.profiles FOR UPDATE TO authenticated USING (public.has_role(auth.uid(), 'admin'));

-- User roles: admin can manage, users see own
CREATE POLICY "Users can view own role" ON public.user_roles FOR SELECT TO authenticated USING (user_id = auth.uid());
CREATE POLICY "Admins can view all roles" ON public.user_roles FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins can manage roles" ON public.user_roles FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin'));

-- Tasks
CREATE POLICY "Users can view accessible tasks" ON public.tasks FOR SELECT TO authenticated
  USING (
    public.has_role(auth.uid(), 'admin')
    OR created_by = auth.uid()
    OR assigned_to_user = auth.uid()
    OR assigned_to_department = public.get_user_department_id(auth.uid())
    OR source_department = public.get_user_department_id(auth.uid())
  );
CREATE POLICY "Authenticated users can create tasks" ON public.tasks FOR INSERT TO authenticated WITH CHECK (created_by = auth.uid());
CREATE POLICY "Users can update accessible tasks" ON public.tasks FOR UPDATE TO authenticated
  USING (
    public.has_role(auth.uid(), 'admin')
    OR created_by = auth.uid()
    OR assigned_to_user = auth.uid()
    OR assigned_to_department = public.get_user_department_id(auth.uid())
  );
CREATE POLICY "Admins and creators can delete tasks" ON public.tasks FOR DELETE TO authenticated
  USING (public.has_role(auth.uid(), 'admin') OR created_by = auth.uid());

-- Task attachments
CREATE POLICY "Users can view task attachments" ON public.task_attachments FOR SELECT TO authenticated
  USING (public.can_access_task(task_id, auth.uid()));
CREATE POLICY "Users can add attachments" ON public.task_attachments FOR INSERT TO authenticated
  WITH CHECK (public.can_access_task(task_id, auth.uid()) AND uploaded_by = auth.uid());
CREATE POLICY "Users can delete own attachments" ON public.task_attachments FOR DELETE TO authenticated
  USING (uploaded_by = auth.uid());

-- Task history
CREATE POLICY "Users can view task history" ON public.task_history FOR SELECT TO authenticated
  USING (public.can_access_task(task_id, auth.uid()));

-- Storage policies for task-files bucket
CREATE POLICY "Authenticated users can upload task files" ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'task-files');
CREATE POLICY "Authenticated users can view task files" ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'task-files');
CREATE POLICY "Users can delete own task files" ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'task-files');

-- 16. Indexes for performance
CREATE INDEX idx_profiles_user_id ON public.profiles(user_id);
CREATE INDEX idx_profiles_department_id ON public.profiles(department_id);
CREATE INDEX idx_user_roles_user_id ON public.user_roles(user_id);
CREATE INDEX idx_tasks_assigned_to_user ON public.tasks(assigned_to_user);
CREATE INDEX idx_tasks_assigned_to_department ON public.tasks(assigned_to_department);
CREATE INDEX idx_tasks_created_by ON public.tasks(created_by);
CREATE INDEX idx_tasks_status ON public.tasks(status);
CREATE INDEX idx_task_attachments_task_id ON public.task_attachments(task_id);
CREATE INDEX idx_task_history_task_id ON public.task_history(task_id);
