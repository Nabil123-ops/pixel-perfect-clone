import { useEffect, useRef, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useNavigate } from "@tanstack/react-router";
import { Bot, Loader2, Send, Sparkles, User, Wand2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { askAI } from "@/lib/api/ai.functions";
import { CreateWithAIDialog } from "@/components/CreateWithAIDialog";

interface ChatMsg {
  role: "user" | "assistant";
  content: string;
}

const STARTERS = [
  "How do I get data from an API into Slack?",
  "What's the difference between a Webhook and a Chat Trigger?",
  "Explain how AI Agent nodes wire up memory and tools.",
];

export function AskAIPanel() {
  const navigate = useNavigate();
  const ask = useServerFn(askAI);
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<ChatMsg[]>([]);
  const [input, setInput] = useState("");
  const [pending, setPending] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, pending]);

  const send = async (text?: string) => {
    const content = (text ?? input).trim();
    if (!content || pending) return;
    const next: ChatMsg[] = [...messages, { role: "user", content }];
    setMessages(next);
    setInput("");
    setPending(true);
    try {
      const res = await ask({ data: { messages: next.slice(-20) } });
      if (res.error && !res.reply) {
        setMessages((m) => [...m, { role: "assistant", content: `⚠️ ${res.error}` }]);
      } else {
        setMessages((m) => [...m, { role: "assistant", content: res.reply }]);
      }
    } catch (err) {
      setMessages((m) => [
        ...m,
        { role: "assistant", content: `⚠️ ${err instanceof Error ? err.message : "Something went wrong."}` },
      ]);
    } finally {
      setPending(false);
    }
  };

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <button
          className="group fixed bottom-6 right-6 z-40 flex items-center gap-2 rounded-full border border-primary/30 bg-gradient-to-br from-primary to-accent px-4 py-3 text-sm font-semibold text-primary-foreground shadow-[0_8px_30px_-6px_rgba(0,0,0,0.4)] transition-transform hover:scale-[1.03] active:scale-95"
          aria-label="Ask AI"
        >
          <Sparkles className="size-4 shrink-0" />
          <span className="hidden sm:inline">Ask AI</span>
        </button>
      </SheetTrigger>
      <SheetContent
        side="right"
        className="flex w-full flex-col gap-0 p-0 sm:max-w-md"
      >
        <SheetHeader className="border-b border-border bg-gradient-to-br from-primary/10 to-accent/10 px-5 py-4">
          <SheetTitle className="flex items-center gap-2 font-display">
            <span className="flex size-8 items-center justify-center rounded-lg bg-primary/15 text-primary">
              <Bot className="size-4.5" />
            </span>
            Ask AI
          </SheetTitle>
          <p className="text-xs text-muted-foreground">
            Powered by Groq. Ask about nodes, triggers or how to build something.
          </p>
        </SheetHeader>

        <div ref={scrollRef} className="min-h-0 flex-1 overflow-y-auto px-5 py-4">
          {messages.length === 0 && (
            <div className="space-y-4">
              <p className="text-sm text-muted-foreground">
                Try asking, or jump straight to generating a workflow:
              </p>
              <CreateWithAIDialog
                trigger={
                  <Button variant="outline" size="sm" className="w-full justify-start gap-2">
                    <Wand2 className="size-3.5 text-primary" /> Create a workflow with AI
                  </Button>
                }
                onCreated={(id) => {
                  setOpen(false);
                  void navigate({ to: "/workflow/$id", params: { id } });
                }}
              />
              <div className="space-y-2">
                {STARTERS.map((s) => (
                  <button
                    key={s}
                    onClick={() => void send(s)}
                    className="block w-full rounded-lg border border-border bg-card px-3 py-2 text-left text-xs text-muted-foreground transition-colors hover:border-primary/40 hover:text-foreground"
                  >
                    {s}
                  </button>
                ))}
              </div>
            </div>
          )}

          <div className="space-y-4">
            {messages.map((m, i) => (
              <div
                key={i}
                className={`flex gap-2.5 ${m.role === "user" ? "flex-row-reverse text-right" : ""}`}
              >
                <span
                  className={`mt-0.5 flex size-6 shrink-0 items-center justify-center rounded-full ${
                    m.role === "user" ? "bg-secondary text-foreground" : "bg-primary/15 text-primary"
                  }`}
                >
                  {m.role === "user" ? <User className="size-3.5" /> : <Bot className="size-3.5" />}
                </span>
                <div
                  className={`min-w-0 max-w-[85%] rounded-2xl px-3.5 py-2 text-sm leading-relaxed whitespace-pre-wrap ${
                    m.role === "user"
                      ? "bg-primary text-primary-foreground"
                      : "border border-border bg-card"
                  }`}
                >
                  {m.content}
                </div>
              </div>
            ))}
            {pending && (
              <div className="flex items-center gap-2.5 text-xs text-muted-foreground">
                <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-primary/15 text-primary">
                  <Bot className="size-3.5" />
                </span>
                <Loader2 className="size-3.5 animate-spin" /> Thinking…
              </div>
            )}
          </div>
        </div>

        <div className="border-t border-border p-3">
          <div className="flex items-end gap-2">
            <Textarea
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  void send();
                }
              }}
              placeholder="Ask anything about your automations…"
              className="min-h-10 resize-none text-sm"
              rows={1}
            />
            <Button size="icon" onClick={() => void send()} disabled={pending || !input.trim()}>
              {pending ? <Loader2 className="size-4 animate-spin" /> : <Send className="size-4" />}
            </Button>
          </div>
          {messages.length > 0 && (
            <button
              onClick={() => setMessages([])}
              className="mt-2 text-[11px] text-muted-foreground hover:text-foreground"
            >
              Clear conversation
            </button>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}
