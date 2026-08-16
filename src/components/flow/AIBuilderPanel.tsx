import { useRef, useState } from "react";
import { Bot, Loader2, Send, Sparkles, User } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { CATALOG, specOf } from "@/lib/flow/catalog";
import { uid } from "@/lib/flow/store";
import type { StoredEdge, StoredNode } from "@/lib/flow/types";
import {
  DEFAULT_PUTER_MODEL,
  PUTER_MODELS,
  extractJson,
  puterChat,
  type PuterMessage,
} from "@/lib/puter";

interface Draft {
  name?: string;
  nodes: StoredNode[];
  edges: StoredEdge[];
}

interface AiNode {
  id?: string;
  kind?: string;
  label?: string;
  params?: Record<string, unknown>;
  position?: { x: number; y: number };
}
interface AiEdge {
  from?: string;
  to?: string;
  source?: string;
  target?: string;
  sourceHandle?: string;
  targetHandle?: string;
}
interface AiPlan {
  name?: string;
  explanation?: string;
  nodes?: AiNode[];
  edges?: AiEdge[];
}

/** Always-available building blocks the model can safely reach for. */
const CORE_GROUPS = new Set(["Trigger", "Triggers", "Core", "Flow", "Logic", "Data", "AI", "Files"]);

function catalogHint(prompt: string): string {
  const words = prompt.toLowerCase().split(/[^a-z0-9]+/).filter((w) => w.length > 2);
  const core = CATALOG.filter((s) => CORE_GROUPS.has(String(s.group)));
  const matched = CATALOG.filter(
    (s) =>
      !core.includes(s) &&
      words.some(
        (w) =>
          s.kind.toLowerCase().includes(w) ||
          s.name.toLowerCase().includes(w) ||
          s.keywords.some((k) => k.toLowerCase().includes(w)),
      ),
  ).slice(0, 60);
  return [...core, ...matched].map((s) => `${s.kind} — ${s.name}`).join("\n");
}

const SYSTEM = `You design automation workflows for n9n, a visual node-based automation studio (like n8n).
Reply with ONLY a JSON object, no prose outside it, in this exact shape:
{"name":"Workflow name","explanation":"one short sentence","nodes":[{"id":"n1","kind":"webhookTrigger","label":"Webhook","params":{}}],"edges":[{"from":"n1","to":"n2","sourceHandle":"main","targetHandle":"main"}]}
Rules:
- "kind" MUST be one of the allowed node kinds listed by the user. Never invent a kind.
- Start with exactly one trigger node (manualTrigger, webhookTrigger, scheduleTrigger, chatTrigger, formTrigger).
- Use "if"/"switch" for branching; their outputs use sourceHandle "true"/"false" or "out0","out1",...
- AI model / memory / tool nodes attach to an aiAgent with sourceHandle AND targetHandle set to
  "ai_languageModel", "ai_memory" or "ai_tool" (from = the model node, to = the agent).
- Keep params realistic; expressions look like {{ $json.field }}.
- 3 to 12 nodes. IDs are short strings you invent and reference in edges.`;

/**
 * Chat-to-chat workflow builder. Runs entirely in the browser through Puter.js
 * (no API key, no server function), so it works identically on Cloudflare Pages.
 */
