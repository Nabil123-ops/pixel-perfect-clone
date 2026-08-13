import { createFileRoute } from "@tanstack/react-router";

/** OAuth2 redirect target: exchanges the code for tokens and stores them encrypted. */
async function callback(request: Request) {
  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state") ?? "";
  const [credentialId, nonce] = state.split(":");

  const back = (message: string, ok = false) =>
    new Response(null, {
      status: 302,
      headers: {
        Location: `/credentials?oauth=${ok ? "success" : "error"}&message=${encodeURIComponent(message)}`,
      },
    });

  if (!code || !credentialId || !nonce) return back("Missing OAuth code or state");

  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { decryptJson, encryptJson } = await import("@/lib/crypto.server");

  const { data: row } = await supabaseAdmin
    .from("credentials")
    .select("*")
    .eq("id", credentialId)
    .maybeSingle();
  if (!row) return back("Credential not found");
  if (row.oauth_state !== nonce) return back("State mismatch — restart the connection");

  const fields = await decryptJson<Record<string, string>>(row.data_encrypted ?? "", {});
  if (!fields["tokenUrl"]) return back("Credential has no token URL");

  const body = new URLSearchParams({
    grant_type: "authorization_code",
    code,
    client_id: fields["clientId"] ?? "",
    client_secret: fields["clientSecret"] ?? "",
    redirect_uri: `${url.origin}/api/public/oauth/callback`,
  });

  const res = await fetch(fields["tokenUrl"], {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded", Accept: "application/json" },
    body,
  });
  const text = await res.text();
  let tokens: Record<string, unknown> = {};
  try {
    tokens = JSON.parse(text) as Record<string, unknown>;
  } catch {
    return back(`Token endpoint returned non-JSON (HTTP ${res.status})`);
  }
  if (!res.ok || !tokens["access_token"]) {
    return back(String(tokens["error_description"] ?? tokens["error"] ?? `HTTP ${res.status}`));
  }

  const merged = {
    ...fields,
    accessToken: String(tokens["access_token"]),
    ...(tokens["refresh_token"] ? { refreshToken: String(tokens["refresh_token"]) } : {}),
    ...(tokens["expires_in"]
      ? { expiresAt: new Date(Date.now() + Number(tokens["expires_in"]) * 1000).toISOString() }
      : {}),
  };

  await supabaseAdmin
    .from("credentials")
    .update({
      data_encrypted: await encryptJson(merged),
      oauth_state: null,
      last_test_ok: true,
      last_test_message: "OAuth2 connected",
      last_tested_at: new Date().toISOString(),
    })
    .eq("id", credentialId);

  return back(`${row.name} connected`, true);
}

export const Route = createFileRoute("/api/public/oauth/callback")({
  server: {
    handlers: {
      GET: ({ request }) => callback(request),
    },
  },
});
