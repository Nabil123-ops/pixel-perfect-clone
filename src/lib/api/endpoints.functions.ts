import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { withWorkspace } from "@/integrations/supabase/workspace-middleware";

/**
 * Returns the execution key for a workflow the caller owns.
 * The key authorises the public /api/public/exec/... endpoints.
 */
export const getExecKey = createServerFn({ method: "POST" })
  .middleware([withWorkspace])
  .inputValidator((d: { workflowId: string }) =>
    z.object({ workflowId: z.string().uuid() }).parse(d),
  )
  .handler(async ({ data, context }): Promise<{ key: string }> => {
    const { data: row, error } = await context.supabase
      .from("workflows")
      .select("id")
      .eq("id", data.workflowId)
      .eq("user_id", context.userId)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!row) throw new Error("Workflow not found");

    const { execKeyFor } = await import("@/lib/exec-key.server");
    return { key: await execKeyFor(data.workflowId) };
  });
