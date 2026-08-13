import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { withWorkspace } from "@/integrations/supabase/workspace-middleware";

import type { Credential, CredentialType } from "@/lib/flow/types";

const typeEnum = z.enum(["apiKey", "bearer", "basicAuth", "oauth2", "webhookUrl"]);

/** Credential values never leave the server in clear text — only masked previews. */
export const listCredentials = createServerFn({ method: "GET" })
  .middleware([withWorkspace])
  .handler(async ({ context }): Promise<Credential[]> => {
    const { decryptJson, maskValue } = await import("@/lib/crypto.server");
    const { data, error } = await context.supabase
      .from("credentials")
      .select("*")
      .eq("user_id", context.userId)
      .order("created_at", { ascending: false });
    if (error) throw new Error(error.message);
    const out: Credential[] = [];
    for (const row of data ?? []) {
      const fields = await decryptJson<Record<string, string>>(row.data_encrypted ?? "", {});
      out.push({
        id: row.id,
        name: row.name,
        type: row.type as CredentialType,
        fields: Object.fromEntries(Object.entries(fields).map(([k, v]) => [k, maskValue(v)])),
        lastTestOk: row.last_test_ok ?? null,
        lastTestMessage: row.last_test_message ?? null,
        lastTestedAt: row.last_tested_at ?? null,
        updatedAt: row.updated_at,
      });
    }
    return out;
  },
);

export const saveCredential = createServerFn({ method: "POST" })
  .middleware([withWorkspace])
  .inputValidator(
    (d: { id?: string; name: string; type: CredentialType; fields: Record<string, string> }) =>
      z
        .object({
          id: z.string().uuid().optional(),
          name: z
            .string()
            .min(1)
            .max(60)
            .regex(/^[A-Za-z0-9_]+$/, "Use letters, numbers and underscores only"),
          type: typeEnum,
          fields: z.record(z.string(), z.string().max(4000)),
        })
        .parse(d),
  )
  .handler(async ({ data, context }) => {
    const { encryptJson, decryptJson } = await import("@/lib/crypto.server");
    const db = context.supabase;

    let merged = data.fields;
    if (data.id) {
      const { data: row, error } = await db
        .from("credentials")
        .select("data_encrypted")
        .eq("id", data.id)
        .eq("user_id", context.userId)
        .maybeSingle();
      if (error) throw new Error(error.message);
      const existing = await decryptJson<Record<string, string>>(row?.data_encrypted ?? "", {});
      // Empty submitted values keep whatever is already stored (masked in the UI).
      merged = { ...existing };
      for (const [key, value] of Object.entries(data.fields)) {
        if (value !== "") merged[key] = value;
      }
    }

    const payload = {
      user_id: context.userId,
      name: data.name,
      type: data.type,
      data_encrypted: await encryptJson(merged),
    };

    if (data.id) {
      const { error } = await db.from("credentials").update(payload).eq("id", data.id).eq("user_id", context.userId);
      if (error) throw new Error(error.message);
      return { id: data.id };
    }
    const { data: row, error } = await db
      .from("credentials")
      .insert(payload)
      .select("id")
      .single();
    if (error) throw new Error(error.message);
    return { id: row.id };
  });

export const deleteCredential = createServerFn({ method: "POST" })
  .middleware([withWorkspace])
  .inputValidator((d: { id: string }) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase
      .from("credentials")
      .delete()
      .eq("id", data.id)
      .eq("user_id", context.userId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

/** Pings the credential's test endpoint using the stored secrets. */
export const testCredential = createServerFn({ method: "POST" })
  .middleware([withWorkspace])
  .inputValidator((d: { id: string }) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { decryptJson } = await import("@/lib/crypto.server");
    const { credentialTypeSpec } = await import("@/lib/flow/credentials");
    const { httpFetch } = await import("@/lib/engine/engine.server");

    const { data: row, error: readError } = await context.supabase
      .from("credentials")
      .select("*")
      .eq("id", data.id)
      .eq("user_id", context.userId)
      .maybeSingle();
    if (readError) throw new Error(readError.message);
    if (!row) throw new Error("Credential not found");

    const fields = await decryptJson<Record<string, string>>(row.data_encrypted ?? "", {});
    const spec = credentialTypeSpec(row.type as CredentialType);
    const request = spec.test?.(fields) ?? null;

    let ok = false;
    let message = "";
    if (!request) {
      const filled = Object.values(fields).some((v) => v.trim().length > 0);
      ok = filled;
      message = filled
        ? "Values present. This credential type has no test endpoint — add a Test URL to verify."
        : "No values stored yet.";
    } else {
      const res = await httpFetch({
        url: request.url,
        method: request.method ?? "GET",
        headers: request.headers ?? {},
      });
      ok = res.ok;
      message = res.error ?? `HTTP ${res.status} in ${res.ms}ms`;
    }

    const { error: updateError } = await context.supabase
      .from("credentials")
      .update({
        last_test_ok: ok,
        last_test_message: message.slice(0, 500),
        last_tested_at: new Date().toISOString(),
      })
      .eq("id", data.id)
      .eq("user_id", context.userId);
    if (updateError) throw new Error(updateError.message);

    return { ok, message };
  });

/** Step 1 of the OAuth2 authorization-code flow: build the consent URL. */
export const startOauth = createServerFn({ method: "POST" })
  .middleware([withWorkspace])
  .inputValidator((d: { id: string; redirectUri: string }) =>
    z.object({ id: z.string().uuid(), redirectUri: z.string().url() }).parse(d),
  )
  .handler(async ({ data, context }) => {
    const { decryptJson } = await import("@/lib/crypto.server");
    const { data: row, error } = await context.supabase
      .from("credentials")
      .select("*")
      .eq("id", data.id)
      .eq("user_id", context.userId)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!row) throw new Error("Credential not found");
    const fields = await decryptJson<Record<string, string>>(row.data_encrypted ?? "", {});
    if (!fields["authUrl"] || !fields["clientId"]) {
      throw new Error("Set clientId and authUrl on this credential first");
    }
    const state = crypto.randomUUID();
    const { error: updateError } = await context.supabase.from("credentials").update({ oauth_state: state })
      .eq("id", data.id)
      .eq("user_id", context.userId);
    if (updateError) throw new Error(updateError.message);
    const url = new URL(fields["authUrl"]);
    url.searchParams.set("response_type", "code");
    url.searchParams.set("client_id", fields["clientId"]);
    url.searchParams.set("redirect_uri", data.redirectUri);
    url.searchParams.set("state", `${data.id}:${state}`);
    if (fields["scope"]) url.searchParams.set("scope", fields["scope"]);
    url.searchParams.set("access_type", "offline");
    return { url: url.toString() };
  });
