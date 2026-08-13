import { chatMemory } from "./ai.server";
import type { ChatMessage } from "@/lib/nodes/types";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import type { Json } from "@/lib/flow/types";
import { getNode } from "@/lib/nodes/registry";
import { fetchWorkflow, httpFetch, loadCredentialMap, runWorkflow } from "./engine.server";
import { resolveExpr } from "@/lib/flow/expressions";

/** Minimal 5-field cron matcher (minute hour day month weekday). */
export function cronMatches(expr: string, date: Date): boolean {
  const parts = expr.trim().split(/\s+/);
  if (parts.length !== 5) return false;
  const values = [
    date.getUTCMinutes(),
    date.getUTCHours(),
    date.getUTCDate(),
    date.getUTCMonth() + 1,
    date.getUTCDay(),
  ];
  return parts.every((part, i) => matchField(part, values[i] as number));
}

function matchField(field: string, value: number): boolean {
  return field.split(",").some((chunk) => {
    if (chunk === "*") return true;
    const step = chunk.match(/^(\*|\d+-\d+)\/(\d+)$/);
    if (step) {
      const every = Number(step[2]);
      if (step[1] === "*") return value % every === 0;
      const [from, to] = (step[1] as string).split("-").map(Number);
      return value >= (from as number) && value <= (to as number) && (value - (from as number)) % every === 0;
    }
    const range = chunk.match(/^(\d+)-(\d+)$/);
    if (range) return value >= Number(range[1]) && value <= Number(range[2]);
    return Number(chunk) === value;
  });
}

interface TickResult {
  checked: number;
  triggered: { workflowId: string; nodeId: string; kind: string; executionId: string }[];
}

/**
 * Server-side tick for schedule and polling triggers. Invoked every minute by a
 * database cron job — never by an open browser tab.
 */
export async function tickTriggers(now = new Date()): Promise<TickResult> {
  const { data } = await supabaseAdmin.from("workflows").select("id").eq("active", true);
  const triggered: TickResult["triggered"] = [];
  let checked = 0;

  for (const { id } of data ?? []) {
    const flow = await fetchWorkflow(id);
    if (!flow) continue;

    for (const node of flow.nodes ?? []) {
      const mod = getNode(node.data.kind);
      if (!mod?.isTrigger) continue;
      const params = node.data.params ?? {};

      const { data: stateRow } = await supabaseAdmin
        .from("trigger_state")
        .select("*")
        .eq("workflow_id", flow.id)
        .eq("node_id", node.id)
        .maybeSingle();

      if (node.data.kind === "scheduleTrigger") {
        checked += 1;
        const mode = String(params["mode"] ?? "interval");
        const lastRun = stateRow?.last_run_at ? new Date(stateRow.last_run_at) : null;
        let due = false;
        if (mode === "cron") {
          due =
            cronMatches(String(params["cron"] ?? "* * * * *"), now) &&
            (!lastRun || now.getTime() - lastRun.getTime() >= 55_000);
        } else {
          const minutes = Math.max(1, Number(params["minutes"] ?? 5));
          due = !lastRun || now.getTime() - lastRun.getTime() >= minutes * 60_000 - 5_000;
        }
        if (!due) continue;

        await upsertState(flow.id, node.id, now, stateRow?.seen as string[] | undefined);
        const run = await runWorkflow({
          workflowId: flow.id,
          mode: "schedule",
          trigger: [{ triggeredAt: now.toISOString(), nodeId: node.id }],
          startNodeId: node.id,
        });
        triggered.push({
          workflowId: flow.id,
          nodeId: node.id,
          kind: node.data.kind,
          executionId: run.executionId,
        });
        continue;
      }

      if (!mod.poll) continue;
      checked += 1;
      const minutes = Math.max(1, Number(params["minutes"] ?? 5));
      const lastRun = stateRow?.last_run_at ? new Date(stateRow.last_run_at) : null;
      if (lastRun && now.getTime() - lastRun.getTime() < minutes * 60_000 - 5_000) continue;

      const { byName } = await loadCredentialMap();
      const seen = ((stateRow?.seen as string[] | null) ?? []).slice(-500);
      let items: Json[] = [];
      let nextSeen = seen;
      try {
        const polled = await mod.poll({
          items: [],
          params,
          credential: (node.data.credential ? byName[node.data.credential] : undefined) ?? {},
          creds: byName,
          trigger: [],
          nodeOutputs: {},
      subNodes: {},
      sessionId: `poll:${node.id}`,
      chat: async () => {
        throw new Error("Poll triggers cannot call a chat model");
      },
      memory: {
        load: (sid: string, limit: number) => chatMemory.load(sid, limit),
        append: (sid: string, messages: ChatMessage[]) => chatMemory.append(sid, messages),
      },
          expr: (value, item, index) => resolveExpr(value, { item, index, creds: byName }),
          log: () => undefined,
          http: httpFetch,
          callWorkflow: async () => [],
          seen,
        });
        items = polled.items;
        nextSeen = polled.seen.slice(-500);
      } catch {
        continue;
      }

      await upsertState(flow.id, node.id, now, nextSeen);
      if (!items.length) continue;

      const run = await runWorkflow({
        workflowId: flow.id,
        mode: "poll",
        trigger: items,
        startNodeId: node.id,
      });
      triggered.push({
        workflowId: flow.id,
        nodeId: node.id,
        kind: node.data.kind,
        executionId: run.executionId,
      });
    }
  }

  return { checked, triggered };
}

async function upsertState(
  workflowId: string,
  nodeId: string,
  now: Date,
  seen: string[] | undefined,
) {
  await supabaseAdmin.from("trigger_state").upsert(
    {
      workflow_id: workflowId,
      node_id: nodeId,
      last_run_at: now.toISOString(),
      seen: (seen ?? []) as never,
    },
    { onConflict: "workflow_id,node_id" },
  );
}
