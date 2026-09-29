// Run:  npx tsx --test references/apiClient.test.ts
// Uses node:test so it needs no Expo or Jest setup. Port the cases to Jest if your app uses it.
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  ApiError,
  POLICIES,
  RateLimiter,
  createApiClient,
  parseRetryAfter,
  type ClientConfig,
  type ClientEvent,
  type TokenStore,
} from "./apiClient";

// ---------- Harness ----------

const json = (body: unknown, status = 200, headers: Record<string, string> = {}) =>
  new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json", ...headers } });

type Handler = (url: string, init: RequestInit, call: number) => Response | Promise<Response>;

function memoryTokens(access: string | null = "old", refresh: string | null = "r1") {
  const s = {
    access,
    refresh,
    cleared: false,
    getAccessToken: async () => s.access,
    getRefreshToken: async () => s.refresh,
    saveTokens: async (t: { accessToken: string; refreshToken?: string }) => {
      s.access = t.accessToken;
      if (t.refreshToken) s.refresh = t.refreshToken;
    },
    clear: async () => {
      s.access = null;
      s.refresh = null;
      s.cleared = true;
    },
  };
  return s satisfies TokenStore & Record<string, unknown>;
}

function setup(handler: Handler, extra: Partial<ClientConfig> = {}) {
  const calls: { url: string; init: RequestInit }[] = [];
  const sleeps: number[] = [];
  const events: ClientEvent[] = [];
  const tokens = memoryTokens();
  let expired = 0;
  const client = createApiClient({
    baseUrl: "https://api.test",
    fetch: (async (url: string, init: RequestInit) => {
      calls.push({ url, init });
      return handler(url, init, calls.length);
    }) as unknown as typeof fetch,
    tokens,
    onSessionExpired: () => void expired++,
    onEvent: (e) => events.push(e),
    random: () => 0.5,
    sleep: async (ms) => void sleeps.push(ms),
    ...extra,
  });
  return { client, calls, sleeps, events, tokens, expired: () => expired };
}

const kindOf = async (p: Promise<unknown>) => {
  try {
    await p;
    return "no error";
  } catch (e) {
    return e instanceof ApiError ? e.kind : `non-ApiError: ${e}`;
  }
};

const hangUntilAbort = (init: RequestInit) =>
  new Promise<Response>((_, reject) => init.signal!.addEventListener("abort", () => reject(new Error("aborted"))));

// ---------- Retries ----------

test("GET retries 503 with equal-jitter backoff, then succeeds", async () => {
  const t = setup((_, __, n) => (n < 3 ? json({}, 503) : json({ ok: 1 })));
  assert.deepEqual(await t.client.request("/x"), { ok: 1 });
  assert.equal(t.calls.length, 3);
  assert.deepEqual(t.sleeps, [750, 1500]); // random=0.5 -> 1s*0.75, 2s*0.75. Never near zero.
});

test("POST without Idempotency-Key is never retried on 5xx", async () => {
  const t = setup(() => json({}, 503));
  assert.equal(await kindOf(t.client.request("/orders", { method: "POST", json: {} })), "http");
  assert.equal(t.calls.length, 1);
});

test("POST with Idempotency-Key retries, and the key is identical on every attempt", async () => {
  const t = setup((_, __, n) => (n < 2 ? json({}, 502) : json({ id: 1 })));
  await t.client.request("/orders", {
    method: "POST",
    json: {},
    headers: { "Idempotency-Key": "abc" },
    policy: POLICIES.payment,
  });
  assert.equal(t.calls.length, 2);
  for (const c of t.calls) assert.equal((c.init.headers as Record<string, string>)["idempotency-key"], "abc");
});

test("whitespace-only Idempotency-Key does not count", async () => {
  const t = setup(() => json({}, 503));
  await kindOf(t.client.request("/o", { method: "POST", headers: { "Idempotency-Key": "  " } }));
  assert.equal(t.calls.length, 1);
});

