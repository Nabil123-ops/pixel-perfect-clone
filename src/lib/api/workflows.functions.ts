import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

import type { StoredEdge, StoredNode } from "@/lib/flow/types";

const nodeSchema = z.object({
  id: z.string(),
  position: z.object({ x: z.number(), y: z.number() }),
  data: z
    .object({
      kind: z.string(),
      label: z.string(),
      params: z.record(z.string(), z.any()).default({}),
      retries: z.number().optional(),
      onError: z.enum(["stop", "continue"]).optional(),
      credential: z.string().optional(),
      pinned: z.string().optional(),
    })
    .passthrough(),
});

const edgeSchema = z.object({
  id: z.string(),
  source: z.string(),
  target: z.string(),
  sourceHandle: z.string().nullish(),
  targetHandle: z.string().nullish(),
});

const saveSchema = z.object({
  id: z.string().uuid().optional(),
  name: z.string().min(1).max(120),
  active: z.boolean().default(false),
  nodes: z.array(nodeSchema).max(500),
  edges: z.array(edgeSchema).max(2000),
});

export const listWorkflows = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
  const { data, error } = await context.supabase
    .from("workflows")
    .select("id, name, active, nodes, edges, version, last_run_at, updated_at")
    .eq("user_id", context.userId)
    .order("updated_at", { ascending: false })
    .limit(200);
  if (error) throw new Error(error.message);
  return (data ?? []).map((row) => ({
    id: row.id,
    name: row.name,
    active: row.active,
    nodes: (row.nodes ?? []) as unknown as StoredNode[],
    edges: (row.edges ?? []) as unknown as StoredEdge[],
    version: row.version,
    lastRunAt: row.last_run_at,
    updatedAt: row.updated_at,
  }));
});

export const getWorkflow = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { id: string }) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { data: row, error } = await context.supabase
      .from("workflows")
      .select("*")
      .eq("id", data.id)
      .eq("user_id", context.userId)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!row) return null;
    return {
      id: row.id,
      name: row.name,
      active: row.active,
      nodes: (row.nodes ?? []) as unknown as StoredNode[],
      edges: (row.edges ?? []) as unknown as StoredEdge[],
      version: row.version,
      lastRunAt: row.last_run_at,
      updatedAt: row.updated_at,
    };
  });

export const saveWorkflow = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => saveSchema.parse(d))
  .handler(async ({ data, context }) => {
    const db = context.supabase;
    const payload = {
      user_id: context.userId,
      name: data.name,
      active: data.active,
      nodes: data.nodes as never,
      edges: data.edges as never,
    };

    if (!data.id) {
      const { data: row, error } = await db
        .from("workflows")
        .insert(payload)
        .select("id, version")
        .single();
      if (error) throw new Error(error.message);
      return { id: row.id, version: row.version };
    }

    const { data: current, error: currentError } = await db
      .from("workflows")
      .select("version, name, nodes, edges")
      .eq("id", data.id)
      .eq("user_id", context.userId)
      .maybeSingle();
    if (currentError) throw new Error(currentError.message);

    if (!current) throw new Error("Workflow not found");

    if (current) {
      // Snapshot the previous state so the editor can offer version history.
      const { error: snapshotError } = await db.from("workflow_versions").insert({
        user_id: context.userId,
        workflow_id: data.id,
        version: current.version,
        name: current.name,
        nodes: current.nodes,
        edges: current.edges,
      });
      if (snapshotError) throw new Error(snapshotError.message);
    }

    const nextVersion = (current?.version ?? 0) + 1;
    const { error } = await db
      .from("workflows")
      .update({ ...payload, version: nextVersion })
      .eq("id", data.id)
      .eq("user_id", context.userId);
    if (error) throw new Error(error.message);
    return { id: data.id, version: nextVersion };
  });

export const setWorkflowActive = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { id: string; active: boolean }) =>
    z.object({ id: z.string().uuid(), active: z.boolean() }).parse(d),
  )
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase
      .from("workflows")
      .update({ active: data.active })
      .eq("id", data.id)
      .eq("user_id", context.userId);
    if (error) throw new Error(error.message);
    return { active: data.active };
  });

export const deleteWorkflow = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { id: string }) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase
      .from("workflows")
      .delete()
      .eq("id", data.id)
      .eq("user_id", context.userId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const listWorkflowVersions = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { id: string }) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { data: rows, error } = await context.supabase
      .from("workflow_versions")
      .select("id, version, name, created_at")
      .eq("user_id", context.userId)
      .eq("workflow_id", data.id)
      .order("version", { ascending: false })
      .limit(50);
    if (error) throw new Error(error.message);
    return (rows ?? []).map((r) => ({
      id: r.id,
      version: r.version,
      name: r.name,
      createdAt: r.created_at,
    }));
  });

export const restoreWorkflowVersion = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { versionId: string }) =>
    z.object({ versionId: z.string().uuid() }).parse(d),
  )
  .handler(async ({ data, context }) => {
    const db = context.supabase;
    const { data: snap, error: snapError } = await db
      .from("workflow_versions")
      .select("*")
      .eq("id", data.versionId)
      .eq("user_id", context.userId)
      .maybeSingle();
    if (snapError) throw new Error(snapError.message);
    if (!snap) throw new Error("Version not found");
    const { data: current, error: currentError } = await db
      .from("workflows")
      .select("version")
      .eq("id", snap.workflow_id)
      .eq("user_id", context.userId)
      .maybeSingle();
    if (currentError) throw new Error(currentError.message);
    const { error: updateError } = await db
      .from("workflows")
      .update({
        name: snap.name,
        nodes: snap.nodes,
        edges: snap.edges,
        version: (current?.version ?? 0) + 1,
      })
      .eq("id", snap.workflow_id)
      .eq("user_id", context.userId);
    if (updateError) throw new Error(updateError.message);
    return { workflowId: snap.workflow_id };
  });
