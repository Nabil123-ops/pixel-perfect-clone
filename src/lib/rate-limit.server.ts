import { supabaseAdmin } from "@/integrations/supabase/client.server";

export interface RateLimitResult {
  allowed: boolean;
  hits: number;
  limit: number;
  retryAfter: number;
}

/**
 * Atomic fixed-window counter backed by public.bump_rate_limit().
 * Fails open (allowed) if the database is unreachable so a limiter outage
 * never takes production webhooks down.
 */
export async function rateLimit(
  bucket: string,
  limit: number,
  windowSeconds = 60,
): Promise<RateLimitResult> {
  try {
    const rpc = supabaseAdmin.rpc as unknown as (
      fn: string,
      args: Record<string, unknown>,
    ) => Promise<{ data: unknown; error: { message: string } | null }>;
    const { data, error } = await rpc("bump_rate_limit", {
      _bucket: bucket,
      _limit: limit,
      _window_seconds: windowSeconds,
    });
    if (error) throw new Error(error.message);
    const hits = typeof data === "number" ? data : Number(data ?? 0);
    return {
      allowed: hits <= limit,
      hits,
      limit,
      retryAfter: windowSeconds,
    };
  } catch {
    return { allowed: true, hits: 0, limit, retryAfter: windowSeconds };
  }
}

export function clientIp(request: Request): string {
  return (
    request.headers.get("cf-connecting-ip") ??
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
    "unknown"
  );
}

export function tooManyRequests(result: RateLimitResult): Response {
  return Response.json(
    { error: "Rate limit exceeded", limit: result.limit, retryAfter: result.retryAfter },
    {
      status: 429,
      headers: {
        "retry-after": String(result.retryAfter),
        "x-ratelimit-limit": String(result.limit),
        "x-ratelimit-remaining": "0",
      },
    },
  );
}
