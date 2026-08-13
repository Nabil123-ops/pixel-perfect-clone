import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

import type { ExecutionSummary, Json, RunResult, RunStep } from "@/lib/flow/types";

export const runWorkflowNow = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { workflowId: string; trigger?: Json[]; startNodeId?: string }) =>
    z
      .object({
        workflowId: z.string().uuid(),
        trigger: z.array(z.any()).max(500).optional(),
        startNodeId: z.string().optional(),
      })
      .parse(d),
  )
  .handler(async ({ data, context }): Promise<RunResult> => {
    const { runWorkflow } = await import("@/lib/engine/engine.server");
    return runWorkflow({
      workflowId: data.workflowId,
      userId: context.userId,
      mode: "manual",
      trigger: data.trigger ?? [],
      db: context.supabase,
      ...(data.startNodeId ? { startNodeId: data.startNodeId } : {}),
    });
  });

/** Runs exactly one node with the current graph — the "Test this node" button. */
export const runNodeNow = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { workflowId: string; nodeId: string; trigger?: Json[] }) =>
    z
      .object({
        workflowId: z.string().uuid(),
        nodeId: z.string().min(1),
        trigger: z.array(z.any()).max(200).optional(),
      })
      .parse(d),
  )
  .handler(async ({ data, context }): Promise<RunResult> => {
    const { runWorkflow } = await import("@/lib/engine/engine.server");
    return runWorkflow({
      workflowId: data.workflowId,
      userId: context.userId,
      mode: "manual",
      trigger: data.trigger ?? [],
      onlyNodeId: data.nodeId,
      persist: false,
      db: context.supabase,
    });
  });

export const listExecutions = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { workflowId?: string; limit?: number } | undefined) =>
    z
      .object({ workflowId: z.string().uuid().optional(), limit: z.number().max(200).optional() })
      .parse(d ?? {}),
  )
  .handler(async ({ data, context }): Promise<ExecutionSummary[]> => {
    let query = context.supabase
      .from("executions")
      .select("*")
      .eq("user_id", context.userId)
      .order("started_at", { ascending: false })
      .limit(data.limit ?? 100);
    if (data.workflowId) query = query.eq("workflow_id", data.workflowId);
    const { data: rows } = await query;
    return (rows ?? []).map((r) => ({
      id: r.id,
      workflowId: r.workflow_id,
      workflowName: r.workflow_name,
      mode: r.mode,
      status: r.status as ExecutionSummary["status"],
      error: r.error ?? null,
      startedAt: r.started_at,
      finishedAt: r.finished_at ?? null,
      ms: r.duration_ms ?? 0,
    }));
  });

export const getExecution = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { id: string }) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }): Promise<RunResult | null> => {
    const { data: run } = await context.supabase
      .from("executions")
      .select("*")
      .eq("id", data.id)
      .eq("user_id", context.userId)
      .maybeSingle();
    if (!run) return null;
    const { data: rows } = await context.supabase
      .from("execution_steps")
      .select("*")
      .eq("execution_id", data.id)
      .order("ordinal");
    const steps: RunStep[] = (rows ?? []).map((s) => ({
      nodeId: s.node_id,
      nodeKind: s.node_kind,
      label: s.label,
      status: s.status as RunStep["status"],
      ms: s.ms,
      attempts: s.attempts,
      input: (s.input ?? []) as Json[],
      items: (s.output ?? []) as Json[],
      logs: (s.logs ?? []) as string[],
      error: s.error ?? null,
    }));
    return {
      executionId: run.id,
      workflowId: run.workflow_id ?? "",
      workflowName: run.workflow_name,
      mode: run.mode,
      startedAt: run.started_at,
      finishedAt: run.finished_at ?? null,
      ms: run.duration_ms ?? 0,
      ok: run.status === "success",
      status: run.status as RunResult["status"],
      error: run.error ?? null,
      steps,
    };
  });

export const deleteExecutions = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { workflowId?: string }) =>
    z.object({ workflowId: z.string().uuid().optional() }).parse(d ?? {}),
  )
  .handler(async ({ data, context }) => {
    const query = context.supabase.from("executions").delete().eq("user_id", context.userId);
    if (data.workflowId) await query.eq("workflow_id", data.workflowId);
    else await query;
    return { ok: true };
  });
