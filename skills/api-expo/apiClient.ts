// lib/apiClient.ts
// Transport layer. No Expo imports on purpose: fetch and token storage are injected,
// so this file runs under plain Node for tests (see apiClient.test.ts).
// Wire it to Expo in lib/api.ts.

// ---------- Errors ----------

export type ApiErrorKind =
  | "http" // server answered with a non-2xx status we won't retry (or retries ran out)
  | "timeout" // per-attempt timeout hit, including a stalled response body
  | "network" // no connection, DNS, reset
  | "cancelled" // caller aborted (unmount, query cancelled). Never retried.
  | "rate_limited" // 429 and retries ran out, or Retry-After was too long to wait
  | "session_expired" // refresh token missing or rejected. Show login.
  | "parse"; // 2xx but body was not valid JSON

export class ApiError extends Error {
  constructor(
    message: string,
    readonly kind: ApiErrorKind,
    readonly status = 0,
    readonly retryAfterMs?: number,
    readonly body?: unknown,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

/** True for failures where "try again" is a sensible button. */
export const isTransient = (e: unknown): boolean =>
  e instanceof ApiError &&
  (e.kind === "timeout" || e.kind === "network" || e.kind === "rate_limited" || e.status >= 500);

// ---------- Policies (timeout per attempt, retries for 5xx/timeout/network) ----------

export interface Policy {
  timeoutMs: number;
  maxRetries: number;
}

export const POLICIES = {
  auth: { timeoutMs: 10_000, maxRetries: 2 },
  profile: { timeoutMs: 10_000, maxRetries: 3 },
  read: { timeoutMs: 15_000, maxRetries: 3 }, // lists, feeds, search, detail
  upload: { timeoutMs: 60_000, maxRetries: 1 }, // needs Idempotency-Key to retry
  export: { timeoutMs: 90_000, maxRetries: 1 },
  payment: { timeoutMs: 20_000, maxRetries: 1 }, // needs Idempotency-Key to retry
} as const satisfies Record<string, Policy>;

// ---------- Types ----------

export interface TokenStore {
  getAccessToken(): Promise<string | null>;
  getRefreshToken(): Promise<string | null>;
  saveTokens(t: { accessToken: string; refreshToken?: string }): Promise<void>;
  clear(): Promise<void>;
}

export type ClientEvent =
  | { type: "retry"; endpoint: string; attempt: number; reason: string; delayMs: number }
  | { type: "giveup"; endpoint: string; error: ApiError }
  | { type: "rate_limit"; endpoint: string; headers: Record<string, string> }
  | { type: "refresh"; ok: boolean };

export interface ClientConfig {
  baseUrl: string;
  /** Pass expo/fetch (cast to typeof fetch) in the app, a mock in tests. */
  fetch: typeof fetch;
  tokens: TokenStore;
  refreshPath?: string; // default "/auth/refresh"
  onSessionExpired?: () => void;
  rateLimiter?: { acquire(signal?: AbortSignal): Promise<void> };
  /** Observability + "retrying in N seconds" UI. Never put tokens or PII in what you log. */
  onEvent?: (e: ClientEvent) => void;
  /** Longest Retry-After we are willing to sleep through. Longer means fail fast. Default 30s. */
  maxRetryAfterMs?: number;
  /** Retries for 429 specifically. Default 3. */
  rateLimitRetries?: number;
  // Test seams
  sleep?: (ms: number, signal?: AbortSignal) => Promise<void>;
  random?: () => number;
  now?: () => number;
}

export interface RequestOptions extends Omit<RequestInit, "signal"> {
  policy?: Policy; // default POLICIES.read
  signal?: AbortSignal; // caller cancellation (TanStack Query passes one)
  skipAuth?: boolean; // login, register: no token attached, no 401 refresh
  json?: unknown; // shortcut: JSON.stringify into body
}

// ---------- Helpers ----------

const SAFE_METHODS = new Set(["GET", "HEAD", "PUT", "DELETE", "OPTIONS"]);
const RETRYABLE_STATUS = new Set([408, 500, 502, 503, 504]);

export function abortableSleep(ms: number, signal?: AbortSignal): Promise<void> {
  return new Promise<void>((resolve, reject) => {
    if (signal?.aborted) return reject(new Error("aborted"));
    let timer: ReturnType<typeof setTimeout>;
    const onAbort = () => {
      clearTimeout(timer);
      reject(new Error("aborted"));
    };
    timer = setTimeout(() => {
      signal?.removeEventListener("abort", onAbort);
      resolve();
    }, ms);
    signal?.addEventListener("abort", onAbort, { once: true });
  });
}

/** Retry-After is either delta-seconds or an HTTP-date. Returns ms, or null if absent/garbage. */
export function parseRetryAfter(value: string | null, now: number): number | null {
  if (!value) return null;
  const v = value.trim();
  if (/^\d+$/.test(v)) return Number(v) * 1000;
  const at = Date.parse(v);
  return Number.isNaN(at) ? null : Math.max(0, at - now);
}

function toPlainHeaders(h?: HeadersInit): Record<string, string> {
  const out: Record<string, string> = {};
  if (h) new Headers(h).forEach((v, k) => (out[k] = v)); // keys come out lowercase
  return out;
}

const RATE_HEADERS = ["retry-after", "ratelimit-limit", "ratelimit-remaining", "ratelimit-reset"];
function rateHeaders(h: Headers): Record<string, string> {
  const out: Record<string, string> = {};
  h.forEach((v, k) => {
    if (RATE_HEADERS.includes(k) || k.startsWith("x-ratelimit-")) out[k] = v;
  });
  return out;
}

interface Raw {
  status: number;
  ok: boolean;
  headers: Headers;
  text: string;
}

function parseBody(raw: Raw, strict: boolean): unknown {
  if (!raw.text) return null;
  if (!(raw.headers.get("content-type") ?? "").includes("json")) return raw.text;
  try {
    return JSON.parse(raw.text);
  } catch {
    if (strict) throw new ApiError("Invalid JSON in response", "parse", raw.status);
    return undefined;
  }
}

function messageFrom(body: unknown, status: number): string {
  const b = body as { error?: { message?: unknown } | string; message?: unknown } | undefined;
  const m = typeof b?.error === "object" ? b.error?.message : (b?.error ?? b?.message);
  return typeof m === "string" && m ? m : `Request failed: ${status}`;
}

// ---------- Client ----------

export function createApiClient(cfg: ClientConfig) {
  const sleep = cfg.sleep ?? abortableSleep;
  const random = cfg.random ?? Math.random;
  const now = cfg.now ?? Date.now;
  const maxRetryAfterMs = cfg.maxRetryAfterMs ?? 30_000;
  const rateLimitRetries = cfg.rateLimitRetries ?? 3;
  const refreshPath = cfg.refreshPath ?? "/auth/refresh";
  const emit = (e: ClientEvent) => cfg.onEvent?.(e);

  /** Equal jitter: half fixed, half random. Never near zero, still spreads clients out. */
  const backoff = (attempt: number, capMs: number) => {
    const exp = Math.min(1000 * 2 ** attempt, capMs);
    return exp / 2 + random() * (exp / 2);
  };

  /**
   * One timed attempt. The timer covers the response BODY too, so a stalled download
   * times out instead of hanging forever. Throws ApiError(kind: cancelled|timeout|network).
   */
  async function send(
    url: string,
    init: RequestInit,
    timeoutMs: number,
    external?: AbortSignal,
  ): Promise<Raw> {
    if (external?.aborted) throw new ApiError("Cancelled", "cancelled");
    const controller = new AbortController();
    let timedOut = false;
    const timer = setTimeout(() => {
      timedOut = true;
      controller.abort();
    }, timeoutMs);
    const onAbort = () => controller.abort();
    external?.addEventListener("abort", onAbort, { once: true });
    try {
      const res = await cfg.fetch(url, { ...init, signal: controller.signal });
      const text = res.status === 204 || res.status === 205 ? "" : await res.text();
      return { status: res.status, ok: res.ok, headers: res.headers, text };
    } catch {
      if (external?.aborted) throw new ApiError("Cancelled", "cancelled");
      if (timedOut) throw new ApiError("Request timed out", "timeout");
      throw new ApiError("Network error", "network");
    } finally {
      clearTimeout(timer);
      external?.removeEventListener("abort", onAbort);
    }
  }

  async function expireSession(): Promise<ApiError> {
    await cfg.tokens.clear();
    cfg.onSessionExpired?.();
    return new ApiError("Session expired", "session_expired", 401);
  }

  // One refresh at a time. Parallel 401s share this promise (refresh-token reuse detection).
  let refreshInFlight: Promise<void> | null = null;

  async function doRefresh(): Promise<void> {
    const refreshToken = await cfg.tokens.getRefreshToken();
    if (!refreshToken) throw await expireSession();

    // Network/timeout errors propagate as-is: a flaky connection must NOT log the user out.
    const raw = await send(
      `${cfg.baseUrl}${refreshPath}`,
      {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ refreshToken }),
      },
      POLICIES.auth.timeoutMs,
    );

    if (raw.status === 400 || raw.status === 401) {
      emit({ type: "refresh", ok: false });
      throw await expireSession(); // definite rejection: only case that clears credentials
    }
    if (!raw.ok) {
      emit({ type: "refresh", ok: false });
      throw new ApiError(`Token refresh failed: ${raw.status}`, "http", raw.status);
    }
    const data = parseBody(raw, true) as { accessToken?: unknown; refreshToken?: unknown } | null;
    if (typeof data?.accessToken !== "string") {
      throw new ApiError("Refresh response missing accessToken", "parse", raw.status);
    }
    await cfg.tokens.saveTokens({
      accessToken: data.accessToken,
      refreshToken: typeof data.refreshToken === "string" ? data.refreshToken : undefined,
    });
    emit({ type: "refresh", ok: true });
  }

