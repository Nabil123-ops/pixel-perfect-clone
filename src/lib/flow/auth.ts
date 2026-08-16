import type { CredentialType } from "./types";

/**
 * Turns a decrypted credential's fields into real HTTP headers. Used by every
 * node that talks to an HTTP API so header behaviour is consistent regardless
 * of which node or credential type is involved. Pure/isomorphic — no server
 * only imports — so it's safe to call from both node `execute` functions and
 * client-side previews.
 */

/** Merge any `extraHeaders` JSON and numbered custom-header pairs onto `headers`. */
export function mergeExtraHeaders(
  cred: Record<string, string> | undefined,
  headers: Record<string, string>,
): Record<string, string> {
  const c = cred ?? {};

  const raw = c["extraHeaders"];
  if (raw && raw.trim()) {
    try {
      const parsed = JSON.parse(raw);
      if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
        for (const [k, v] of Object.entries(parsed as Record<string, unknown>)) {
          if (k && v != null && String(v) !== "") headers[k] = String(v);
        }
      }
    } catch {
      // Malformed JSON in extraHeaders is surfaced by credential validation,
      // not here — a broken extras field should never take down the request.
    }
  }

  // "Custom Header(s)" credential type: up to 5 free-form name/value pairs.
  for (let i = 1; i <= 5; i++) {
    const name = c[`header${i}Name`];
    const value = c[`header${i}Value`];
    if (name && value) headers[name] = value;
  }

  return headers;
}

export interface ApiKeyHeaderOptions {
  /** Header used when the credential itself doesn't set a custom `headerName`. */
  defaultHeaderName?: string;
  /** Whether the default header should get a "Bearer " prefix automatically. */
  bearerByDefault?: boolean;
}

/**
 * Builds the auth header for an `apiKey`-type credential. The stored `apiKey`
 * value is always the raw secret — this function decides the header name and
 * whether to prepend a scheme, so users never type "Bearer " themselves (that
 * used to double up with the engine's own prefix).
 */
export function apiKeyHeaders(
  cred: Record<string, string> | undefined,
  opts: ApiKeyHeaderOptions = {},
): Record<string, string> {
  const c = cred ?? {};
  const headers: Record<string, string> = {};
  const key = c["apiKey"] ?? c["token"] ?? "";
  const headerName = (c["headerName"] || opts.defaultHeaderName || "Authorization").trim();
  if (key) {
    const isAuthorization = headerName.toLowerCase() === "authorization";
    const alreadyScoped = /^[A-Za-z][\w-]*\s/.test(key); // e.g. user already typed "Bearer xxx"
    const useBearer = isAuthorization && (opts.bearerByDefault ?? true) && !alreadyScoped;
    headers[headerName] = useBearer ? `Bearer ${key}` : key;
  }
  return mergeExtraHeaders(c, headers);
}

/** Builds the auth header for a `bearer`-type credential (Authorization: Bearer <token>). */
export function bearerHeaders(cred: Record<string, string> | undefined): Record<string, string> {
  const c = cred ?? {};
  const headers: Record<string, string> = {};
  const token = c["token"] ?? c["apiKey"] ?? "";
  if (token) headers["Authorization"] = /^[A-Za-z][\w-]*\s/.test(token) ? token : `Bearer ${token}`;
  return mergeExtraHeaders(c, headers);
}

/** Builds the auth header for a `basicAuth`-type credential. */
export function basicAuthHeaders(cred: Record<string, string> | undefined): Record<string, string> {
  const c = cred ?? {};
  const headers: Record<string, string> = {};
  if (c["username"] || c["password"]) {
    const encode = typeof btoa === "function" ? btoa : (s: string) => Buffer.from(s).toString("base64");
    headers["Authorization"] = `Basic ${encode(`${c["username"] ?? ""}:${c["password"] ?? ""}`)}`;
  }
  return mergeExtraHeaders(c, headers);
}

/** Builds headers for an `oauth2`-type credential (bearer access token). */
export function oauth2Headers(cred: Record<string, string> | undefined): Record<string, string> {
  const c = cred ?? {};
  const headers: Record<string, string> = {};
  if (c["accessToken"]) headers["Authorization"] = `Bearer ${c["accessToken"]}`;
  return mergeExtraHeaders(c, headers);
}

/** Builds headers for the "Custom Header(s)" credential type — purely user-defined pairs. */
export function customHeaderHeaders(cred: Record<string, string> | undefined): Record<string, string> {
  return mergeExtraHeaders(cred, {});
}

/**
 * Generic dispatcher: builds the right headers for whichever credential type
 * is actually attached, so generic nodes (HTTP Request, AI tools) don't need
 * to know in advance which auth scheme the user picked.
 */
export function credentialHeaders(
  type: CredentialType | undefined,
  cred: Record<string, string> | undefined,
  opts: ApiKeyHeaderOptions = {},
): Record<string, string> {
  switch (type) {
    case "apiKey":
      return apiKeyHeaders(cred, opts);
    case "bearer":
      return bearerHeaders(cred);
    case "basicAuth":
      return basicAuthHeaders(cred);
    case "oauth2":
      return oauth2Headers(cred);
    case "customHeader":
      return customHeaderHeaders(cred);
    default:
      return mergeExtraHeaders(cred, {});
  }
}

/**
 * A node's execution context only carries merged credential *fields*, not the
 * credential's declared type (several credentials of different types can be
 * merged onto one node). This infers the right auth header(s) by which
 * fields are actually present, so general-purpose nodes like HTTP Request
 * work correctly no matter which credential type someone attaches — API key,
 * bearer, basic auth, OAuth2 or fully custom headers all apply automatically.
 */
export function headersFromCredentialFields(
  cred: Record<string, string> | undefined,
): Record<string, string> {
  const c = cred ?? {};
  const headers: Record<string, string> = {};

  if (c["accessToken"]) headers["Authorization"] = `Bearer ${c["accessToken"]}`;
  else if (c["token"]) headers["Authorization"] = `Bearer ${c["token"]}`;
  else if (c["apiKey"]) Object.assign(headers, apiKeyHeaders(c));

  if (!headers["Authorization"] && (c["username"] || c["password"])) {
    Object.assign(headers, basicAuthHeaders(c));
  }

  return mergeExtraHeaders(c, headers);
}
