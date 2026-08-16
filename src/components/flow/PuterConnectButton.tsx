import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Check, Loader2, Sparkles } from "lucide-react";

import { Button } from "@/components/ui/button";
import { saveCredential } from "@/lib/api/credentials.functions";
import { connectPuter } from "@/lib/puter";

interface Props {
  /** id of an existing credential named "Puter" to refresh in place, if any. */
  existingId?: string;
  /** Called with the credential name ("Puter") once it's saved and ready to attach. */
  onConnected: (credentialName: string) => void;
}

/**
 * One-click Puter auth for AI nodes. No dashboard visit, no pasting a key:
 * this opens Puter's real sign-in popup (or, if the person has no Puter
 * account yet, silently issues a free instant one) right from the node, then
 * stores the token it returns as a normal "apiKey" credential named "Puter"
 * so every Puter-backed node can reuse it going forward.
 */
export function PuterConnectButton({ existingId, onConnected }: Props) {
  const [state, setState] = useState<"idle" | "connecting" | "done" | "error">("idle");
  const [username, setUsername] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const save = useServerFn(saveCredential);
  const queryClient = useQueryClient();

  const connect = async () => {
    setState("connecting");
    setError(null);
    try {
      const { token, username: user } = await connectPuter();
      await save({
        data: {
          ...(existingId ? { id: existingId } : {}),
          name: "Puter",
          type: "apiKey",
          fields: { apiKey: token, headerName: "Authorization" },
        },
      });
      await queryClient.invalidateQueries({ queryKey: ["credentials"] });
      setUsername(user ?? null);
      setState("done");
      onConnected("Puter");
    } catch (err) {
      // Most common case: the popup was blocked because signIn() wasn't
      // triggered directly by this click, or the user closed it.
      setError(err instanceof Error ? err.message : "Sign-in was cancelled or blocked by the browser");
      setState("error");
    }
  };

  if (state === "done") {
    return (
      <p className="flex items-center gap-1.5 text-xs text-emerald-600 dark:text-emerald-400">
        <Check className="size-3.5 shrink-0" />
        Connected{username ? ` as ${username}` : ""} — saved, no key needed.
      </p>
    );
  }

  return (
    <div className="space-y-1">
      <Button
        type="button"
        variant="secondary"
        size="sm"
        className="w-full"
        disabled={state === "connecting"}
        onClick={connect}
      >
        {state === "connecting" ? (
          <Loader2 className="mr-1.5 size-3.5 animate-spin" />
        ) : (
          <Sparkles className="mr-1.5 size-3.5" />
        )}
        {state === "connecting" ? "Opening Puter sign-in…" : "Connect with Puter"}
      </Button>
      <p className="text-[11px] text-muted-foreground">
        Opens Puter's sign-in popup (or grants a free instant account) and saves the token for
        you automatically — nothing to copy or paste.
      </p>
      {error && <p className="text-[11px] text-destructive">{error}</p>}
    </div>
  );
}
