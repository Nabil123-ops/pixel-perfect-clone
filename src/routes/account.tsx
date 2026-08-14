import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { ArrowRight } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { accountLabel, currentHandle, normalizeHandle, setHandle } from "@/lib/account";

export const Route = createFileRoute("/account")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "Your n9n account — no password needed" },
      {
        name: "description",
        content:
          "Pick a name and start automating. n9n accounts are password-less: your handle keeps your workflows, credentials and executions together.",
      },
      { property: "og:title", content: "Your n9n account — no password needed" },
      {
        property: "og:description",
        content: "Password-less n9n accounts: pick a name like nabil.n9n.app and keep every workflow saved.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: AccountPage,
});

function AccountPage() {
  const navigate = useNavigate();
  const [name, setName] = useState(currentHandle() ?? "");
  const [error, setError] = useState("");
  const preview = normalizeHandle(name);

  function submit(e: React.FormEvent) {
    e.preventDefault();
    try {
      setHandle(name);
      navigate({ to: "/workflows" });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Pick a name first");
    }
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="w-full max-w-sm">
        <div className="flex flex-col items-center text-center">
          <img src="/logo.png" alt="n9n logo" className="size-16 object-contain" width={64} height={64} />
          <h1 className="mt-4 font-display text-2xl font-bold tracking-tight">Create your account</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            No password, no email. Just a name — it becomes your workspace address.
          </p>
        </div>

        <form onSubmit={submit} className="mt-7 space-y-3">
          <Input
            autoFocus
            value={name}
            onChange={(e) => {
              setName(e.target.value);
              setError("");
            }}
            placeholder="Nabil"
            aria-label="Your name"
          />
          <p className="text-xs text-muted-foreground">
            Your address:{" "}
            <span className="font-mono text-foreground">{preview ? accountLabel(preview) : "yourname.n9n.app"}</span>
          </p>
          {error && <p className="text-xs text-destructive">{error}</p>}
          <Button type="submit" className="w-full gap-2">
            Continue <ArrowRight className="size-4" />
          </Button>
        </form>

        <p className="mt-4 text-center text-xs text-muted-foreground">
          Returning? Type the same name to open the same workspace.
        </p>
      </div>
    </main>
  );
}
