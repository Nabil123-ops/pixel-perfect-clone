CREATE TABLE public.workflows (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name text NOT NULL DEFAULT 'Untitled workflow',
  active boolean NOT NULL DEFAULT false,
  nodes jsonb NOT NULL DEFAULT '[]'::jsonb,
  edges jsonb NOT NULL DEFAULT '[]'::jsonb,
  pinned jsonb NOT NULL DEFAULT '{}'::jsonb,
  version integer NOT NULL DEFAULT 1,
  last_run_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT ALL ON public.workflows TO service_role;
ALTER TABLE public.workflows ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.workflow_versions (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  workflow_id uuid NOT NULL REFERENCES public.workflows(id) ON DELETE CASCADE,
  version integer NOT NULL,
  name text NOT NULL,
  nodes jsonb NOT NULL,
  edges jsonb NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX workflow_versions_workflow_idx ON public.workflow_versions (workflow_id, version DESC);
GRANT ALL ON public.workflow_versions TO service_role;
ALTER TABLE public.workflow_versions ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.credentials (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name text NOT NULL,
  type text NOT NULL DEFAULT 'apiKey',
  data_encrypted text NOT NULL DEFAULT '',
  oauth_state text,
  last_tested_at timestamptz,
  last_test_ok boolean,
  last_test_message text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT ALL ON public.credentials TO service_role;
ALTER TABLE public.credentials ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.executions (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  workflow_id uuid REFERENCES public.workflows(id) ON DELETE CASCADE,
  workflow_name text NOT NULL DEFAULT '',
  mode text NOT NULL DEFAULT 'manual',
  status text NOT NULL DEFAULT 'running',
  error text,
  trigger_payload jsonb,
  started_at timestamptz NOT NULL DEFAULT now(),
  finished_at timestamptz,
  duration_ms integer
);
CREATE INDEX executions_started_idx ON public.executions (started_at DESC);
CREATE INDEX executions_workflow_idx ON public.executions (workflow_id, started_at DESC);
GRANT ALL ON public.executions TO service_role;
ALTER TABLE public.executions ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.execution_steps (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  execution_id uuid NOT NULL REFERENCES public.executions(id) ON DELETE CASCADE,
  ordinal integer NOT NULL DEFAULT 0,
  node_id text NOT NULL,
  node_kind text NOT NULL DEFAULT '',
  label text NOT NULL DEFAULT '',
  status text NOT NULL DEFAULT 'success',
  ms integer NOT NULL DEFAULT 0,
  attempts integer NOT NULL DEFAULT 1,
  input jsonb,
  output jsonb,
  logs jsonb,
  error text,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX execution_steps_exec_idx ON public.execution_steps (execution_id, ordinal);
GRANT ALL ON public.execution_steps TO service_role;
ALTER TABLE public.execution_steps ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.trigger_state (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  workflow_id uuid NOT NULL REFERENCES public.workflows(id) ON DELETE CASCADE,
  node_id text NOT NULL,
  last_run_at timestamptz,
  seen jsonb NOT NULL DEFAULT '[]'::jsonb,
  UNIQUE (workflow_id, node_id)
);
GRANT ALL ON public.trigger_state TO service_role;
ALTER TABLE public.trigger_state ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.touch_updated_at() RETURNS TRIGGER AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$$ LANGUAGE plpgsql SET search_path = public;

CREATE TRIGGER workflows_touch BEFORE UPDATE ON public.workflows FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();
CREATE TRIGGER credentials_touch BEFORE UPDATE ON public.credentials FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

CREATE TABLE public.webhook_registrations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workflow_id uuid NOT NULL REFERENCES public.workflows(id) ON DELETE CASCADE,
  node_id text NOT NULL,
  path text NOT NULL,
  method text NOT NULL DEFAULT 'POST',
  auth_mode text NOT NULL DEFAULT 'none',
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (workflow_id, node_id)
);
GRANT ALL ON public.webhook_registrations TO service_role;
ALTER TABLE public.webhook_registrations ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.schedules (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workflow_id uuid NOT NULL REFERENCES public.workflows(id) ON DELETE CASCADE,
  node_id text NOT NULL,
  cron_expression text NOT NULL DEFAULT '*/5 * * * *',
  next_run_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (workflow_id, node_id)
);
GRANT ALL ON public.schedules TO service_role;
ALTER TABLE public.schedules ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.chat_memory (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id text NOT NULL,
  workflow_id uuid REFERENCES public.workflows(id) ON DELETE CASCADE,
  role text NOT NULL,
  content text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX chat_memory_session_idx ON public.chat_memory (session_id, created_at);
GRANT ALL ON public.chat_memory TO service_role;
ALTER TABLE public.chat_memory ENABLE ROW LEVEL SECURITY;