  async function ensureFreshToken(staleToken: string | null): Promise<void> {
    // Another request may have refreshed while ours was in flight. Don't refresh twice.
    const current = await cfg.tokens.getAccessToken();
    if (current && current !== staleToken) return;
    refreshInFlight ??= doRefresh().finally(() => {
      refreshInFlight = null;
    });
    await refreshInFlight;
  }

  async function request<T>(endpoint: string, opts: RequestOptions = {}): Promise<T> {
    const { policy = POLICIES.read, signal, skipAuth = false, json, ...init } = opts;
    if (json !== undefined) init.body = JSON.stringify(json);

    const url = `${cfg.baseUrl}${endpoint}`;
    const method = (init.method ?? "GET").toUpperCase();
    const headers = toPlainHeaders(init.headers);

    // multipart needs the runtime-generated boundary. Any Content-Type here would break it.
    const isForm = typeof FormData !== "undefined" && init.body instanceof FormData;
    if (isForm) delete headers["content-type"];
    else if (init.body != null && !headers["content-type"]) headers["content-type"] = "application/json";

    // A retry is only safe if repeating the request cannot repeat a side effect.
    const replaySafe = SAFE_METHODS.has(method) || !!headers["idempotency-key"]?.trim();

    const useSession = !skipAuth && !headers["authorization"];
    let usedToken: string | null = null;

    // Any abort during a wait means the caller left. Surface it as "cancelled".
    const pause = async (ms: number) => {
      try {
        await sleep(ms, signal);
      } catch {
        throw new ApiError("Cancelled", "cancelled");
      }
    };
    const fail = (err: ApiError) => {
      if (err.kind !== "cancelled") emit({ type: "giveup", endpoint, error: err });
      return err;
    };

    let attempt = 0; // retries used for 5xx / timeout / network
    let rateAttempt = 0; // retries used for 429
    let refreshed = false;

    for (;;) {
      if (cfg.rateLimiter) {
        try {
          await cfg.rateLimiter.acquire(signal);
        } catch {
          throw new ApiError("Cancelled", "cancelled");
        }
      }
      if (useSession) {
        usedToken = await cfg.tokens.getAccessToken();
        if (usedToken) headers["authorization"] = `Bearer ${usedToken}`;
        else delete headers["authorization"];
      }

      let raw: Raw;
      try {
        raw = await send(url, { ...init, method, headers }, policy.timeoutMs, signal);
      } catch (e) {
        const err = e as ApiError;
        const transient = err.kind === "timeout" || err.kind === "network";
        if (transient && replaySafe && attempt < policy.maxRetries) {
          const delayMs = backoff(attempt, 8_000);
          emit({ type: "retry", endpoint, attempt: ++attempt, reason: err.kind, delayMs });
          await pause(delayMs);
          continue;
        }
        throw fail(err);
      }

      if (raw.ok) return parseBody(raw, true) as T;

      // 401: refresh once, then replay. Skipped for login-style calls and caller-supplied auth.
      if (raw.status === 401 && useSession && !refreshed) {
        refreshed = true;
        try {
          await ensureFreshToken(usedToken);
        } catch (e) {
          throw fail(e as ApiError);
        }
        continue;
      }

      const retryAfter = parseRetryAfter(raw.headers.get("retry-after"), now());
      const tooLong = retryAfter != null && retryAfter > maxRetryAfterMs;
      const errorBody = parseBody(raw, false);

      // 429: the server rejected the request before doing any work, so replay is safe for any method.
      if (raw.status === 429) {
        emit({ type: "rate_limit", endpoint, headers: rateHeaders(raw.headers) });
        if (rateAttempt >= rateLimitRetries || tooLong) {
          throw fail(new ApiError("Rate limited", "rate_limited", 429, retryAfter ?? undefined, errorBody));
        }
        const delayMs = retryAfter != null ? retryAfter + random() * 500 : backoff(rateAttempt, 16_000);
        emit({ type: "retry", endpoint, attempt: ++rateAttempt, reason: "429", delayMs });
        await pause(delayMs);
        continue;
      }

      if (RETRYABLE_STATUS.has(raw.status) && replaySafe && attempt < policy.maxRetries && !tooLong) {
        const delayMs = retryAfter != null ? retryAfter + random() * 500 : backoff(attempt, 8_000);
        emit({ type: "retry", endpoint, attempt: ++attempt, reason: String(raw.status), delayMs });
        await pause(delayMs);
        continue;
      }

      throw fail(
        new ApiError(messageFrom(errorBody, raw.status), "http", raw.status, retryAfter ?? undefined, errorBody),
      );
    }
  }

  return { request };
}

// ---------- Client-side rate limiter (token bucket) ----------

/**
 * Keeps the app under the API's documented quota. Example: 60 req/min -> new RateLimiter(10, 1)
 * (burst of 10, refills 1 per second). Skip it if the API documents no quota.
 * Waits are abortable, so leaving a screen frees the queue.
 */
export class RateLimiter {
  private tokens: number;
  private last: number;

  constructor(
    private capacity: number,
    private refillPerSec: number,
    private now: () => number = Date.now,
  ) {
    this.tokens = capacity;
    this.last = now();
  }

  async acquire(signal?: AbortSignal): Promise<void> {
    for (;;) {
      const t = this.now();
      this.tokens = Math.min(this.capacity, this.tokens + ((t - this.last) / 1000) * this.refillPerSec);
      this.last = t;
      if (this.tokens >= 1) {
        this.tokens -= 1;
        return;
      }
      await abortableSleep(Math.ceil(((1 - this.tokens) / this.refillPerSec) * 1000), signal);
    }
  }
}
