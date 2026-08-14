/**
 * Name-only accounts.
 *
 * There are no passwords: a visitor picks a handle (e.g. `Nabil`) and the app
 * stores it in a first-party cookie. Every server function resolves that
 * handle to a persistent account, so workflows, credentials and executions
 * are really saved and isolated per handle.
 *
 * Client-safe module: no secrets, no server-only imports.
 */

export const ACCOUNT_COOKIE = "n9n_handle";
export const ACCOUNT_DOMAIN = "n9n.app";

/** Lowercase, email-safe handle. `Nabil Dahdouh!` -> `nabil.dahdouh` */
export function normalizeHandle(raw: string): string {
  return raw
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9._-]+/g, ".")
    .replace(/\.{2,}/g, ".")
    .replace(/^[.\-_]+|[.\-_]+$/g, "")
    .slice(0, 40);
}

export function accountEmail(handle: string): string {
  return `${normalizeHandle(handle)}@${ACCOUNT_DOMAIN}`;
}

/** Full display id shown in the UI, e.g. `nabil.n9n.app`. */
export function accountLabel(handle: string): string {
  return `${normalizeHandle(handle)}.${ACCOUNT_DOMAIN}`;
}

export function readHandleCookie(cookieHeader: string | null | undefined): string | null {
  if (!cookieHeader) return null;
  for (const part of cookieHeader.split(";")) {
    const [key, ...rest] = part.trim().split("=");
    if (key === ACCOUNT_COOKIE) {
      const value = normalizeHandle(decodeURIComponent(rest.join("=")));
      return value || null;
    }
  }
  return null;
}

/* ---------------- browser helpers ---------------- */

export function currentHandle(): string | null {
  if (typeof document === "undefined") return null;
  return readHandleCookie(document.cookie);
}

export function setHandle(raw: string): string {
  const handle = normalizeHandle(raw);
  if (!handle) throw new Error("Pick a name first");
  document.cookie = `${ACCOUNT_COOKIE}=${encodeURIComponent(handle)}; path=/; max-age=${60 * 60 * 24 * 365}; samesite=lax`;
  try {
    localStorage.setItem(ACCOUNT_COOKIE, handle);
  } catch {
    /* private mode */
  }
  return handle;
}

export function clearHandle() {
  document.cookie = `${ACCOUNT_COOKIE}=; path=/; max-age=0; samesite=lax`;
  try {
    localStorage.removeItem(ACCOUNT_COOKIE);
  } catch {
    /* ignore */
  }
}
