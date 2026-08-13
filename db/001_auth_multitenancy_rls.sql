-- n9n — multi-tenancy, RLS, rate limiting, webhook idempotency, retention.
-- Run once in the Supabase SQL editor of project ersfbxnrouwgnpzyvqed.

-- 1. Ownership columns ------------------------------------------------------
ALTER TABLE public.workflows             ADD COLUMN IF NOT EXISTS user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE;
ALTER TABLE public.credentials           ADD COLUMN IF NOT EXISTS user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE;
ALTER TABLE public.executions            ADD COLUMN IF NOT EXISTS user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE;
ALTER TABLE public.schedules             ADD COLUMN IF NOT EXISTS user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE;
ALTER TABLE public.webhook_registrations ADD COLUMN IF NOT EXISTS user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE;
ALTER TABLE public.workflow_versions     ADD COLUMN IF NOT EXISTS user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE;
ALTER TABLE public.execution_steps       ADD COLUMN IF NOT EXISTS user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE;
ALTER TABLE public.trigger_state         ADD COLUMN IF NOT EXISTS user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE;
ALTER TABLE public.chat_memory           ADD COLUMN IF NOT EXISTS user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE;

CREATE INDEX IF NOT EXISTS workflows_user_idx   ON public.workflows (user_id, updated_at DESC);
CREATE INDEX IF NOT EXISTS credentials_user_idx ON public.credentials (user_id, updated_at DESC);
CREATE INDEX IF NOT EXISTS executions_user_idx  ON public.executions (user_id, started_at DESC);

-- 2. Roles (separate table — never on a profile row) ------------------------
DO $$ BEGIN
  CREATE TYPE public.app_role AS ENUM ('admin', 'user');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE TABLE IF NOT EXISTS public.user_roles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role public.app_role NOT NULL DEFAULT 'user',
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, role)
);
GRANT SELECT ON public.user_roles TO authenticated;
GRANT ALL    ON public.user_roles TO service_role;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role public.app_role)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role)
$$;

DROP POLICY IF EXISTS "read own roles" ON public.user_roles;
CREATE POLICY "read own roles" ON public.user_roles
  FOR SELECT TO authenticated USING (auth.uid() = user_id);

-- 3. Grants ----------------------------------------------------------------
GRANT SELECT, INSERT, UPDATE, DELETE ON
  public.workflows, public.workflow_versions, public.credentials, public.executions,
  public.execution_steps, public.schedules, public.webhook_registrations,
  public.trigger_state, public.chat_memory TO authenticated;

-- 4. Owner-scoped RLS policies ---------------------------------------------
DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['workflows','credentials','executions','schedules',
                           'webhook_registrations','workflow_versions',
                           'execution_steps','trigger_state','chat_memory']
  LOOP
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', t);
    EXECUTE format('DROP POLICY IF EXISTS "owner select %1$s" ON public.%1$I', t);
    EXECUTE format('DROP POLICY IF EXISTS "owner insert %1$s" ON public.%1$I', t);
    EXECUTE format('DROP POLICY IF EXISTS "owner update %1$s" ON public.%1$I', t);
    EXECUTE format('DROP POLICY IF EXISTS "owner delete %1$s" ON public.%1$I', t);
    EXECUTE format('CREATE POLICY "owner select %1$s" ON public.%1$I FOR SELECT TO authenticated USING (auth.uid() = user_id)', t);
    EXECUTE format('CREATE POLICY "owner insert %1$s" ON public.%1$I FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id)', t);
    EXECUTE format('CREATE POLICY "owner update %1$s" ON public.%1$I FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id)', t);
    EXECUTE format('CREATE POLICY "owner delete %1$s" ON public.%1$I FOR DELETE TO authenticated USING (auth.uid() = user_id)', t);
  END LOOP;
END $$;

-- 5. Abuse controls: rate limiting -----------------------------------------
CREATE TABLE IF NOT EXISTS public.rate_limits (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  bucket text NOT NULL,
  window_start timestamptz NOT NULL,
  hits integer NOT NULL DEFAULT 1,
  UNIQUE (bucket, window_start)
);
CREATE INDEX IF NOT EXISTS rate_limits_window_idx ON public.rate_limits (window_start);
GRANT ALL ON public.rate_limits TO service_role;
ALTER TABLE public.rate_limits ENABLE ROW LEVEL SECURITY;

-- returns TRUE when the call is allowed, FALSE when the bucket is over limit
CREATE OR REPLACE FUNCTION public.bump_rate_limit(_bucket text, _limit int, _window_seconds int DEFAULT 60)
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE ws timestamptz; n int;
BEGIN
  ws := to_timestamp(floor(extract(epoch FROM now()) / _window_seconds) * _window_seconds);
  INSERT INTO public.rate_limits (bucket, window_start, hits) VALUES (_bucket, ws, 1)
  ON CONFLICT (bucket, window_start) DO UPDATE SET hits = public.rate_limits.hits + 1
  RETURNING hits INTO n;
  DELETE FROM public.rate_limits WHERE window_start < now() - interval '1 hour';
  RETURN n <= _limit;
END $$;

-- 6. Webhook idempotency ----------------------------------------------------
CREATE TABLE IF NOT EXISTS public.webhook_deliveries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workflow_id uuid REFERENCES public.workflows(id) ON DELETE CASCADE,
  idempotency_key text NOT NULL,
  execution_id uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (workflow_id, idempotency_key)
);
CREATE INDEX IF NOT EXISTS webhook_deliveries_created_idx ON public.webhook_deliveries (created_at);
GRANT ALL ON public.webhook_deliveries TO service_role;
ALTER TABLE public.webhook_deliveries ENABLE ROW LEVEL SECURITY;

-- 7. Retention for execution logs (they can contain customer payloads) ------
CREATE OR REPLACE FUNCTION public.purge_old_executions(_days int DEFAULT 30)
RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE removed int;
BEGIN
  WITH d AS (
    DELETE FROM public.executions WHERE started_at < now() - (_days || ' days')::interval RETURNING 1
  ) SELECT count(*) INTO removed FROM d;
  DELETE FROM public.webhook_deliveries WHERE created_at < now() - interval '7 days';
  RETURN removed;
END $$;

-- 8. Default role on signup -------------------------------------------------
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, 'user') ON CONFLICT DO NOTHING;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();
