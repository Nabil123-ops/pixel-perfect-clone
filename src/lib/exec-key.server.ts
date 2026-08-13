/**
 * Deterministic per-workflow execution keys.
 * The key is an HMAC of the workflow id with the server secret, so no extra
 * storage is needed and the key can never be guessed by a caller.
 * Server-only.
 */

const enc = new TextEncoder();

function secret(): string {
  const value =
    process.env["CREDENTIAL_ENCRYPTION_KEY"] ??
    process.env["APP_SUPABASE_SERVICE_ROLE_KEY"] ??
    process.env["SUPABASE_SERVICE_ROLE_KEY"] ??
    "";
  if (!value) throw new Error("Execution signing secret is not configured");
  return value;
}

const toHex = (buf: ArrayBuffer) =>
  [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, "0")).join("");

export async function execKeyFor(workflowId: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    "raw",
    enc.encode(secret()),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const sig = await crypto.subtle.sign("HMAC", key, enc.encode(`exec:${workflowId}`));
  return toHex(sig).slice(0, 40);
}

export async function verifyExecKey(workflowId: string, provided: string): Promise<boolean> {
  const expected = await execKeyFor(workflowId);
  if (!provided || provided.length !== expected.length) return false;
  let diff = 0;
  for (let i = 0; i < expected.length; i++) {
    diff |= expected.charCodeAt(i) ^ provided.charCodeAt(i);
  }
  return diff === 0;
}