test("policy.maxRetries is honored (payment = 1 retry -> 2 calls)", async () => {
  const t = setup(() => json({}, 503));
  await kindOf(
    t.client.request("/pay", { method: "POST", headers: { "Idempotency-Key": "k" }, policy: POLICIES.payment }),
  );
  assert.equal(t.calls.length, 2);
});

test("4xx other than 401/429 is never retried", async () => {
  for (const status of [400, 403, 404, 422]) {
    const t = setup(() => json({ error: { message: "nope" } }, status));
    await assert.rejects(t.client.request("/x"), (e: ApiError) => e.kind === "http" && e.message === "nope");
    assert.equal(t.calls.length, 1);
  }
});

// ---------- 429 ----------

test("429 honors Retry-After seconds, plus small jitter", async () => {
  const t = setup((_, __, n) => (n < 2 ? json({}, 429, { "retry-after": "2" }) : json({ ok: 1 })));
  await t.client.request("/x");
  assert.deepEqual(t.sleeps, [2250]);
});

test("429 parses Retry-After as an HTTP-date", async () => {
  const now = 1_700_000_000_000;
  const date = new Date(now + 5000).toUTCString();
  assert.equal(parseRetryAfter(date, now), 5000);
  const t = setup((_, __, n) => (n < 2 ? json({}, 429, { "retry-after": date }) : json({})), { now: () => now });
  await t.client.request("/x");
  assert.deepEqual(t.sleeps, [5250]);
});

test("429 with an absurd Retry-After fails fast instead of sleeping", async () => {
  const t = setup(() => json({}, 429, { "retry-after": "3600" }));
  await assert.rejects(
    t.client.request("/x"),
    (e: ApiError) => e.kind === "rate_limited" && e.retryAfterMs === 3_600_000,
  );
  assert.equal(t.calls.length, 1);
  assert.equal(t.sleeps.length, 0);
});

test("429 without header: 3 retries then rate_limited; POST is safe to retry here", async () => {
  const t = setup(() => json({}, 429));
  assert.equal(await kindOf(t.client.request("/x", { method: "POST", json: {} })), "rate_limited");
  assert.equal(t.calls.length, 4);
  assert.deepEqual(t.sleeps, [750, 1500, 3000]);
});

test("429 emits rate-limit headers for logging", async () => {
  const t = setup(() => json({}, 429, { "ratelimit-remaining": "0", "x-ratelimit-limit": "60" }));
  await kindOf(t.client.request("/x"));
  const ev = t.events.find((e) => e.type === "rate_limit");
  assert.deepEqual(ev && "headers" in ev ? ev.headers : null, { "ratelimit-remaining": "0", "x-ratelimit-limit": "60" });
});

// ---------- Cancellation and timeouts ----------

test("pre-aborted signal makes zero network calls", async () => {
  const t = setup(() => json({}));
  const c = new AbortController();
  c.abort();
  assert.equal(await kindOf(t.client.request("/x", { signal: c.signal })), "cancelled");
  assert.equal(t.calls.length, 0);
});

test("cancel mid-request is NOT retried", async () => {
  const t = setup((_, init) => hangUntilAbort(init));
  const c = new AbortController();
  const p = kindOf(t.client.request("/x", { signal: c.signal }));
  setTimeout(() => c.abort(), 10);
  assert.equal(await p, "cancelled");
  assert.equal(t.calls.length, 1);
});

test("cancel during backoff sleep stops the retry loop", async () => {
  const { abortableSleep } = await import("./apiClient");
  const t = setup(() => json({}, 503), { sleep: abortableSleep });
  const c = new AbortController();
  const started = Date.now();
  const p = kindOf(t.client.request("/x", { signal: c.signal }));
  setTimeout(() => c.abort(), 20);
  assert.equal(await p, "cancelled");
  assert.equal(t.calls.length, 1);
  assert.ok(Date.now() - started < 400);
});

