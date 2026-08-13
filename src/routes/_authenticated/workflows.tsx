import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useMemo, useState } from "react";
import { Copy, Plus, Search, Trash2, Workflow as WorkflowIcon } from "lucide-react";
import { toast } from "sonner";

import { PageHeader, Shell } from "@/components/Shell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  deleteWorkflow,
  listWorkflows,
  saveWorkflow,
  setWorkflowActive,
} from "@/lib/api/workflows.functions";
import { blankWorkflow } from "@/lib/flow/templates";

export const Route = createFileRoute("/_authenticated/workflows")({
  head: () => ({
    meta: [
      { title: "My workflows — n9n" },
      {
        name: "description",
        content:
          "Every automation you own, stored on the server. Create unlimited workflows and keep as many active as you like.",
      },
      { property: "og:title", content: "My workflows — n9n" },
      {
        property: "og:description",
        content: "Unlimited automation workflows with a real server-side execution engine.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: WorkflowsPage,
});

const ago = (iso: string) => {
  const mins = Math.round((Date.now() - new Date(iso).getTime()) / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins} min ago`;
  const h = Math.round(mins / 60);
  if (h < 24) return `${h} h ago`;
  return `${Math.round(h / 24)} d ago`;
};

function WorkflowsPage() {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const list = useServerFn(listWorkflows);
  const save = useServerFn(saveWorkflow);
  const remove = useServerFn(deleteWorkflow);
  const activate = useServerFn(setWorkflowActive);

  const [query, setQuery] = useState("");
  const [sort, setSort] = useState<"updated" | "name">("updated");

  const { data: flows = [], isLoading } = useQuery({
    queryKey: ["workflows"],
    queryFn: () => list(),
  });
  const invalidate = () => void qc.invalidateQueries({ queryKey: ["workflows"] });

  const shown = useMemo(() => {
    const f = flows.filter((w) => w.name.toLowerCase().includes(query.toLowerCase()));
    return sort === "name"
      ? [...f].sort((a, b) => a.name.localeCompare(b.name))
      : [...f].sort((a, b) => +new Date(b.updatedAt) - +new Date(a.updatedAt));
  }, [flows, query, sort]);

  const create = async () => {
    const draft = blankWorkflow();
    const { id } = await save({ data: { ...draft, active: false } });
    void navigate({ to: "/workflow/$id", params: { id } });
  };

  return (
    <Shell>
      <PageHeader
        title="Personal"
        subtitle="All the workflows you own — stored server-side and running even when this tab is closed."
        action={
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" asChild>
              <Link to="/templates">Browse templates</Link>
            </Button>
            <Button size="sm" onClick={() => void create()}>
              <Plus className="mr-1.5 size-4" /> Create workflow
            </Button>
          </div>
        }
      />

      <div className="min-h-0 flex-1 overflow-y-auto px-8 py-6">
        <div className="mb-4 grid grid-cols-[minmax(0,1fr)_auto] gap-3">
          <div className="relative min-w-0">
            <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search workflows"
              className="pl-9"
              aria-label="Search workflows"
            />
          </div>
          <select
            value={sort}
            onChange={(e) => setSort(e.target.value as "updated" | "name")}
            className="h-9 rounded-md border border-input bg-background px-3 text-sm"
            aria-label="Sort workflows"
          >
            <option value="updated">Sort by last updated</option>
            <option value="name">Sort by name</option>
          </select>
        </div>

        <div className="space-y-2">
          {shown.map((w) => (
            <div
              key={w.id}
              className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-4 rounded-xl border border-border bg-card p-4 transition-shadow hover:shadow-[var(--shadow-panel)]"
            >
              <Link to="/workflow/$id" params={{ id: w.id }} className="min-w-0">
                <p className="flex min-w-0 items-center gap-2 font-display font-semibold">
                  <WorkflowIcon className="size-4 shrink-0 text-primary" />
                  <span className="truncate">{w.name}</span>
                </p>
                <p className="mt-1 truncate text-xs text-muted-foreground">
                  Updated {ago(w.updatedAt)} · v{w.version} · {w.nodes.length} nodes ·{" "}
                  {w.edges.length} connections
                  {w.lastRunAt ? ` · last run ${ago(w.lastRunAt)}` : ""}
                </p>
              </Link>
              <div className="flex items-center gap-1.5">
                <button
                  onClick={async () => {
                    await activate({ data: { id: w.id, active: !w.active } });
                    invalidate();
                  }}
                  className={`rounded-full border px-2.5 py-1 text-[11px] font-medium ${
                    w.active
                      ? "border-primary/40 bg-primary/10 text-primary"
                      : "border-border bg-secondary text-muted-foreground"
                  }`}
                >
                  {w.active ? "Active" : "Inactive"}
                </button>
                <Button
                  variant="ghost"
                  size="icon"
                  aria-label="Duplicate"
                  onClick={async () => {
                    await save({
                      data: {
                        name: `${w.name} copy`,
                        active: false,
                        nodes: w.nodes as never,
                        edges: w.edges as never,
                      },
                    });
                    toast.success("Workflow duplicated");
                    invalidate();
                  }}
                >
                  <Copy className="size-4" />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  aria-label={`Delete ${w.name}`}
                  onClick={async () => {
                    await remove({ data: { id: w.id } });
                    invalidate();
                  }}
                >
                  <Trash2 className="size-4 text-destructive" />
                </Button>
              </div>
            </div>
          ))}

          {!isLoading && shown.length === 0 && (
            <div className="rounded-xl border border-dashed border-border p-12 text-center">
              <p className="font-display font-semibold">No workflows yet</p>
              <p className="mt-1 text-sm text-muted-foreground">
                Start from scratch or pick one of the ready-made templates.
              </p>
              <div className="mt-4 flex justify-center gap-2">
                <Button size="sm" onClick={() => void create()}>
                  <Plus className="mr-1.5 size-4" /> Create workflow
                </Button>
                <Button variant="outline" size="sm" asChild>
                  <Link to="/templates">Browse templates</Link>
                </Button>
              </div>
            </div>
          )}
        </div>
      </div>
    </Shell>
  );
}
