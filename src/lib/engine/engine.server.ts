import { supabaseAdmin } from "@/integrations/supabase/client.server";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";
import { decryptJson } from "@/lib/crypto.server";
import { resolveExpr } from "@/lib/flow/expressions";
import { credentialTypeSpec } from "@/lib/flow/credentials";
import type { Json, RunResult, RunStep, StoredEdge, StoredNode } from "@/lib/flow/types";
import { getNode } from "@/lib/nodes/registry";
import type {
  ChatRequest,
  ChatResponse,
  ConnType,
  NodeOutput,
  SubNodeRef,
} from "@/lib/nodes/types";
import { parseJson, toItems } from "@/lib/nodes/types";
import { callChat, chatMemory, modelConfigFrom } from "./ai.server";
import { httpFetch } from "./http.server";

export { httpFetch };

export interface WorkflowRow {
  id: string;
  name: string;
  active: boolean;
  nodes: StoredNode[];
  edges: StoredEdge[];
  version: number;
  last_run_at: string | null;
  updated_at: string;
}

export async function fetchWorkflow(id: string, userId?: string, client: SupabaseClient<Database> = supabaseAdmin): Promise<WorkflowRow | null> {
  let query = client.from("workflows").select("*").eq("id", id);
  if (userId) query = query.eq("user_id", userId);
  const { data } = await query.maybeSingle();
  return (data as unknown as WorkflowRow | null) ?? null;
}

async function fetchWorkflowByName(name: string, userId?: string, client: SupabaseClient<Database> = supabaseAdmin): Promise<WorkflowRow | null> {
  let base = client.from("workflows").select("*");
  if (userId) base = base.eq("user_id", userId);
  const { data } = await base
    .ilike("name", name)
    .limit(1)
    .maybeSingle();
  return (data as unknown as WorkflowRow | null) ?? null;
}

/** All credentials, decrypted. Never leaves the server. */
export async function loadCredentialMap(userId?: string, client: SupabaseClient<Database> = supabaseAdmin): Promise<{
  byName: Record<string, Record<string, string>>;
  byId: Record<string, Record<string, string>>;
}> {
  let credQuery = client.from("credentials").select("id, name, data_encrypted");
  if (userId) credQuery = credQuery.eq("user_id", userId);
  const { data } = await credQuery;
  const byName: Record<string, Record<string, string>> = {};
  const byId: Record<string, Record<string, string>> = {};
  for (const row of data ?? []) {
    const fields = await decryptJson<Record<string, string>>(row.data_encrypted ?? "", {});
    byName[row.name] = fields;
    byId[row.id] = fields;
  }
  return { byName, byId };
}

export interface RunOptions {
  workflowId: string;
  /** Owner of the run. Scopes workflow + credential lookups to that account. */
  userId?: string;
  mode?: "manual" | "webhook" | "schedule" | "poll" | "sub" | "error";
  trigger?: Json[];
  startNodeId?: string;
  /** Run exactly one node (used by "Test this node") — no fan-out to successors. */
  onlyNodeId?: string;
  depth?: number;
  persist?: boolean;
  sessionId?: string;
  /** Authenticated user client for manual runs; public hooks use the admin client. */
  db?: SupabaseClient<Database>;
}

const isTriggerKind = (kind: string) => Boolean(getNode(kind)?.isTrigger);
const isSubNodeKind = (kind: string) => Boolean(getNode(kind)?.subType);
const connOf = (edge: StoredEdge): ConnType => {
  const target = (edge.targetHandle as ConnType | undefined) ?? "main";
  if (target !== "main") return target;
  // Older saved graphs only stored the source handle; typed AI links are recoverable from it.
  const source = edge.sourceHandle ?? "main";
  if (source.startsWith("ai_")) return source as ConnType;
  return "main";
};

/**
 * Root nodes (Agent, Chain, Vector store) declare required typed inputs, and
 * some nodes (AI models, vendor integrations) cannot do real work without a
 * credential attached. Returns a human-readable problem list — the run
 * refuses to start when non-empty, instead of failing deep inside execution.
 */
export function validateGraph(nodes: StoredNode[], edges: StoredEdge[]): string[] {
  const problems: string[] = [];
  for (const node of nodes) {
    const mod = getNode(node.data.kind);
    if (!mod) continue;
    const label = node.data.label || mod.name;
    for (const input of mod.inputs ?? []) {
      if (input.type === "main" || !input.required) continue;
      const wired = edges.some((e) => e.target === node.id && connOf(e) === input.type);
      if (!wired) problems.push(`${label} is missing a required ${input.label ?? input.type} connection`);
    }
    if (mod.credentialRequired) {
      const hasCredential = Boolean(node.data.credentials?.length || node.data.credential);
      if (!hasCredential) {
        const typeName = mod.credentialType ? credentialTypeSpec(mod.credentialType).name : "credential";
        problems.push(`${label} requires a ${typeName} credential — attach one in the inspector`);
      }
    }
  }
  return problems;
}

