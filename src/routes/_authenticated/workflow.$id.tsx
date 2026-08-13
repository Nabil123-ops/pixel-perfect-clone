import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import {
  ReactFlow,
  Background,
  BackgroundVariant,
  Controls,
  MiniMap,
  addEdge,
  useEdgesState,
  useNodesState,
  type Connection,
  type Edge,
  type Node,
  type NodeTypes,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ChevronDown,
  ChevronRight,
  ChevronUp,
  History,
  Link2,
  Play,
  Plus,
  Save,
  Search,
  User,
} from "lucide-react";
import { toast } from "sonner";

import { Shell } from "@/components/Shell";
import { FlowNodeCard, type NodeStatus } from "@/components/flow/FlowNodeCard";
import { CredentialsDialog } from "@/components/flow/CredentialsDialog";
import { Inspector } from "@/components/flow/Inspector";
import { Hint } from "@/components/flow/Hint";
import { EndpointPanel } from "@/components/flow/EndpointPanel";
import { RunPanel } from "@/components/flow/RunPanel";
import { WebhookConsole } from "@/components/flow/WebhookConsole";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { NODE_GROUPS } from "@/lib/nodes/registry";
import { searchCatalog, specOf } from "@/lib/flow/catalog";
import { NodeIcon } from "@/components/flow/NodeIcon";
import {
  runWorkflowNow,
  runNodeNow,
  listExecutions,
  getExecution,
} from "@/lib/api/executions.functions";
import {
  getWorkflow,
  listWorkflowVersions,
  restoreWorkflowVersion,
  saveWorkflow,
  setWorkflowActive,
} from "@/lib/api/workflows.functions";
import { uid } from "@/lib/flow/store";
import type { FlowNodeKind, RunResult, StoredEdge, StoredNode } from "@/lib/flow/types";

