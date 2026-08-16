import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useRef, useState } from "react";
import {
  Bot,
  Code2,
  Download,
  Eye,
  ExternalLink,
  Loader2,
  Send,
  Sparkles,
  User,
  FilePlus2,
} from "lucide-react";
import { toast } from "sonner";

import { Shell } from "@/components/Shell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  DEFAULT_PUTER_MODEL,
  PUTER_MODELS,
  extractJson,
  puterChat,
  type PuterMessage,
} from "@/lib/puter";
import { systemPromptFor, suggestionsFor } from "@/lib/builder/prompt";
import { buildPreviewDoc } from "@/lib/builder/preview";
import { downloadFile, downloadProjectZip } from "@/lib/builder/download";
import { BUILDER_FRAMEWORKS, type BuilderChatMessage, type BuilderFile, type BuilderFramework, type BuilderPlan } from "@/lib/builder/types";

export const Route = createFileRoute("/_authenticated/builder")({
  head: () => ({
    meta: [
      { title: "AI website builder — n9n" },
      {
        name: "description",
        content:
          "Chat a website into existence — Next.js, React, or plain HTML/CSS/JS — with a live preview and a one-click download, powered by Puter.js in your browser.",
      },
      { property: "og:title", content: "AI website builder — n9n" },
      {
        property: "og:description",
        content: "Describe a site, watch it render live, and download the source.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: BuilderPage,
});

function BuilderPage() {
  const [framework, setFramework] = useState<BuilderFramework>("react");
  const [model, setModel] = useState<string>(DEFAULT_PUTER_MODEL);
  const [messages, setMessages] = useState<BuilderChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [pending, setPending] = useState(false);
  const [files, setFiles] = useState<BuilderFile[]>([]);
  const [projectName, setProjectName] = useState("My site");
  const [activeFile, setActiveFile] = useState<string | null>(null);
  const [view, setView] = useState<"preview" | "code">("preview");
  const scroller = useRef<HTMLDivElement>(null);

  const previewDoc = useMemo(() => buildPreviewDoc(framework, files), [framework, files]);
  const activeFileContent = files.find((f) => f.path === activeFile)?.content ?? "";

  const resetProject = (nextFramework?: BuilderFramework) => {
    setFiles([]);
    setActiveFile(null);
    setMessages([]);
    setView("preview");
    if (nextFramework) setFramework(nextFramework);
  };

  const send = async (text?: string) => {
    const content = (text ?? input).trim();
    if (!content || pending) return;
    setMessages((m) => [...m, { role: "user", content }]);
    setInput("");
    setPending(true);

    const context =
      files.length > 0
        ? `Current project files (edit them if the user asks for a change, keep unrelated files unchanged):\n${JSON.stringify(
            files,
          )}`
        : "No files exist yet — this is a brand-new project.";

    const history: PuterMessage[] = [
      { role: "system", content: systemPromptFor(framework) },
      { role: "user", content: `${context}\n\nRequest: ${content}` },
    ];

    try {
      const reply = await puterChat(history, model);
      const parsed = extractJson<BuilderPlan>(reply);
      if (!parsed.files?.length) throw new Error("The model returned no files");
      setFiles(parsed.files);
      setActiveFile(parsed.files[0]?.path ?? null);
      setView("preview");
      setMessages((m) => [
        ...m,
        {
          role: "assistant",
          content: `${parsed.explanation ?? "Here's your site."}\n\n${parsed.files
            .map((f) => `• ${f.path}`)
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

  const openPreviewInNewTab = () => {
    const blob = new Blob([previewDoc], { type: "text/html" });
    const url = URL.createObjectURL(blob);
    window.open(url, "_blank", "noopener,noreferrer");
    setTimeout(() => URL.revokeObjectURL(url), 30_000);
  };

  return (
    <Shell>
      <header className="flex items-center gap-3 border-b border-border px-6 py-3">
        <Sparkles className="size-4 shrink-0 text-primary" />
        <Input
          value={projectName}
          onChange={(e) => setProjectName(e.target.value)}
          className="h-8 w-56 border-transparent bg-transparent px-1 font-display text-sm font-semibold shadow-none hover:border-input focus-visible:border-input"
          aria-label="Project name"
        />
        <select
          value={framework}
          onChange={(e) => resetProject(e.target.value as BuilderFramework)}
          className="h-8 rounded-md border border-input bg-background px-2 text-xs"
          aria-label="Framework"
        >
          {BUILDER_FRAMEWORKS.map((f) => (
            <option key={f.id} value={f.id}>
              {f.label}
            </option>
          ))}
        </select>

        <div className="ml-auto flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={() => resetProject()}>
            <FilePlus2 className="mr-1.5 size-4" /> New project
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={openPreviewInNewTab}
            disabled={files.length === 0}
          >
            <ExternalLink className="mr-1.5 size-4" /> Open preview
          </Button>
          <Button
            size="sm"
            onClick={() => void downloadProjectZip(files, projectName)}
            disabled={files.length === 0}
          >
            <Download className="mr-1.5 size-4" /> Download .zip
          </Button>
        </div>
      </header>

      <div className="flex min-h-0 flex-1">
        {/* Chat panel */}
        <aside className="flex w-[320px] shrink-0 flex-col border-r border-border bg-card">
          <div className="flex items-center gap-2 border-b border-border px-3 py-2">
            <Bot className="size-3.5 text-primary" />
            <span className="font-display text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Chat to build
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
                  Describe the site you want and it renders live on the right — powered by Puter.js in
                  your browser, so no API key or extra setup is needed.
                </p>
                {suggestionsFor(framework).map((s) => (
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
                <Loader2 className="size-3.5 animate-spin" /> Building the site…
              </p>
            )}
          </div>

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
              placeholder="Describe a site, or ask for a change…"
              className="max-h-24 min-h-[38px] resize-none text-xs"
            />
            <Button size="sm" className="h-9" disabled={pending || !input.trim()} onClick={() => void send()}>
              <Send className="size-4" />
            </Button>
          </div>
        </aside>

        {/* Files + preview/code */}
        <div className="flex min-w-0 flex-1 flex-col">
          <div className="flex items-center gap-1 overflow-x-auto border-b border-border bg-card px-2 py-1.5">
            {files.map((f) => (
              <button
                key={f.path}
                onClick={() => {
                  setActiveFile(f.path);
                  setView("code");
                }}
                className={`shrink-0 rounded-md px-2.5 py-1 font-mono text-[11px] transition-colors ${
                  view === "code" && activeFile === f.path
                    ? "bg-secondary text-foreground"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                {f.path}
              </button>
            ))}
            <div className="ml-auto flex shrink-0 items-center gap-1 pl-2">
              <Button
                variant={view === "preview" ? "secondary" : "ghost"}
                size="sm"
                className="h-7 px-2 text-[11px]"
                onClick={() => setView("preview")}
              >
                <Eye className="mr-1 size-3.5" /> Preview
              </Button>
              <Button
                variant={view === "code" ? "secondary" : "ghost"}
                size="sm"
                className="h-7 px-2 text-[11px]"
                disabled={files.length === 0}
                onClick={() => {
                  if (!activeFile && files[0]) setActiveFile(files[0].path);
                  setView("code");
                }}
              >
                <Code2 className="mr-1 size-3.5" /> Code
              </Button>
            </div>
          </div>

          <div className="min-h-0 flex-1 bg-background">
            {view === "preview" ? (
              <iframe
                key={framework + files.length}
                title="Live preview"
                srcDoc={previewDoc}
                sandbox="allow-scripts allow-forms allow-modals allow-popups"
                className="h-full w-full border-0 bg-white"
              />
            ) : (
              <div className="flex h-full min-h-0 flex-col">
                {files.length === 0 ? (
                  <p className="p-6 text-sm text-muted-foreground">
                    Nothing generated yet — describe a site in the chat to get started.
                  </p>
                ) : (
                  <>
                    <div className="flex items-center justify-between border-b border-border px-3 py-1.5">
                      <span className="font-mono text-[11px] text-muted-foreground">{activeFile}</span>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-6 px-2 text-[11px]"
                        onClick={() => {
                          const f = files.find((x) => x.path === activeFile);
                          if (f) {
                            downloadFile(f);
                            toast.success(`Downloaded ${f.path}`);
                          }
                        }}
                      >
                        <Download className="mr-1 size-3.5" /> Download file
                      </Button>
                    </div>
                    <pre className="min-h-0 flex-1 overflow-auto p-4 text-xs leading-relaxed">
                      <code>{activeFileContent}</code>
                    </pre>
                  </>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </Shell>
  );
}
