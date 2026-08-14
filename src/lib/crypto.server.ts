/** AES-GCM encryption for credential values at rest. Server-only. */

const enc = new TextEncoder();
const dec = new TextDecoder();

async function keyFor(secret: string): Promise<CryptoKey> {
  const hash = await crypto.subtle.digest("SHA-256", enc.encode(secret));
  return crypto.subtle.importKey("raw", hash, { name: "AES-GCM" }, false, ["encrypt", "decrypt"]);
}

/**
 * Encryption key for credentials at rest.
 * Uses CREDENTIAL_ENCRYPTION_KEY when configured; otherwise derives a stable
 * key from the service-role key so the app never hard-fails on a host where
 * the extra variable was not set (Cloudflare Pages, self-hosting, ...).
 */
function secret(): string {
  const value =
    process.env["CREDENTIAL_ENCRYPTION_KEY"] ||
    process.env["APP_SUPABASE_SERVICE_ROLE_KEY"] ||
    process.env["SUPABASE_SERVICE_ROLE_KEY"];
  if (!value) throw new Error("No encryption key available on this server");
  return value;
}

const toB64 = (bytes: Uint8Array) => btoa(String.fromCharCode(...bytes));
const fromB64 = (value: string) => Uint8Array.from(atob(value), (c) => c.charCodeAt(0));

export async function encryptJson(value: unknown): Promise<string> {
  const key = await keyFor(secret());
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const cipher = new Uint8Array(
    await crypto.subtle.encrypt({ name: "AES-GCM", iv }, key, enc.encode(JSON.stringify(value))),
  );
  return `v1.${toB64(iv)}.${toB64(cipher)}`;
}

export async function decryptJson<T>(payload: string, fallback: T): Promise<T> {
  if (!payload) return fallback;
  const [version, ivPart, cipherPart] = payload.split(".");
  if (version !== "v1" || !ivPart || !cipherPart) return fallback;
  try {
    const key = await keyFor(secret());
    const plain = await crypto.subtle.decrypt(
      { name: "AES-GCM", iv: fromB64(ivPart) },
      key,
      fromB64(cipherPart),
    );
    return JSON.parse(dec.decode(plain)) as T;
  } catch {
    return fallback;
  }
}

/** Values are never returned to the browser in clear text. */
export function maskValue(value: string): string {
  if (!value) return "";
  if (value.length <= 6) return "•".repeat(value.length);
  return `${value.slice(0, 3)}${"•".repeat(Math.min(12, value.length - 6))}${value.slice(-3)}`;
}
