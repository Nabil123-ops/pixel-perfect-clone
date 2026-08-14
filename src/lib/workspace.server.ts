/**
 * Account resolution (server-only).
 *
 * Accounts are name-only: a handle from the `n9n_handle` cookie is mapped to a
 * persistent Supabase auth user (`<handle>@n9n.app`), created on first use.
 * Without a handle everything falls back to the shared workspace account, so
 * the app keeps working for anonymous visitors.
 */
import { accountEmail } from "@/lib/account";

const WORKSPACE_EMAIL = "workspace@n9n.local";

const cache = new Map<string, string>();
const inflight = new Map<string, Promise<string>>();

async function resolve(email: string): Promise<string> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

  const find = async () => {
    for (let page = 1; page <= 10; page++) {
      const { data } = await supabaseAdmin.auth.admin.listUsers({ page, perPage: 200 });
      const hit = data?.users?.find((u) => u.email === email);
      if (hit) return hit.id;
      if (!data?.users?.length || data.users.length < 200) return null;
    }
    return null;
  };

  const existing = await find();
  if (existing) return existing;

  const { data: created, error } = await supabaseAdmin.auth.admin.createUser({
    email,
    email_confirm: true,
    password: crypto.randomUUID() + crypto.randomUUID(),
  });
  if (created?.user) return created.user.id;

  const again = await find();
  if (again) return again;

  throw new Error(error?.message ?? "Could not initialise the account");
}

async function userIdForEmail(email: string): Promise<string> {
  const hit = cache.get(email);
  if (hit) return hit;
  let pending = inflight.get(email);
  if (!pending) {
    pending = resolve(email)
      .then((id) => {
        cache.set(email, id);
        return id;
      })
      .finally(() => inflight.delete(email));
    inflight.set(email, pending);
  }
  return pending;
}

/** Shared fallback account used when no handle cookie is present. */
export async function workspaceUserId(): Promise<string> {
  return userIdForEmail(WORKSPACE_EMAIL);
}

/** Account id for a normalized handle. */
export async function accountUserId(handle: string | null): Promise<string> {
  if (!handle) return workspaceUserId();
  return userIdForEmail(accountEmail(handle));
}
