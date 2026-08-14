import { useEffect, useRef, useState, type ReactNode } from "react";
import { useServerFn } from "@tanstack/react-start";
import { CheckCircle2, Loader2, Sparkles, Wand2, Workflow as WorkflowIcon } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { generateWorkflowWithAI } from "@/lib/api/ai.functions";
import { NodeIcon } from "@/components/flow/NodeIcon";
import { specOf } from "@/lib/flow/catalog";

const EXAMPLES = [
  "Poll an RSS feed every hour and post new items to a Slack channel",
  "On a webhook, look up the payload in an API and email me if it fails",
  "A chat assistant that answers questions using an AI Agent with memory",
  "Every morning, fetch GitHub issues and summarize them with AI",
];

const STEPS = ["Reading your request", "Choosing nodes", "Wiring the graph", "Saving workflow"];

type Result = Awaited<ReturnType<typeof generateWorkflowWithAI>>;

export function CreateWithAIDialog({
  trigger,
  onCreated,
}: {
  trigger: ReactNode;
  onCreated: (id: string) => void;
}) {
  const generate = useServerFn(generateWorkflowWithAI);
  const [open, setOpen] = useState(false);
  const [prompt, setPrompt] = useState("");
  const [pending, setPending] = useState(false);
  const [step, setStep] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<Result | null>(null);
  const timer = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => () => {
    if (timer.current) clearInterval(timer.current);
  }, []);

  const reset = () => {
    setPrompt("");
    setPending(false);
    setStep(0);
    setError(null);
    setResult(null);
  };

  const run = async () => {
    if (!prompt.trim() || pending) return;
    setPending(true);
    setError(null);
    setResult(null);
    setStep(0);
    timer.current = setInterval(() => {
      setStep((s) => Math.min(s + 1, STEPS.length - 1));
    }, 900);
    try {
      const res = await generate({ data: { prompt: prompt.trim() } });
      setStep(STEPS.length - 1);
      setResult(res);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't generate a workflow — try again.");
    } finally {
      if (timer.current) clearInterval(timer.current);
      setPending(false);
    }
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(v) => {
        setOpen(v);
        if (!v) reset();
      }}
    >
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 font-display">
            <span className="flex size-8 items-center justify-center rounded-lg bg-gradient-to-br from-primary to-accent text-primary-foreground">
              <Wand2 className="size-4" />
            </span>
            Create with AI
          </DialogTitle>
          <p className="text-sm text-muted-foreground">
            Describe the automation you want. It's generated and saved as a real workflow you can
            edit and run.
          </p>
        </DialogHeader>

        {!result && (
          <div className="space-y-3">
            <Textarea
              autoFocus
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              placeholder="e.g. Every day at 9am, fetch the weather for Beirut and if it's above 35°C, send me a Slack message"
              className="min-h-24 resize-none text-sm"
              disabled={pending}
            />
            {!pending && (
              <div className="flex flex-wrap gap-1.5">
                {EXAMPLES.map((ex) => (
                  <button
                    key={ex}
                    onClick={() => setPrompt(ex)}
                    className="rounded-full border border-border bg-secondary/60 px-2.5 py-1 text-[11px] text-muted-foreground transition-colors hover:border-primary/40 hover:text-foreground"
                  >
                    {ex.length > 46 ? ex.slice(0, 46) + "…" : ex}
                  </button>
                ))}
              </div>
            )}

            {pending && (
              <div className="space-y-2 rounded-xl border border-border bg-secondary/40 p-4">
                {STEPS.map((s, i) => (
                  <div
                    key={s}
                    className={`flex items-center gap-2.5 text-sm transition-opacity ${
                      i <= step ? "opacity-100" : "opacity-40"
                    }`}
                  >
                    {i < step ? (
                      <CheckCircle2 className="size-4 shrink-0 text-primary" />
                    ) : i === step ? (
                      <Loader2 className="size-4 shrink-0 animate-spin text-primary" />
                    ) : (
                      <span className="size-4 shrink-0 rounded-full border border-border" />
                    )}
                    {s}
                  </div>
                ))}
              </div>
            )}

            {error && (
              <p className="rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2 text-xs text-destructive">
                {error}
              </p>
            )}
          </div>
        )}

        {result && (
          <div className="space-y-3">
            <div className="flex items-start gap-2.5 rounded-xl border border-primary/30 bg-primary/5 p-3.5">
              <Sparkles className="mt-0.5 size-4 shrink-0 text-primary" />
              <div className="min-w-0 text-sm">
                <p className="font-display font-semibold">{result.name}</p>
                <p className="mt-0.5 text-muted-foreground">{result.summary}</p>
              </div>
            </div>
            <div className="flex flex-wrap gap-1.5">
              {result.nodes.map((n, i) => {
                const spec = specOf(n.kind);
                return (
                  <span
                    key={i}
                    className="flex items-center gap-1.5 rounded-full border border-border bg-card px-2.5 py-1 text-[11px]"
                  >
                    <NodeIcon icon={spec.icon} className="size-3 text-primary" />
                    {n.label}
                  </span>
                );
              })}
            </div>
            <p className="text-xs text-muted-foreground">
              {result.nodeCount} nodes · {result.edgeCount} connections · saved to your workspace
            </p>
          </div>
        )}

        <DialogFooter>
          {!result ? (
            <Button className="w-full" onClick={() => void run()} disabled={pending || !prompt.trim()}>
              {pending ? (
                <>
                  <Loader2 className="mr-1.5 size-4 animate-spin" /> Generating…
                </>
              ) : (
                <>
                  <Wand2 className="mr-1.5 size-4" /> Generate workflow
                </>
              )}
            </Button>
          ) : (
            <Button
              className="w-full"
              onClick={() => {
                const id = result.id;
                setOpen(false);
                reset();
                onCreated(id);
              }}
            >
              <WorkflowIcon className="mr-1.5 size-4" /> Open workflow
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