export const Route = createFileRoute("/_authenticated/workflow/$id")({
  head: () => ({
    meta: [
      { title: "Workflow editor — n9n" },
      {
        name: "description",
        content:
          "Drag, connect and run automation nodes on a live canvas. Every run executes on the server with full per-node logs.",
      },
      { property: "og:title", content: "Workflow editor — n9n" },
      {
        property: "og:description",
        content: "Visual automation editor backed by a real server-side execution engine.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: EditorPage,
});

const nodeTypes: NodeTypes = { flow: FlowNodeCard };

type NodeData = StoredNode["data"] & { status?: NodeStatus; itemCount?: number };

const toStored = (n: Node): StoredNode => {
  const d = n.data as unknown as NodeData;
  return {
    id: n.id,
    position: n.position,
    data: {
      kind: d.kind,
      label: d.label,
      params: d.params ?? {},
      ...(d.retries !== undefined ? { retries: d.retries } : {}),
      ...(d.onError ? { onError: d.onError } : {}),
      ...(d.credential ? { credential: d.credential } : {}),
      ...(d.pinned ? { pinned: d.pinned } : {}),
    },
  };
};

function EditorPage() {
  const { id } = Route.useParams();
  const navigate = useNavigate();
  const qc = useQueryClient();

  const load = useServerFn(getWorkflow);
  const save = useServerFn(saveWorkflow);
  const activate = useServerFn(setWorkflowActive);
  const run = useServerFn(runWorkflowNow);
  const runNode = useServerFn(runNodeNow);
  const history = useServerFn(listExecutions);
  const execution = useServerFn(getExecution);
  const versions = useServerFn(listWorkflowVersions);
  const restore = useServerFn(restoreWorkflowVersion);

  const [nodes, setNodes, onNodesChange] = useNodesState<Node>([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState<Edge>([]);
  const [name, setName] = useState("");
  const [active, setActive] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [result, setResult] = useState<RunResult | null>(null);
  const [panelOpen, setPanelOpen] = useState(true);
  const [running, setRunning] = useState(false);
  const [testingNode, setTestingNode] = useState(false);
  const [query, setQuery] = useState("");
  const [group, setGroup] = useState<string>("All");
  const [showHistory, setShowHistory] = useState(false);
  const [showEndpoints, setShowEndpoints] = useState(false);
  const [dirty, setDirty] = useState(false);
  const runningRef = useRef(false);

  const { data: flow } = useQuery({
    queryKey: ["workflow", id],
    queryFn: () => load({ data: { id } }),
    retry: false,
  });

  const { data: runs = [] } = useQuery({
    queryKey: ["executions", id],
    queryFn: () => history({ data: { workflowId: id, limit: 25 } }).catch(() => []),
    retry: false,
    refetchInterval: running ? 750 : 8000,
  });

  const liveExecutionId = running ? runs.find((item) => item.status === "running")?.id : undefined;
  const { data: liveResult } = useQuery({
    queryKey: ["execution", liveExecutionId],
    queryFn: () => execution({ data: { id: liveExecutionId ?? "" } }),
    enabled: Boolean(liveExecutionId),
    refetchInterval: running ? 750 : false,
  });

  useEffect(() => {
    if (liveResult?.status === "running") applyResult(liveResult);
  }, [liveResult]);

  const { data: versionList = [] } = useQuery({
    queryKey: ["versions", id],
    queryFn: () => versions({ data: { id } }),
    enabled: showHistory,
  });

  useEffect(() => {
    if (flow === undefined) return;
    if (flow === null) {
      void navigate({ to: "/workflows" });
      return;
    }
    setName(flow.name);
    setActive(flow.active);
    setNodes(
      (flow.nodes as StoredNode[]).map((n) => ({ ...n, type: "flow", data: { ...n.data } })) as Node[],
    );
    setEdges((flow.edges as StoredEdge[]).map((e) => ({ ...e, animated: true })) as Edge[]);
    setDirty(false);
  }, [flow, navigate, setNodes, setEdges]);

  const persist = useCallback(
    async (patch?: { name?: string; active?: boolean }) => {
      const payload = {
        id,
        name: patch?.name ?? name,
        active: patch?.active ?? active,
        nodes: nodes.map(toStored),
        edges: edges.map((e) => ({
          id: e.id,
          source: e.source,
          target: e.target,
          sourceHandle: e.sourceHandle ?? "main",
        })),
      };
      await save({ data: payload as never });
      setDirty(false);
      void qc.invalidateQueries({ queryKey: ["workflows"] });
    },
    [id, name, active, nodes, edges, save, qc],
  );

  const onConnect = useCallback(
    (c: Connection) => {
      setDirty(true);
      setEdges((eds) => addEdge({ ...c, animated: true, id: uid() }, eds));
    },
    [setEdges],
  );

  const addNode = (kind: FlowNodeKind) => {
    const spec = specOf(kind);
    const nid = uid();
    setNodes((nds) => [
      ...nds,
      {
        id: nid,
        type: "flow",
        position: { x: 260 + Math.random() * 340, y: 120 + Math.random() * 260 },
        data: { kind, label: spec.name, params: { ...spec.defaults } },
      } as Node,
    ]);
    setSelectedId(nid);
    setDirty(true);
  };

  const selectedNode = useMemo(() => {
    const n = nodes.find((x) => x.id === selectedId);
    return n ? toStored(n) : null;
  }, [nodes, selectedId]);

  const patchSelected = (patch: Partial<StoredNode["data"]>) => {
    setDirty(true);
    setNodes((nds) =>
      nds.map((n) => (n.id === selectedId ? { ...n, data: { ...n.data, ...patch } } : n)),
    );
  };

  const deleteSelected = () => {
    setNodes((nds) => nds.filter((n) => n.id !== selectedId));
    setEdges((eds) => eds.filter((e) => e.source !== selectedId && e.target !== selectedId));
    setSelectedId(null);
    setDirty(true);
  };

  const applyResult = (res: RunResult) => {
    setResult(res);
    setNodes((nds) =>
      nds.map((n) => {
        const step = res.steps.find((s) => s.nodeId === n.id);
        return {
          ...n,
          data: {
            ...n.data,
            status: (step?.status ?? "idle") as NodeStatus,
            itemCount: step?.items.length,
          },
        };
      }),
    );
  };

  const execute = useCallback(async () => {
    if (runningRef.current) return;
    runningRef.current = true;
    setRunning(true);
    setPanelOpen(true);
    setNodes((nds) => nds.map((n) => ({ ...n, data: { ...n.data, status: "running" } })));
    try {
      await persist();
      const res = await run({ data: { workflowId: id } });
      applyResult(res);
      const failed = res.steps.find((s) => s.status === "error");
      if (failed) toast.error(`${failed.label}: ${failed.error}`);
      else toast.success(`Workflow finished in ${res.ms}ms`);
      void qc.invalidateQueries({ queryKey: ["executions"] });
    } catch (e) {
      toast.error((e as Error).message);
      setNodes((nds) => nds.map((n) => ({ ...n, data: { ...n.data, status: "idle" } })));
    } finally {
      runningRef.current = false;
      setRunning(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id, persist, run, setNodes, qc]);

  const groupedNodes = useMemo(() => {
    const specs = searchCatalog(query, group);
    const map = new Map<string, typeof specs>();
    specs.forEach((s) => map.set(s.group, [...(map.get(s.group) ?? []), s]));
    return [...map.entries()];
  }, [query, group]);

  const webhookNodes = nodes.filter((n) => (n.data as unknown as NodeData).kind === "webhookTrigger");

  return (
    <Shell>
      <header className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3 border-b border-border px-6 py-3">
        <div className="flex min-w-0 items-center gap-2 text-sm">
          <Link
            to="/workflows"
            className="flex items-center gap-1.5 text-muted-foreground hover:text-foreground"
          >
            <User className="size-3.5" /> Personal
          </Link>
          <ChevronRight className="size-3.5 shrink-0 text-muted-foreground" />
          <Input
            value={name}
            onChange={(e) => {
              setName(e.target.value);
              setDirty(true);
            }}
            className="h-8 w-64 border-transparent bg-transparent px-1 font-display text-sm font-semibold shadow-none hover:border-input focus-visible:border-input"
            aria-label="Workflow name"
          />
          {dirty && <span className="text-[11px] text-muted-foreground">unsaved changes</span>}
        </div>

        <div className="flex items-center gap-2">
          <Hint
            text={
              active
                ? "The workflow is live: webhooks, schedules and production URLs run it on the server. Click to pause it."
                : "The workflow is paused. Click to activate it so its webhooks, schedules and production URLs start running."
            }
          >
          <button
            onClick={async () => {
              const next = !active;
              setActive(next);
              await persist({ active: next });
              await activate({ data: { id, active: next } });
              toast.success(
                next
                  ? "Workflow activated — webhooks and schedules now run on the server"
                  : "Workflow deactivated",
              );
            }}
            className={`flex items-center gap-2 rounded-full border px-3 py-1.5 text-xs font-medium transition-colors ${
              active
                ? "border-primary/40 bg-primary/10 text-primary"
                : "border-border bg-secondary text-muted-foreground"
            }`}
          >
            <span
              className={`size-1.5 rounded-full ${active ? "bg-primary" : "bg-muted-foreground"}`}
            />
            {active ? "Active" : "Inactive"}
          </button>
          </Hint>
          <Hint text="Every save creates a snapshot. Open this to compare and restore an earlier version of the graph.">
            <Button variant="outline" size="sm" onClick={() => setShowHistory((s) => !s)}>
              <History className="mr-1.5 size-4" /> History
            </Button>
          </Hint>
          <Hint text="Shows the test and production URLs that run this whole workflow from anywhere, plus the execution link of each run.">
            <Button
              variant={showEndpoints ? "secondary" : "outline"}
              size="sm"
              onClick={() => setShowEndpoints((s) => !s)}
            >
              <Link2 className="mr-1.5 size-4" /> URLs
            </Button>
          </Hint>
          <CredentialsDialog />
          <Hint text="Stores the graph on the server and creates a new version snapshot.">
            <Button
              variant="outline"
              size="sm"
              onClick={async () => {
                await persist();
                toast.success("Workflow saved");
              }}
            >
              <Save className="mr-1.5 size-4" /> Save
            </Button>
          </Hint>
          <Hint text="Saves, then executes every node on the server. Outputs, logs, retries and timings appear in the panel below.">
            <Button size="sm" onClick={() => void execute()} disabled={running}>
              <Play className="mr-1.5 size-4" /> {running ? "Running…" : "Run"}
            </Button>
          </Hint>
        </div>
      </header>

      <div className="flex min-h-0 flex-1">
        <aside className="flex w-[240px] shrink-0 flex-col border-r border-border bg-card">
          <div className="space-y-2 border-b border-border p-3">
            <div className="relative">
              <Search className="pointer-events-none absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search nodes"
                className="h-8 pl-8 text-xs"
                aria-label="Search nodes"
              />
            </div>
            <select
              value={group}
              onChange={(e) => setGroup(e.target.value)}
              className="h-8 w-full rounded-md border border-input bg-background px-2 text-xs"
              aria-label="Filter by category"
            >
              <option value="All">All categories</option>
              {NODE_GROUPS.map((g) => (
                <option key={g} value={g}>
                  {g}
                </option>
              ))}
            </select>
          </div>
          <div className="min-h-0 flex-1 overflow-y-auto p-2">
            {groupedNodes.map(([groupName, specs]) => (
              <div key={groupName} className="mb-3">
                <p className="px-1 pb-1.5 text-[10px] font-semibold uppercase tracking-[0.15em] text-muted-foreground">
                  {groupName}
                </p>
                {specs.map((s) => (
                  <Hint key={s.kind} side="right" title={s.name} text={s.description}>
                  <button
                    onClick={() => addNode(s.kind)}
                    className="group mb-1 flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-sm transition-colors hover:bg-secondary"
                  >
                    <NodeIcon icon={s.icon} className="size-3.5 shrink-0" />
                    <span className="truncate">{s.name}</span>
                  </button>
                  </Hint>
                ))}
              </div>
            ))}
            {groupedNodes.length === 0 && (
              <p className="p-3 text-xs text-muted-foreground">No nodes match “{query}”.</p>
            )}
          </div>
        </aside>

        <div className="relative flex min-w-0 flex-1 flex-col">
          <div className="min-h-0 flex-1">
            <ReactFlow
              nodes={nodes}
              edges={edges}
              onNodesChange={(c) => {
                setDirty(true);
                onNodesChange(c);
              }}
              onEdgesChange={(c) => {
                setDirty(true);
                onEdgesChange(c);
              }}
              onConnect={onConnect}
              nodeTypes={nodeTypes}
              onNodeClick={(_, n) => setSelectedId(n.id)}
              onPaneClick={() => setSelectedId(null)}
              fitView
              proOptions={{ hideAttribution: true }}
              className="ff-grid"
            >
              <Background variant={BackgroundVariant.Dots} gap={22} size={1} color="transparent" />
              <Controls className="!border-border !bg-card" />
              <MiniMap pannable className="!border-border !bg-card" maskColor="rgba(0,0,0,0.06)" />
            </ReactFlow>
          </div>

          {/* Bottom dock: URLs, request console, logs and versions all live here so
              the canvas keeps the whole screen. */}
          <div className="flex shrink-0 flex-col border-t border-border bg-card">
            <div className="flex items-center gap-1 px-2 py-1.5">
              {([
                ["run", "Logs & data"],
                ["urls", "URLs"],
                ...(webhookNodes.length > 0 ? ([["request", "Request"]] as const) : []),
                ["versions", "Versions"],
              ] as const).map(([key, label]) => (
                <button
                  key={key}
                  onClick={() => setDockTab((t) => (t === key && dockOpen ? (setDockOpen(false), t) : (setDockOpen(true), key)))}
                  className={`rounded-md px-2.5 py-1 text-[11px] font-medium transition-colors ${
                    dockOpen && dockTab === key
                      ? "bg-secondary text-foreground"
                      : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  {label}
                </button>
              ))}
              <span className="ml-auto text-[11px] text-muted-foreground">
                {result ? `${result.ok ? "success" : "error"} · ${result.steps.length} nodes · ${result.ms}ms` : "no runs yet"}
              </span>
              <Hint text={dockOpen ? "Hide the bottom panel and give the canvas the full screen." : "Show URLs, request console and execution logs."}>
                <Button variant="ghost" size="sm" className="h-7 px-2" onClick={() => setDockOpen((o) => !o)}>
                  {dockOpen ? <ChevronDown className="size-4" /> : <ChevronUp className="size-4" />}
                </Button>
              </Hint>
            </div>

            {dockOpen && (
              <div className="h-[300px] min-h-0 overflow-hidden border-t border-border">
                {dockTab === "run" && (
                  <div className="h-full overflow-y-auto">
                    <RunPanel
                      run={result}
                      open
                      onToggle={() => setDockOpen(false)}
                      runs={runs}
                      onSelectRun={async (execId: string) => {
                        const res = await execution({ data: { id: execId } });
                        if (res) applyResult(res);
                      }}
                    />
                  </div>
                )}
                {dockTab === "urls" && (
                  <div className="h-full overflow-y-auto p-4">
                    <EndpointPanel workflowId={id} title="Workflow URLs" />
                  </div>
                )}
                {dockTab === "request" && webhookNodes.length > 0 && (
                  <div className="h-full overflow-y-auto">
                    <WebhookConsole
                      workflowId={id}
                      triggers={webhookNodes.map(toStored)}
                      active={active}
                      onResult={applyResult}
                    />
                  </div>
                )}
                {dockTab === "versions" && (
                  <div className="h-full overflow-y-auto">
                    {versionList.map((v) => (
                      <div key={v.id} className="flex items-center gap-3 border-b border-border px-4 py-2.5 text-xs">
                        <div className="min-w-0 flex-1">
                          <p className="font-medium">
                            v{v.version} · {v.name}
                          </p>
                          <p className="text-muted-foreground">{new Date(v.createdAt).toLocaleString()}</p>
                        </div>
                        <Button
                          variant="outline"
                          size="sm"
                          className="h-7 text-[11px]"
                          onClick={async () => {
                            await restore({ data: { versionId: v.id } });
                            await qc.invalidateQueries({ queryKey: ["workflow", id] });
                            void qc.invalidateQueries({ queryKey: ["versions", id] });
                            toast.success(`Restored v${v.version}`);
                          }}
                        >
                          Restore
                        </Button>
                      </div>
                    ))}
                    {versionList.length === 0 && (
                      <p className="p-4 text-xs text-muted-foreground">
                        Snapshots appear here every time you save.
                      </p>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>


        {selectedNode && (
          <Inspector
            node={selectedNode}
            workflowId={id}
            onChange={patchSelected}
            onDelete={deleteSelected}
            onClose={() => setSelectedId(null)}
            testing={testingNode}
            onTestNode={async () => {
              setTestingNode(true);
              setPanelOpen(true);
              try {
                await persist();
                const res = await runNode({ data: { workflowId: id, nodeId: selectedNode.id } });
                applyResult(res);
                const step = res.steps[0];
                if (step?.status === "error") toast.error(`${step.label}: ${step.error}`);
                else toast.success(`${step?.label ?? "Node"} returned ${step?.items.length ?? 0} item(s) in ${res.ms}ms`);
              } catch (e) {
                toast.error((e as Error).message);
              } finally {
                setTestingNode(false);
              }
            }}
          />
        )}
      </div>
    </Shell>
  );
}
