import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useMemo } from "react";
import {
  ArrowRight,
  Infinity as InfinityIcon,
  Plus,
  Sparkles,
  Workflow as WorkflowIcon,
} from "lucide-react";

import { PageHeader, Shell } from "@/components/Shell";
import { Button } from "@/components/ui/button";
import { CreateWithAIDialog } from "@/components/CreateWithAIDialog";
import { listExecutions } from "@/lib/api/executions.functions";
import { listWorkflows, saveWorkflow } from "@/lib/api/workflows.functions";
import { TEMPLATES, blankWorkflow, workflowFromTemplate } from "@/lib/flow/templates";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "n9n — Unlimited Workflow Automation, Free Forever" },
      {
        name: "description",
        content:
          "n9n is a self-contained automation studio: unlimited workflows, server-side executions, real webhook and schedule triggers, encrypted credentials and full run history.",
      },
      { property: "og:title", content: "n9n — Unlimited Workflow Automation, Free Forever" },
      {
        property: "og:description",
        content:
          "Visual automation with HTTP, code, branching, scheduling and integrations — executed on the server, unlimited.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Overview,
});

function Overview() {
  const navigate = useNavigate();
  const list = useServerFn(listWorkflows);
  const runs = useServerFn(listExecutions);
  const save = useServerFn(saveWorkflow);

  const { data: flows = [] } = useQuery({ queryKey: ["workflows"], queryFn: () => list() });
  const { data: executions = [] } = useQuery({
    queryKey: ["executions"],
    queryFn: () => runs({ data: { limit: 200 } }),
    refetchInterval: 10000,
  });

  const stats = useMemo(() => {
    const failed = executions.filter((r) => r.status === "error").length;
    const avg = executions.length
      ? Math.round(executions.reduce((a, r) => a + r.ms, 0) / executions.length)
      : 0;
    return [
      { label: "Total executions", value: String(executions.length) },
      { label: "Failed executions", value: String(failed) },
      {
        label: "Failure rate",
        value: executions.length ? `${Math.round((failed / executions.length) * 100)}%` : "0%",
      },
      { label: "Active workflows", value: String(flows.filter((f) => f.active).length) },
      { label: "Run time (avg.)", value: `${avg}ms` },
    ];
  }, [executions, flows]);

  const create = async () => {
    const { id } = await save({ data: { ...blankWorkflow(), active: false } });
    void navigate({ to: "/workflow/$id", params: { id } });
  };

  const fromTemplate = async (slug: string) => {
    const t = TEMPLATES.find((x) => x.slug === slug);
    if (!t) return;
    const { id } = await save({ data: { ...workflowFromTemplate(t), active: false } });
    void navigate({ to: "/workflow/$id", params: { id } });
  };

  return (
    <Shell>
      <PageHeader
        title="Overview"
        subtitle="All the workflows, credentials and executions in your workspace."
        action={
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" asChild>
              <Link to="/templates">Templates</Link>
            </Button>
            <Button size="sm" onClick={() => void create()}>
              <Plus className="mr-1.5 size-4" /> Create workflow
            </Button>
            <CreateWithAIDialog
              trigger={
                <Button
                  size="sm"
                  className="bg-gradient-to-br from-primary to-accent text-primary-foreground hover:opacity-90"
                >
                  <Sparkles className="mr-1.5 size-4" /> Create with AI
                </Button>
              }
              onCreated={(id) => void navigate({ to: "/workflow/$id", params: { id } })}
            />
          </div>
        }
      />

      <div className="min-h-0 flex-1 overflow-y-auto px-8 py-6">
        <div className="mb-6 rounded-xl border border-border bg-gradient-to-br from-primary/5 to-accent/5 p-4">
          <p className="flex flex-wrap items-center gap-2 text-sm">
            <InfinityIcon className="size-4 text-primary" />
            <span className="font-display font-semibold">Everything unlimited.</span>
            <span className="text-muted-foreground">
              Runs execute on the server with persistent history — triggers keep firing after you
              close this tab.
            </span>
          </p>
        </div>

        <div className="grid grid-cols-2 divide-border overflow-hidden rounded-xl border border-border bg-card sm:grid-cols-3 lg:grid-cols-5 lg:divide-x">
          {stats.map((s) => (
            <div key={s.label} className="border-b border-border p-5 lg:border-b-0">
              <p className="text-xs text-muted-foreground">{s.label}</p>
              <p className="mt-2 font-display text-3xl font-bold tracking-tight">{s.value}</p>
            </div>
          ))}
        </div>

        <section className="mt-8">
          <div className="mb-3 flex items-end justify-between gap-4">
            <h2 className="font-display text-lg font-semibold">Recent workflows</h2>
            <Link to="/workflows" className="text-sm text-primary hover:underline">
              View all
            </Link>
          </div>
          <div className="space-y-2">
            {flows.slice(0, 5).map((w) => (
              <Link
                key={w.id}
                to="/workflow/$id"
                params={{ id: w.id }}
                className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-4 rounded-xl border border-border bg-card p-4 transition-shadow hover:shadow-[var(--shadow-panel)]"
              >
                <span className="min-w-0">
                  <span className="flex min-w-0 items-center gap-2 font-display font-semibold">
                    <WorkflowIcon className="size-4 shrink-0 text-primary" />
                    <span className="truncate">{w.name}</span>
                  </span>
                  <span className="mt-1 block truncate text-xs text-muted-foreground">
                    {w.nodes.length} nodes · {w.edges.length} connections
                  </span>
                </span>
                <span
                  className={`rounded-full border px-2.5 py-1 text-[11px] font-medium ${
                    w.active
                      ? "border-primary/40 bg-primary/10 text-primary"
                      : "border-border bg-secondary text-muted-foreground"
                  }`}
                >
                  {w.active ? "Active" : "Inactive"}
                </span>
              </Link>
            ))}
            {flows.length === 0 && (
              <p className="rounded-xl border border-dashed border-border p-8 text-center text-sm text-muted-foreground">
                No workflows yet — create one or start from a template below.
              </p>
            )}
          </div>
        </section>

        <section className="mt-8">
          <div className="mb-3 flex items-end justify-between gap-4">
            <h2 className="font-display text-lg font-semibold">Start from a template</h2>
            <Link to="/templates" className="text-sm text-primary hover:underline">
              All {TEMPLATES.length} templates
            </Link>
          </div>
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {TEMPLATES.slice(0, 6).map((t) => (
              <button
                key={t.slug}
                onClick={() => void fromTemplate(t.slug)}
                className="group rounded-xl border border-border bg-card p-4 text-left transition-shadow hover:shadow-[var(--shadow-panel)]"
              >
                <p className="flex items-center gap-2 font-display font-semibold">
                  <Sparkles className="size-4 shrink-0 text-primary" />
                  <span className="truncate">{t.name}</span>
                </p>
                <p className="mt-1.5 line-clamp-2 text-sm text-muted-foreground">{t.description}</p>
                <span className="mt-3 flex items-center gap-1 text-xs font-medium text-primary">
                  Use template{" "}
                  <ArrowRight className="size-3.5 transition-transform group-hover:translate-x-0.5" />
                </span>
              </button>
            ))}
          </div>
        </section>
      </div>
    </Shell>
  );
}