/** Executes a workflow graph server-side and records the execution. */
export async function runWorkflow(options: RunOptions): Promise<RunResult> {
  const { workflowId, mode = "manual", trigger = [], depth = 0, persist = true } = options;
  const db = options.db ?? supabaseAdmin;
  const flow = await fetchWorkflow(workflowId, options.userId, db);
  if (!flow) throw new Error("Workflow not found");
  const ownerId = (flow as unknown as { user_id?: string | null }).user_id ?? options.userId ?? null;

  const startedAt = new Date();
  let executionId = "";
  if (persist) {
    const { data, error } = await db
      .from("executions")
      .insert({
        ...(ownerId ? { user_id: ownerId } : {}),
        workflow_id: flow.id,
        workflow_name: flow.name,
        mode,
        status: "running",
        trigger_payload: trigger.slice(0, 20),
        started_at: startedAt.toISOString(),
      })
      .select("id")
      .single();
    if (error) throw new Error(error.message);
    executionId = data?.id ?? "";
  }

  const { byName, byId } = await loadCredentialMap(ownerId ?? undefined, db);
  const nodes = flow.nodes ?? [];
  const edges = flow.edges ?? [];
  const byNodeId = new Map(nodes.map((n) => [n.id, n]));
  const incoming = new Map<string, StoredEdge[]>();
  const outgoing = new Map<string, StoredEdge[]>();
  for (const edge of edges) {
    outgoing.set(edge.source, [...(outgoing.get(edge.source) ?? []), edge]);
    incoming.set(edge.target, [...(incoming.get(edge.target) ?? []), edge]);
  }

  const problems = validateGraph(nodes, edges);
  if (problems.length) {
    const message = problems.join("; ");
    if (persist && executionId) {
      await db
        .from("executions")
        .update({
          status: "error",
          error: message,
          finished_at: new Date().toISOString(),
          duration_ms: 0,
        })
        .eq("id", executionId);
    }
    return {
      executionId,
      workflowId: flow.id,
      workflowName: flow.name,
      mode,
      startedAt: startedAt.toISOString(),
      finishedAt: new Date().toISOString(),
      ms: 0,
      ok: false,
      status: "error",
      error: message,
      steps: [],
    };
  }

  const flowId = flow.id;
  const sessionId = options.sessionId ?? `${flow.id}:${startedAt.getTime()}`;

  const steps: RunStep[] = [];
  const nodeOutputs: Record<string, Json[]> = {};
  const buffers = new Map<string, Json[]>();
  const done = new Set<string>();
  let ok = true;
  let fatal: string | null = null;

  const mainIncoming = new Map<string, StoredEdge[]>();
  for (const [target, list] of incoming) {
    mainIncoming.set(
      target,
      list.filter((e) => connOf(e) === "main"),
    );
  }

  const startNodes = options.onlyNodeId
    ? nodes.filter((n) => n.id === options.onlyNodeId)
    : options.startNodeId
    ? nodes.filter((n) => n.id === options.startNodeId)
    : nodes.filter((n) => isTriggerKind(n.data.kind) && (mainIncoming.get(n.id) ?? []).length === 0);
  const queue: string[] = startNodes.length
    ? startNodes.map((n) => n.id)
    : nodes
        .filter((n) => !isSubNodeKind(n.data.kind) && (mainIncoming.get(n.id) ?? []).length === 0)
        .map((n) => n.id);

  /** Names of every credential attached to a node — new `credentials[]` first, falling back to the legacy single `credential`. */
  const credentialNamesFor = (data: StoredNode["data"]): string[] =>
    data.credentials?.length ? data.credentials : data.credential ? [data.credential] : [];

  /** Resolve attached credential names into `{ merged, byName }`, decrypted via `byName` (the account-wide map). */
  const resolveCredentials = (
    names: string[],
  ): { merged: Record<string, string>; byName: Record<string, Record<string, string>> } => {
    const map: Record<string, Record<string, string>> = {};
    for (const name of names) map[name] = byName[name] ?? {};
    const merged = Object.assign({}, ...names.map((n) => map[n] ?? {})) as Record<string, string>;
    return { merged, byName: map };
  };

  const ready = (nodeId: string) =>
    Boolean(options.onlyNodeId) ||
    (mainIncoming.get(nodeId) ?? []).every((e) => done.has(e.source) || !byNodeId.has(e.source));

  /** Resolve typed sub-node connections for a root node into callable refs. */
  const subNodesFor = (nodeId: string): Partial<Record<ConnType, SubNodeRef[]>> => {
    const out: Partial<Record<ConnType, SubNodeRef[]>> = {};
    for (const edge of incoming.get(nodeId) ?? []) {
      const conn = connOf(edge);
      if (conn === "main") continue;
      const source = byNodeId.get(edge.source);
      const sourceMod = source && getNode(source.data.kind);
      if (!source || !sourceMod) continue;
      const sourceCreds = resolveCredentials(credentialNamesFor(source.data));
      const ref: SubNodeRef = {
        kind: source.data.kind,
        label: source.data.label || sourceMod.name,
        params: source.data.params ?? {},
        credential: sourceCreds.merged,
        credentials: sourceCreds.byName,
        invoke: async (items) => {
          const result = await sourceMod.execute(makeContext(source, items, []));
          return result?.['main'] ?? Object.values(result ?? {})[0] ?? [];
        },
      };
      out[conn] = [...(out[conn] ?? []), ref];
    }
    return out;
  };

  /** Build the execution context handed to a node module. */
  function makeContext(node: StoredNode, input: Json[], logs: string[]) {
    const subNodes = subNodesFor(node.id);
    const nodeCreds = resolveCredentials(credentialNamesFor(node.data));
    return {
      items: input,
      params: node.data.params ?? {},
      credential: nodeCreds.merged,
      credentials: nodeCreds.byName,
      creds: byName,
      trigger,
      nodeOutputs,
      subNodes,
      sessionId,
      expr: (value: unknown, item: Json, index: number) =>
        resolveExpr(value, { item, index, creds: byName, nodes: nodeOutputs }),
      log: (message: string) => {
        logs.push(message);
      },
      http: httpFetch,
      chat: async (req: ChatRequest): Promise<ChatResponse> => {
        const cfg = modelConfigFrom(subNodes['ai_languageModel']?.[0]);
        if (!cfg) throw new Error("Connect a Chat Model sub-node to this node");
        logs.push(`Model ${cfg.provider}/${cfg.model} · ${req.messages.length} message(s)`);
        return callChat(cfg, req);
      },
      memory: {
        load: (sid: string, limit: number) => chatMemory.load(sid, limit),
        append: (sid: string, messages: Parameters<typeof chatMemory.append>[1]) =>
          chatMemory.append(sid, messages, flowId),
      },
      callWorkflow: async (target: string, items: Json[]) => {
        if (depth >= 3) throw new Error("Sub-workflow depth limit reached");
        const child =
           (await fetchWorkflow(target, ownerId ?? undefined, db).catch(() => null)) ??
           (await fetchWorkflowByName(target, ownerId ?? undefined, db));
        if (!child) throw new Error(`Workflow "${target}" not found`);
        const result = await runWorkflow({
          workflowId: child.id,
          ...(ownerId ? { userId: ownerId } : {}),
          mode: "sub",
          trigger: items,
          depth: depth + 1,
          db,
        });
        if (!result.ok) throw new Error(result.error ?? "Sub-workflow failed");
        return result.steps.at(-1)?.items ?? [];
      },
    };
  }

  while (queue.length) {
    const nodeId = queue.shift()!;
    if (done.has(nodeId)) continue;
    const node = byNodeId.get(nodeId);
    if (!node) continue;
    if (!ready(nodeId)) {
      queue.push(nodeId);
      if (queue.every((id) => !ready(id))) break;
      continue;
    }

    const input = buffers.get(nodeId) ?? [];
    const mod = getNode(node.data.kind);
    const logs: string[] = [];
    const label = node.data.label || mod?.name || node.data.kind;
    const started = Date.now();
    const retries = Math.max(0, Number(node.data.retries ?? 0));
    let attempts = 0;
    let outputs: NodeOutput | null = null;
    let error: string | null = null;

    const pinned = node.data.pinned ? toItems(parseJson(node.data.pinned, null)) : null;

    if (pinned && pinned.length) {
      outputs = { main: pinned };
      logs.push("Using pinned data (node not executed)");
      attempts = 1;
    } else if (!mod) {
      error = `Unknown node type "${node.data.kind}"`;
      attempts = 1;
    } else {
      while (attempts <= retries) {
        attempts += 1;
        try {
          outputs = await mod.execute(makeContext(node, input, logs));
          error = null;
          break;
        } catch (err) {
          error = err instanceof Error ? err.message : String(err);
          if (attempts <= retries) logs.push(`Attempt ${attempts} failed: ${error} — retrying`);
        }
      }
    }

    const ms = Date.now() - started;

    if (error && node.data.onError === "continue") {
      logs.push("Continuing on failure — input passed through");
      outputs = { main: input };
      steps.push({
        nodeId,
        nodeKind: node.data.kind,
        label,
        status: "error",
        ms,
        attempts,
        input,
        items: input,
        logs,
        error,
      });
    } else if (error) {
      ok = false;
      fatal = `${label}: ${error}`;
      steps.push({
        nodeId,
        nodeKind: node.data.kind,
        label,
        status: "error",
        ms,
        attempts,
        input,
        items: [],
        logs,
        error,
      });
      done.add(nodeId);
      break;
    } else {
      const primary = outputs?.['main'] ?? Object.values(outputs ?? {})[0] ?? [];
      steps.push({
        nodeId,
        nodeKind: node.data.kind,
        label,
        status: "success",
        ms,
        attempts,
        input,
        items: primary,
        logs,
        error: null,
      });
      nodeOutputs[label] = primary;
    }

    done.add(nodeId);

    // Persist each completed step immediately. The execution drawer and editor
    // poll this row while the run is active, producing live node status/logs.
    if (persist && executionId) {
      const step = steps.at(-1);
      if (step) {
        const { error: stepError } = await db.from("execution_steps").insert({
          ...(ownerId ? { user_id: ownerId } : {}),
          execution_id: executionId,
          ordinal: steps.length - 1,
          node_id: step.nodeId,
          node_kind: step.nodeKind,
          label: step.label,
          status: step.status,
          ms: step.ms,
          attempts: step.attempts,
          input: step.input.slice(0, 50),
          output: step.items.slice(0, 50),
          logs: step.logs,
          error: step.error ?? null,
        });
        if (stepError) throw new Error(stepError.message);
      }
    }

    if (options.onlyNodeId) break;

    for (const edge of outgoing.get(nodeId) ?? []) {
      const handle = edge.sourceHandle ?? "main";
      const payload = outputs?.[handle] ?? (handle === "main" ? (outputs?.['main'] ?? []) : []);
      buffers.set(edge.target, [...(buffers.get(edge.target) ?? []), ...payload]);
      if (!queue.includes(edge.target)) queue.push(edge.target);
    }
  }

  const finishedAt = new Date();
  const result: RunResult = {
    executionId,
    workflowId: flow.id,
    workflowName: flow.name,
    mode,
    startedAt: startedAt.toISOString(),
    finishedAt: finishedAt.toISOString(),
    ms: finishedAt.getTime() - startedAt.getTime(),
    ok,
    status: ok ? "success" : "error",
    error: fatal,
    steps,
  };

  if (persist && executionId) {
    await db
      .from("executions")
      .update({
        status: result.status,
        error: fatal,
        finished_at: result.finishedAt ?? null,
        duration_ms: result.ms,
      })
      .eq("id", executionId);
    await db
      .from("workflows")
      .update({ last_run_at: finishedAt.toISOString() })
      .eq("id", flow.id);
  }

  if (!ok && mode !== "error" && depth === 0) await runErrorWorkflows(result, ownerId, db);

  return result;
}

/** Fires any active workflow that starts with an Error Trigger. */
async function runErrorWorkflows(failed: RunResult, ownerId: string | null, db: SupabaseClient<Database>) {
  let errorQuery = db.from("workflows").select("*").eq("active", true);
  if (ownerId) errorQuery = errorQuery.eq("user_id", ownerId);
  const { data } = await errorQuery;
  for (const row of (data ?? []) as unknown as WorkflowRow[]) {
    const hasErrorTrigger = (row.nodes ?? []).some((n) => n.data.kind === "errorTrigger");
    if (!hasErrorTrigger || row.id === failed.workflowId) continue;
    await runWorkflow({
      workflowId: row.id,
      ...(ownerId ? { userId: ownerId } : {}),
      mode: "error",
      trigger: [
        {
          workflowId: failed.workflowId,
          workflowName: failed.workflowName,
          executionId: failed.executionId,
          error: failed.error,
          failedNode: failed.steps.at(-1)?.label ?? null,
        },
      ],
      depth: 1,
      db,
    }).catch(() => undefined);
  }
}
