type RateEntry = {
  count: number;
  resetAt: number;
};

type RateLimitStore = Map<string, RateEntry>;

const windowMs = 60_000;
const maxRequests = 12;
const globalRateLimit = globalThis as typeof globalThis & {
  __agentYhRateLimit?: RateLimitStore;
};

export type RateLimitResult = {
  allowed: boolean;
  limit: number;
  remaining: number;
  resetAt: number;
};

export function checkAgentRateLimit(identifier: string, now = Date.now()): RateLimitResult {
  const store = (globalRateLimit.__agentYhRateLimit ??= new Map());
  const key = identifier.slice(0, 160) || "unknown";
  const existing = store.get(key);
  const current =
    !existing || existing.resetAt <= now
      ? { count: 0, resetAt: now + windowMs }
      : existing;

  if (store.size > 2_000) {
    for (const [entryKey, entry] of store) {
      if (entry.resetAt <= now) {
        store.delete(entryKey);
      }
    }
  }

  if (current.count >= maxRequests) {
    return {
      allowed: false,
      limit: maxRequests,
      remaining: 0,
      resetAt: current.resetAt
    };
  }

  current.count += 1;
  store.set(key, current);

  return {
    allowed: true,
    limit: maxRequests,
    remaining: Math.max(0, maxRequests - current.count),
    resetAt: current.resetAt
  };
}

export function rateLimitIdentifier(request: Request) {
  const forwarded = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim();
  return forwarded || request.headers.get("x-real-ip")?.trim() || "local";
}

export function rateLimitHeaders(result: RateLimitResult) {
  return {
    "RateLimit-Limit": String(result.limit),
    "RateLimit-Remaining": String(result.remaining),
    "RateLimit-Reset": String(Math.ceil(result.resetAt / 1_000))
  };
}
