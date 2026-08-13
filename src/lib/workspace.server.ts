/**
 * Single shared workspace owner.
 *
 * The app runs without sign-in: every workflow, credential and execution is
 * owned by one persistent workspace account so all existing ownership columns,
 * foreign keys and RLS policies keep working unchanged.
 */
const WORKSPACE_EMAIL = "workspace@n9n.local";

let cached: string | null = null;
let inflight: Promise<string> | null = null;

async function resolve(): Promise<string> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

  // Existing account?
  const { data: list } = await supabaseAdmin.auth.admin.listUsers({ page: 1, perPage: 200 });
  const found = list?.users?.find((u) => u.email === WORKSPACE_EMAIL);
  if (found) return found.id;

  const { data: created, error } = await supabaseAdmin.auth.admin.createUser({
    email: WORKSPACE_EMAIL,
    email_confirm: true,
    password: crypto.randomUUID() + crypto.randomUUID(),
  });
  if (created?.user) return created.user.id;

  // Race: another request created it first.
  const { data: retry } = await supabaseAdmin.auth.admin.listUsers({ page: 1, perPage: 200 });
  const again = retry?.users?.find((u) => u.email === WORKSPACE_EMAIL);
  if (again) return again.id;

  throw new Error(error?.message ?? "Could not initialise the workspace account");
}

export async function workspaceUserId(): Promise<string> {
  if (cached) return cached;
  if (!inflight) {
    inflight = resolve()
      .then((id) => {
        cached = id;
        return id;
      })
      .finally(() => {
        inflight = null;
      });
  }
  return inflight;
}