export function AIBuilderPanel({
  current,
  onApply,
}: {
  current: { nodes: StoredNode[]; edges: StoredEdge[] };
  onApply: (draft: Draft, mode: "replace" | "merge") => void;
}) {
  const [messages, setMessages] = useState<{ role: "user" | "assistant"; content: string }[]>([]);
  const [input, setInput] = useState("");
  const [model, setModel] = useState<string>(DEFAULT_PUTER_MODEL);
  const [pending, setPending] = useState(false);
  const [plan, setPlan] = useState<Draft | null>(null);
  const scroller = useRef<HTMLDivElement>(null);

  const send = async (text?: string) => {
    const content = (text ?? input).trim();
    if (!content || pending) return;
    setMessages((m) => [...m, { role: "user", content }]);
    setInput("");
    setPending(true);

    const context =
      current.nodes.length > 0
        ? `Current canvas (edit it if the user asks for changes):\n${JSON.stringify(
            {
              nodes: current.nodes.map((n) => ({ id: n.id, kind: n.data.kind, label: n.data.label })),
              edges: current.edges.map((e) => ({ from: e.source, to: e.target })),
            },
            null,
            0,
          )}`
        : "The canvas is empty.";

    const history: PuterMessage[] = [
      { role: "system", content: SYSTEM },
      {
        role: "user",
        content: `Allowed node kinds:\n${catalogHint(content)}\n\n${context}\n\nRequest: ${content}`,
      },
    ];

    try {
      const reply = await puterChat(history, model);
      const parsed = extractJson<AiPlan>(reply);
      const draft = toDraft(parsed);
      if (!draft.nodes.length) throw new Error("The model returned no usable nodes");
      setPlan(draft);
      setMessages((m) => [
        ...m,
        {
          role: "assistant",
          content: `${parsed.explanation ?? "Here's the workflow."}\n\n${draft.nodes
            .map((n) => `• ${n.data.label} (${n.data.kind})`)
            .join("\n")}`,
        },
      ]);
    } catch (err) {
      setMessages((m) => [
        ...m,
        { role: "assistant", content: `⚠️ ${err instanceof Error ? err.message : "Generation failed"}` },
      ]);
    } finally {
      setPending(false);
      requestAnimationFrame(() =>
        scroller.current?.scrollTo({ top: scroller.current.scrollHeight, behavior: "smooth" }),
      );
    }
  };

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="flex items-center gap-2 border-b border-border px-3 py-2">
        <Sparkles className="size-3.5 text-primary" />
        <span className="font-display text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          Build with AI
        </span>
        <select
          value={model}
          onChange={(e) => setModel(e.target.value)}
          className="ml-auto h-7 rounded-md border border-input bg-background px-2 text-[11px]"
          aria-label="Model"
        >
          {PUTER_MODELS.map((m) => (
            <option key={m.id} value={m.id}>
              {m.label}
            </option>
          ))}
        </select>
      </div>

      <div ref={scroller} className="min-h-0 flex-1 space-y-3 overflow-y-auto p-3">
        {messages.length === 0 && (
          <div className="space-y-2 text-[11px] text-muted-foreground">
            <p>
              Describe the automation you want and it is built straight onto this canvas — powered by
              Puter.js in your browser, so no API key or extra setup is needed.
            </p>
            {[
              "When a webhook fires, ask DeepSeek to summarize the payload and post it to Slack",
              "Every hour fetch an API, filter failures and email me a digest",
              "A chat assistant with memory that can search the web",
            ].map((s) => (
              <button
                key={s}
                onClick={() => void send(s)}
                className="block w-full rounded-md border border-border px-2 py-1.5 text-left hover:bg-secondary"
              >
                {s}
              </button>
            ))}
          </div>
        )}
        {messages.map((m, i) => (
          <div key={i} className="flex gap-2 text-[11px]">
            {m.role === "user" ? (
              <User className="mt-0.5 size-3.5 shrink-0 text-muted-foreground" />
            ) : (
              <Bot className="mt-0.5 size-3.5 shrink-0 text-primary" />
            )}
            <p className="whitespace-pre-wrap leading-relaxed">{m.content}</p>
          </div>
        ))}
        {pending && (
          <p className="flex items-center gap-2 text-[11px] text-muted-foreground">
            <Loader2 className="size-3.5 animate-spin" /> Designing the workflow…
          </p>
        )}
      </div>

      {plan && (
        <div className="flex items-center gap-2 border-t border-border px-3 py-2">
          <span className="truncate text-[11px] text-muted-foreground">
            {plan.nodes.length} nodes · {plan.edges.length} connections ready
          </span>
          <Button
            size="sm"
            className="ml-auto h-7 text-[11px]"
            onClick={() => {
              onApply(plan, "replace");
              toast.success("Workflow built on the canvas");
            }}
          >
            Replace canvas
          </Button>
          <Button
            size="sm"
            variant="outline"
            className="h-7 text-[11px]"
            onClick={() => {
              onApply(plan, "merge");
              toast.success("Nodes added to the canvas");
            }}
          >
            Add to canvas
          </Button>
        </div>
      )}

      <div className="flex items-end gap-2 border-t border-border p-2">
        <Textarea
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              void send();
            }
          }}
          placeholder="Describe a workflow, or ask for a change to this one…"
          className="max-h-24 min-h-[38px] resize-none text-xs"
        />
        <Button size="sm" className="h-9" disabled={pending || !input.trim()} onClick={() => void send()}>
          <Send className="size-4" />
        </Button>
      </div>
    </div>
  );
}

/** Validates the model's plan against the real node registry and lays it out. */
function toDraft(plan: AiPlan): Draft {
  const idMap = new Map<string, string>();
  const nodes: StoredNode[] = [];
  const laneCount = new Map<number, number>();

  (plan.nodes ?? []).forEach((n, i) => {
    const kind = String(n.kind ?? "");
    const spec = specOf(kind);
    if (!kind || spec.name === kind) return; // unknown kind — drop it
    const id = uid();
    idMap.set(String(n.id ?? i), id);
    const column = i;
    const lane = laneCount.get(column) ?? 0;
    laneCount.set(column, lane + 1);
    nodes.push({
      id,
      position: n.position ?? { x: 80 + column * 300, y: 140 + (i % 3) * 170 },
      data: {
        kind: kind as StoredNode["data"]["kind"],
        label: String(n.label ?? spec.name),
        params: { ...spec.defaults, ...(n.params ?? {}) } as StoredNode["data"]["params"],
      },
    });
  });

  const edges: StoredEdge[] = [];
  for (const e of plan.edges ?? []) {
    const source = idMap.get(String(e.from ?? e.source ?? ""));
    const target = idMap.get(String(e.to ?? e.target ?? ""));
    if (!source || !target || source === target) continue;
    edges.push({
      id: uid(),
      source,
      target,
      sourceHandle: e.sourceHandle ?? "main",
      targetHandle: e.targetHandle ?? "main",
    });
  }

  return { ...(plan.name ? { name: plan.name } : {}), nodes, edges };
}