test("timeout is classified as timeout and retried for GET", async () => {
  const t = setup((_, init) => hangUntilAbort(init));
  assert.equal(
    await kindOf(t.client.request("/x", { policy: { timeoutMs: 15, maxRetries: 1 } })),
    "timeout",
  );
  assert.equal(t.calls.length, 2);
});

test("timeout covers a stalled response BODY, not just headers", async () => {
  const t = setup(
    (_, init) =>
      ({
        status: 200,
        ok: true,
        headers: new Headers(),
        text: () => new Promise((_, rej) => init.signal!.addEventListener("abort", () => rej(new Error("aborted")))),
      }) as unknown as Response,
  );
  assert.equal(await kindOf(t.client.request("/x", { policy: { timeoutMs: 15, maxRetries: 0 } })), "timeout");
});

test("network failure on POST without key is not retried", async () => {
  const t = setup(() => Promise.reject(new TypeError("Network request failed")));
  assert.equal(await kindOf(t.client.request("/o", { method: "POST", json: {} })), "network");
  assert.equal(t.calls.length, 1);
});

// ---------- Auth ----------

function authedHandler(counter: { refresh: number }): Handler {
  return (url, init) => {
    if (url.endsWith("/auth/refresh")) {
      counter.refresh++;
      return json({ accessToken: "new", refreshToken: "r2" });
    }
    return (init.headers as Record<string, string>).authorization === "Bearer new" ? json({ ok: 1 }) : json({}, 401);
  };
}

test("3 parallel 401s trigger exactly ONE refresh, and all succeed", async () => {
  const counter = { refresh: 0 };
  const t = setup(authedHandler(counter));
  const results = await Promise.all([t.client.request("/a"), t.client.request("/b"), t.client.request("/c")]);
  assert.equal(counter.refresh, 1);
  assert.deepEqual(results, [{ ok: 1 }, { ok: 1 }, { ok: 1 }]);
  assert.equal(t.tokens.refresh, "r2"); // rotated refresh token saved
});

test("late 401 (token already refreshed by someone else) does not refresh again", async () => {
  const counter = { refresh: 0 };
  const t = setup((url, init, n) => {
    if (n === 1) {
      t.tokens.access = "new"; // another request refreshed while we were in flight
      return json({}, 401);
    }
    return authedHandler(counter)(url, init, n);
  });
  assert.deepEqual(await t.client.request("/a"), { ok: 1 });
  assert.equal(counter.refresh, 0);
});

test("refresh rejected (401) -> session_expired, credentials cleared, callback fired once", async () => {
  const t = setup((url) => (url.endsWith("/auth/refresh") ? json({}, 401) : json({}, 401)));
  assert.equal(await kindOf(t.client.request("/a")), "session_expired");
  assert.equal(t.tokens.cleared, true);
  assert.equal(t.expired(), 1);
});

test("refresh fails on the NETWORK -> network error, user stays logged in", async () => {
  const t = setup((url) => (url.endsWith("/auth/refresh") ? Promise.reject(new TypeError("offline")) : json({}, 401)));
  assert.equal(await kindOf(t.client.request("/a")), "network");
  assert.equal(t.tokens.cleared, false);
  assert.equal(t.expired(), 0);
});

test("refresh returns 503 -> transient error, no logout", async () => {
  const t = setup((url) => (url.endsWith("/auth/refresh") ? json({}, 503) : json({}, 401)));
  await assert.rejects(t.client.request("/a"), (e: ApiError) => e.kind === "http" && e.status === 503);
  assert.equal(t.tokens.cleared, false);
});

test("401 after a successful refresh surfaces as http 401, no refresh loop", async () => {
  const counter = { refresh: 0 };
  const t = setup((url) => {
    if (url.endsWith("/auth/refresh")) {
      counter.refresh++;
      return json({ accessToken: "new" });
    }
    return json({}, 401);
  });
  await assert.rejects(t.client.request("/a"), (e: ApiError) => e.kind === "http" && e.status === 401);
  assert.equal(counter.refresh, 1);
});

