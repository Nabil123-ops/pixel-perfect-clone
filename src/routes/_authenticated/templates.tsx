import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useMemo, useState } from "react";
import { ArrowRight, Sparkles } from "lucide-react";

import { PageHeader, Shell } from "@/components/Shell";
import { Button } from "@/components/ui/button";
import { specOf } from "@/lib/flow/catalog";
import { saveWorkflow } from "@/lib/api/workflows.functions";
import { TEMPLATES, workflowFromTemplate, type Template } from "@/lib/flow/templates";

export const Route = createFileRoute("/_authenticated/templates")({
  head: () => ({
    meta: [
      { title: "Workflow templates — n9n" },
      {
        name: "description",
        content:
          "Ready-to-run automation templates: weather alerts, crypto tracking, uptime monitoring, webhook intake and more.",
      },
      { property: "og:title", content: "Workflow templates — n9n" },
      {
        property: "og:description",
        content: "One click turns any template into a live workflow you can run instantly.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: TemplatesPage,
});

const CATEGORIES = ["All", "AI", "Monitoring", "Data & APIs", "Notifications", "Utilities"] as const;

function TemplatesPage() {
  const navigate = useNavigate();
  const [cat, setCat] = useState<(typeof CATEGORIES)[number]>("All");

  const shown = useMemo(() => (cat === "All" ? TEMPLATES : TEMPLATES.filter((t) => t.category === cat)), [cat]);

  const save = useServerFn(saveWorkflow);

  const use = async (t: Template) => {
    const draft = workflowFromTemplate(t);
    const { id } = await save({ data: { ...draft, active: false } });
    void navigate({ to: "/workflow/$id", params: { id } });
  };

  return (
    <Shell>
      <PageHeader
        title="Templates"
        subtitle={`${TEMPLATES.length} production-ready automations — use as many as you want, free.`}
      />

      <div className="min-h-0 flex-1 overflow-y-auto px-8 py-6">
        <div className="mb-6 flex flex-wrap gap-2">
          {CATEGORIES.map((c) => (
            <button
              key={c}
              onClick={() => setCat(c)}
              className={`rounded-full border px-3.5 py-1.5 text-xs font-medium transition-colors ${
                cat === c
                  ? "border-primary bg-primary text-primary-foreground"
                  : "border-border bg-card text-muted-foreground hover:text-foreground"
              }`}
            >
              {c}
            </button>
          ))}
        </div>

        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {shown.map((t) => (
            <article
              key={t.slug}
              className="flex flex-col rounded-xl border border-border bg-card p-5 transition-shadow hover:shadow-[var(--shadow-panel)]"
            >
              <div className="flex items-center gap-2">
                <span className="grid size-8 shrink-0 place-items-center rounded-lg bg-gradient-to-br from-primary/15 to-accent/15 text-primary">
                  <Sparkles className="size-4" />
                </span>
                <span className="rounded-full bg-secondary px-2 py-0.5 text-[10px] uppercase tracking-wider text-muted-foreground">
                  {t.category}
                </span>
              </div>
              <h2 className="mt-3 font-display text-base font-semibold">{t.name}</h2>
              <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">{t.description}</p>

              <div className="mt-4 flex flex-wrap gap-1.5">
                {t.steps.map((s, i) => (
                  <span
                    key={i}
                    className="rounded-md border border-border bg-secondary/60 px-2 py-0.5 font-mono text-[10px] text-muted-foreground"
                  >
                    {specOf(s.kind).name}
                  </span>
                ))}
              </div>

              <Button size="sm" className="mt-5 w-full" onClick={() => void use(t)}>
                Use this template <ArrowRight className="ml-1.5 size-4" />
              </Button>
            </article>
          ))}
        </div>
      </div>
    </Shell>
  );
}
