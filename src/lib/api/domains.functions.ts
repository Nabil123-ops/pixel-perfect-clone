import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { withWorkspace } from "@/integrations/supabase/workspace-middleware";

export interface CustomDomain {
  id: string;
  domain: string;
  verificationToken: string;
  /** TXT record the user must publish: `n9n-verify.<domain>` -> this value. */
  verificationRecordName: string;
  verified: boolean;
  verifiedAt: string | null;
  lastCheckAt: string | null;
  lastCheckError: string | null;
  createdAt: string;
}

const domainSchema = z
  .string()
  .trim()
  .min(3)
  .max(255)
  .toLowerCase()
  .regex(
    /^(?!-)[a-z0-9-]{1,63}(?<!-)(\.(?!-)[a-z0-9-]{1,63}(?<!-))+$/,
    "Enter a valid domain, e.g. hooks.example.com",
  );

const recordNameFor = (domain: string) => `n9n-verify.${domain}`;

const rowToDomain = (row: {
  id: string;
  domain: string;
  verification_token: string;
  verified: boolean;
  verified_at: string | null;
  last_check_at: string | null;
  last_check_error: string | null;
  created_at: string;
}): CustomDomain => ({
  id: row.id,
  domain: row.domain,
  verificationToken: row.verification_token,
  verificationRecordName: recordNameFor(row.domain),
  verified: row.verified,
  verifiedAt: row.verified_at,
  lastCheckAt: row.last_check_at,
  lastCheckError: row.last_check_error,
  createdAt: row.created_at,
});

/** Every custom domain this account has registered, verified or not. */
export const listDomains = createServerFn({ method: "GET" })
  .middleware([withWorkspace])
  .handler(async ({ context }): Promise<CustomDomain[]> => {
    const { data, error } = await context.supabase
      .from("custom_domains")
      .select("*")
      .eq("user_id", context.userId)
      .order("created_at", { ascending: false });
    if (error) throw new Error(error.message);
    return (data ?? []).map(rowToDomain);
  });

/** The first verified domain for this account, if any — used to build production URLs. */
export const getVerifiedDomain = createServerFn({ method: "GET" })
  .middleware([withWorkspace])
  .handler(async ({ context }): Promise<{ domain: string | null }> => {
    const { data, error } = await context.supabase
      .from("custom_domains")
      .select("domain")
      .eq("user_id", context.userId)
      .eq("verified", true)
      .order("verified_at", { ascending: true })
      .limit(1)
      .maybeSingle();
    if (error) throw new Error(error.message);
    return { domain: data?.domain ?? null };
  });

/** Registers a domain (unverified) and returns the TXT record to publish. */
export const addDomain = createServerFn({ method: "POST" })
  .middleware([withWorkspace])
  .inputValidator((d: { domain: string }) => z.object({ domain: domainSchema }).parse(d))
  .handler(async ({ data, context }): Promise<CustomDomain> => {
    const { data: row, error } = await context.supabase
      .from("custom_domains")
      .insert({ user_id: context.userId, domain: data.domain })
      .select("*")
      .single();
    if (error) {
      if (error.code === "23505") throw new Error("That domain is already registered");
      throw new Error(error.message);
    }
    return rowToDomain(row);
  });

/**
 * Looks up the TXT record at `n9n-verify.<domain>` over DNS-over-HTTPS
 * (Cloudflare's resolver) and marks the domain verified if it contains the
 * expected token.
 */
export const verifyDomain = createServerFn({ method: "POST" })
  .middleware([withWorkspace])
  .inputValidator((d: { id: string }) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }): Promise<CustomDomain> => {
    const { data: row, error } = await context.supabase
      .from("custom_domains")
      .select("*")
      .eq("id", data.id)
      .eq("user_id", context.userId)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!row) throw new Error("Domain not found");

    const recordName = recordNameFor(row.domain);
    let ok = false;
    let checkError: string | null = null;

    try {
      const res = await fetch(
        `https://cloudflare-dns.com/dns-query?name=${encodeURIComponent(recordName)}&type=TXT`,
        { headers: { accept: "application/dns-json" } },
      );
      if (!res.ok) throw new Error(`DNS lookup failed (${res.status})`);
      const body = (await res.json()) as { Answer?: { data: string; type: number }[] };
      const values = (body.Answer ?? [])
        .filter((a) => a.type === 16) // TXT
        .map((a) => a.data.replace(/^"|"$/g, ""));
      ok = values.includes(row.verification_token);
      if (!ok) {
        checkError = values.length
          ? "TXT record found but the value doesn't match"
          : `No TXT record found at ${recordName}`;
      }
    } catch (err) {
      checkError = err instanceof Error ? err.message : String(err);
    }

    const now = new Date().toISOString();
    const { data: updated, error: updateError } = await context.supabase
      .from("custom_domains")
      .update({
        verified: ok,
        verified_at: ok ? now : row.verified_at,
        last_check_at: now,
        last_check_error: checkError,
      })
      .eq("id", row.id)
      .eq("user_id", context.userId)
      .select("*")
      .single();
    if (updateError) throw new Error(updateError.message);
    return rowToDomain(updated);
  });

export const deleteDomain = createServerFn({ method: "POST" })
  .middleware([withWorkspace])
  .inputValidator((d: { id: string }) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }): Promise<{ ok: true }> => {
    const { error } = await context.supabase
      .from("custom_domains")
      .delete()
      .eq("id", data.id)
      .eq("user_id", context.userId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });
