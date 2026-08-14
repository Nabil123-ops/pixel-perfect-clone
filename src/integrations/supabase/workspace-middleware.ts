import { createMiddleware } from "@tanstack/react-start";
import { getRequestHeader } from "@tanstack/react-start/server";

import { readHandleCookie } from "@/lib/account";

/**
 * Account context for every server function.
 *
 * Password-less accounts: the `n9n_handle` cookie identifies the visitor and
 * is mapped server-side to a persistent account. Anonymous visitors share the
 * default workspace account, so nothing ever fails for lack of a session.
 */
export const withWorkspace = createMiddleware({ type: "function" }).server(async ({ next }) => {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { accountUserId } = await import("@/lib/workspace.server");

  let handle: string | null = null;
  try {
    handle = readHandleCookie(getRequestHeader("cookie"));
  } catch {
    handle = null;
  }

  const userId = await accountUserId(handle);

  return next({
    context: {
      supabase: supabaseAdmin,
      userId,
      handle,
      claims: { sub: userId } as Record<string, unknown>,
    },
  });
});