test("skipAuth (login): wrong password is a plain 401, no refresh, no logout", async () => {
  const counter = { refresh: 0 };
  const t = setup((url) => {
    if (url.endsWith("/auth/refresh")) counter.refresh++;
    return json({ error: { message: "Invalid credentials" } }, 401);
  });
  await assert.rejects(
    t.client.request("/auth/login", { method: "POST", json: {}, skipAuth: true }),
    (e: ApiError) => e.kind === "http" && e.message === "Invalid credentials",
  );
  assert.equal(counter.refresh, 0);
  assert.equal(t.expired(), 0);
  assert.equal((t.calls[0].init.headers as Record<string, string>).authorization, undefined);
});

test("caller-supplied Authorization is never overwritten or refreshed", async () => {
  const t = setup(() => json({}, 401));
  await kindOf(t.client.request("/a", { headers: { Authorization: "Bearer custom" } }));
  assert.equal(t.calls.length, 1);
  assert.equal((t.calls[0].init.headers as Record<string, string>).authorization, "Bearer custom");
});

// ---------- Bodies and headers ----------

test("FormData: any Content-Type is stripped so the runtime can set the boundary", async () => {
  const t = setup(() => json({ ok: 1 }));
  const form = new FormData();
  form.append("a", "b");
  await t.client.request("/up", { method: "POST", body: form, headers: { "Content-Type": "multipart/form-data" } });
  assert.equal((t.calls[0].init.headers as Record<string, string>)["content-type"], undefined);
});

test("json option sets body and Content-Type; GET without body sets no Content-Type", async () => {
  const t = setup(() => json({ ok: 1 }));
  await t.client.request("/a", { method: "POST", json: { x: 1 } });
  await t.client.request("/b");
  assert.equal(t.calls[0].init.body, '{"x":1}');
  assert.equal((t.calls[0].init.headers as Record<string, string>)["content-type"], "application/json");
  assert.equal((t.calls[1].init.headers as Record<string, string>)["content-type"], undefined);
});

test("204, empty 200 body -> null; invalid JSON on 200 -> parse error, not retried", async () => {
  const t1 = setup(() => new Response(null, { status: 204 }));
  assert.equal(await t1.client.request("/a"), null);
  const t2 = setup(() => new Response("", { status: 200, headers: { "content-type": "application/json" } }));
  assert.equal(await t2.client.request("/a"), null);
  const t3 = setup(() => new Response("<html>", { status: 200, headers: { "content-type": "application/json" } }));
  assert.equal(await kindOf(t3.client.request("/a")), "parse");
  assert.equal(t3.calls.length, 1);
});

// ---------- Rate limiter ----------

test("RateLimiter spaces requests once the burst is used", async () => {
  const rl = new RateLimiter(1, 20); // burst 1, 20/sec -> 50ms per token
  const start = Date.now();
  await rl.acquire();
  await rl.acquire();
  assert.ok(Date.now() - start >= 35);
});

test("RateLimiter wait is abortable", async () => {
  const rl = new RateLimiter(1, 0.1);
  await rl.acquire();
  const c = new AbortController();
  setTimeout(() => c.abort(), 10);
  await assert.rejects(rl.acquire(c.signal));
});

test("client wires limiter in, and cancelled limiter wait becomes 'cancelled'", async () => {
  const rl = new RateLimiter(1, 0.1);
  const t = setup(() => json({ ok: 1 }), { rateLimiter: rl });
  await t.client.request("/a");
  const c = new AbortController();
  setTimeout(() => c.abort(), 10);
  assert.equal(await kindOf(t.client.request("/b", { signal: c.signal })), "cancelled");
  assert.equal(t.calls.length, 1);
});
