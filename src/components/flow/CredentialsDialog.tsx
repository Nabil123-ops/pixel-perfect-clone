import { Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { CircleCheck, CircleX, KeyRound } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { listCredentials } from "@/lib/api/credentials.functions";
import { credentialTypeSpec } from "@/lib/flow/credentials";

/** Read-only vault overview for the editor — editing happens on /credentials. */
export function CredentialsDialog() {
  const list = useServerFn(listCredentials);
  const { data: creds = [] } = useQuery({ queryKey: ["credentials"], queryFn: () => list() });

  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm">
          <KeyRound className="mr-1.5 size-4" /> Credentials
        </Button>
      </DialogTrigger>
      <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-[560px]">
        <DialogHeader>
          <DialogTitle className="font-display">Credentials</DialogTitle>
          <DialogDescription>
            Encrypted on the server. Attach one to a node in the inspector, or reference a value with{" "}
            <code className="font-mono text-foreground">{"{{ $cred.Name.key }}"}</code>.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-2">
          {creds.map((c) => (
            <div
              key={c.id}
              className="flex items-center justify-between gap-3 rounded-lg border border-border p-3"
            >
              <div className="min-w-0">
                <p className="truncate font-display text-sm font-semibold">{c.name}</p>
                <p className="truncate text-xs text-muted-foreground">
                  {credentialTypeSpec(c.type).name} ·{" "}
                  {Object.keys(c.fields).length
                    ? `${Object.keys(c.fields).length} fields stored`
                    : "empty"}
                </p>
              </div>
              {c.lastTestOk === true && <CircleCheck className="size-4 shrink-0 text-primary" />}
              {c.lastTestOk === false && <CircleX className="size-4 shrink-0 text-destructive" />}
            </div>
          ))}
          {creds.length === 0 && (
            <p className="rounded-lg border border-dashed border-border p-6 text-center text-sm text-muted-foreground">
              No credentials yet.
            </p>
          )}
          <Button variant="outline" className="w-full" asChild>
            <Link to="/credentials">Manage credentials</Link>
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
