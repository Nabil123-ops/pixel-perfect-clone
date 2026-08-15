import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { CircleCheck, CircleX, Globe, RefreshCw, Trash2 } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Hint } from "@/components/flow/Hint";
import {
  addDomain,
  deleteDomain,
  listDomains,
  verifyDomain,
  type CustomDomain,
} from "@/lib/api/domains.functions";

function CopyCode({ value }: { value: string }) {
  return (
    <button
      type="button"
      onClick={async () => {
        await navigator.clipboard.writeText(value);
        toast.success("Copied");
      }}
      className="block w-full break-all rounded-md bg-secondary/60 p-2 text-left font-mono text-[10px] leading-relaxed hover:bg-secondary"
    >
      {value}
    </button>
  );
}

function DomainRow({ domain, onChanged }: { domain: CustomDomain; onChanged: () => void }) {
  const verify = useServerFn(verifyDomain);
  const remove = useServerFn(deleteDomain);
  const [busy, setBusy] = useState(false);

  const doVerify = async () => {
    setBusy(true);
    try {
      const res = await verify({ data: { id: domain.id } });
      if (res.verified) toast.success(`${domain.domain} verified`);
      else toast.error(res.lastCheckError ?? "TXT record not found yet");
      onChanged();
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const doDelete = async () => {
    setBusy(true);
    try {
      await remove({ data: { id: domain.id } });
      toast.success(`${domain.domain} removed`);
      onChanged();
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-1.5 rounded-md border border-border p-2">
      <div className="flex items-center justify-between gap-2">
        <span className="flex items-center gap-1.5 truncate font-mono text-[11px]">
          {domain.verified ? (
            <CircleCheck className="size-3.5 shrink-0 text-emerald-500" />
          ) : (
            <CircleX className="size-3.5 shrink-0 text-muted-foreground" />
          )}
          {domain.domain}
        </span>
        <div className="flex shrink-0 items-center gap-1">
          {!domain.verified && (
            <Hint text="Look up the TXT record over DNS-over-HTTPS and mark this domain verified if it matches.">
              <Button variant="outline" size="sm" className="h-6 px-2 text-[10px]" disabled={busy} onClick={() => void doVerify()}>
                <RefreshCw className="mr-1 size-3" /> Check
              </Button>
            </Hint>
          )}
          <Hint text="Remove this domain. Production URLs fall back to the default origin.">
            <Button variant="ghost" size="sm" className="h-6 px-2 text-[10px] text-destructive" disabled={busy} onClick={() => void doDelete()}>
              <Trash2 className="size-3" />
            </Button>
          </Hint>
        </div>
      </div>
      {!domain.verified && (
        <div className="space-y-1">
          <p className="text-[10px] text-muted-foreground">
            Add a TXT record at <span className="font-mono text-foreground">{domain.verificationRecordName}</span> with this value, then press Check:
          </p>
          <CopyCode value={domain.verificationToken} />
          {domain.lastCheckError && (
            <p className="text-[10px] text-destructive">{domain.lastCheckError}</p>
          )}
        </div>
      )}
    </div>
  );
}

/**
 * Lets the user attach a custom production domain. A domain is verified by
 * publishing a TXT record and checking it over DNS-over-HTTPS; once verified
 * it takes priority over VITE_APP_URL for every production URL shown in the
 * editor (see `src/lib/flow/endpoints.ts`).
 */
export function DomainPanel() {
  const qc = useQueryClient();
  const list = useServerFn(listDomains);
  const add = useServerFn(addDomain);

  const { data: domains = [] } = useQuery({
    queryKey: ["custom-domains"],
    queryFn: () => list().catch(() => []),
  });

  const [value, setValue] = useState("");
  const [busy, setBusy] = useState(false);

  const refresh = () => void qc.invalidateQueries({ queryKey: ["custom-domains"] });

  const submit = async () => {
    if (!value.trim()) return;
    setBusy(true);
    try {
      await add({ data: { domain: value.trim() } });
      setValue("");
      toast.success("Domain added — publish the TXT record to verify it");
      refresh();
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-3 rounded-lg border border-border p-3">
      <p className="flex items-center gap-1.5 font-display text-xs font-semibold uppercase tracking-wider text-muted-foreground">
        <Globe className="size-3.5" /> Custom domains
      </p>

      <div className="flex gap-2">
        <Input
          value={value}
          onChange={(e) => setValue(e.target.value)}
          placeholder="hooks.example.com"
          className="h-8 font-mono text-[11px]"
          onKeyDown={(e) => e.key === "Enter" && void submit()}
        />
        <Button size="sm" className="h-8 shrink-0 text-[11px]" disabled={busy || !value.trim()} onClick={() => void submit()}>
          Add
        </Button>
      </div>

      <div className="space-y-2">
        {domains.map((d) => (
          <DomainRow key={d.id} domain={d} onChanged={refresh} />
        ))}
        {domains.length === 0 && (
          <p className="text-[11px] text-muted-foreground">
            No custom domains yet. Once one is verified, it replaces the default origin in every production URL.
          </p>
        )}
      </div>
    </div>
  );
}
