import { createMiddleware } from "@tanstack/react-start";

/**
 * Open-access server context.
 *
 * The product has no sign-in: server functions run against the shared
 * workspace account with the service-role client, so saving workflows,
 * credentials, executions and settings works for everyone out of the box.
 */
export const withWorkspace = createMiddleware({ type: "function" }).server(async ({ next }) => {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { workspaceUserId } = await import("@/lib/workspace.server");
  const userId = await workspaceUserId();

  return next({
    context: {
      supabase: supabaseAdmin,
      userId,
      claims: { sub: userId } as Record<string, unknown>,
    },
  });
});
