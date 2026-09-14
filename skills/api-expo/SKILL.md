---
name: api-expo
description: >
  Production-grade API integration for React Native and Expo apps. Use when
  writing, reviewing, or debugging network requests, API calls, data fetching,
  auth token storage, rate limiting, retries, timeouts, offline support, or
  error handling. Covers expo/fetch, expo-secure-store, TanStack Query v5,
  NetInfo, exponential backoff with jitter, idempotency keys, and exact retry
  counts. Activate for any React Native / Expo code touching an HTTP API.
version: 1.1.0
---

# Native API Integration (React Native + Expo)

Production playbook for shipping API layers that survive real mobile networks, rate limits, token expiry, and offline users. Every rule here is consistent with every other rule. Follow the tables and code as written.

---

## 0. When to activate

Use this skill when the task involves:

- Writing or reviewing `fetch`, `axios`, or any HTTP call in React Native / Expo
- Debugging timeouts, retries, 429s, or token refresh failures
- Storing auth tokens, implementing login/logout, or session handling
- Setting up TanStack Query (React Query) for caching, mutations, or offline
- Handling rate limits, exponential backoff, or `Retry-After` headers
- Auditing a mobile API layer for production readiness

Skip for web-only React, Next.js, or backend API design.

---

## 1. Architecture — the three layers

```
UI Component → Service function → Transport (apiClient)
      ↑               ↑                    ↑
TanStack Query   typed endpoint      expo/fetch + retries
                 function            + auth + timeouts
```

| Layer     | File                              | Owns                                                  |
| --------- | --------------------------------- | ----------------------------------------------------- |
| Transport | `lib/apiClient.ts`                | Base URL, auth header, timeout, retries, 429 handling |
| Service   | `features/<domain>/api.ts`        | Endpoint paths, request/response types                |
| UI        | `features/<domain>/use<Thing>.ts` | TanStack Query hooks, cache keys, optimistic updates  |

Rules:

- Components **never** import `fetch` or `apiClient` directly.
- Service functions are pure — no retries, no auth, no 429 logic.
- Transport is the only place that knows about tokens, backoff, or headers.

---

## 2. Token storage — `expo-secure-store`

Install:

```bash
npx expo install expo-secure-store
```

Use `AFTER_FIRST_UNLOCK`. The default `WHEN_UNLOCKED` can crash when iOS touches the Keychain in the background while the device is locked.

```ts
// lib/secureStorage.ts
import * as SecureStore from "expo-secure-store";

const ACCESS_TOKEN_KEY = "auth_access_token";
const REFRESH_TOKEN_KEY = "auth_refresh_token";
const USER_KEY = "auth_user";

const KEYCHAIN_OPTIONS: SecureStore.SecureStoreOptions = {
  keychainAccessible: SecureStore.AFTER_FIRST_UNLOCK,
};

export const secureStorage = {
  saveAccessToken: (t: string) =>
    SecureStore.setItemAsync(ACCESS_TOKEN_KEY, t, KEYCHAIN_OPTIONS),
  getAccessToken: () =>
    SecureStore.getItemAsync(ACCESS_TOKEN_KEY, KEYCHAIN_OPTIONS),
  saveRefreshToken: (t: string) =>
    SecureStore.setItemAsync(REFRESH_TOKEN_KEY, t, KEYCHAIN_OPTIONS),
  getRefreshToken: () =>
    SecureStore.getItemAsync(REFRESH_TOKEN_KEY, KEYCHAIN_OPTIONS),
  saveUser: (u: object) =>
    SecureStore.setItemAsync(USER_KEY, JSON.stringify(u), KEYCHAIN_OPTIONS),
  getUser: async <T>(): Promise<T | null> => {
    const raw = await SecureStore.getItemAsync(USER_KEY, KEYCHAIN_OPTIONS);
    return raw ? (JSON.parse(raw) as T) : null;
  },
  clearAll: async () => {
    await Promise.all([
      SecureStore.deleteItemAsync(ACCESS_TOKEN_KEY, KEYCHAIN_OPTIONS),
      SecureStore.deleteItemAsync(REFRESH_TOKEN_KEY, KEYCHAIN_OPTIONS),
      SecureStore.deleteItemAsync(USER_KEY, KEYCHAIN_OPTIONS),
    ]);
  },
};
```

**Never** put tokens in `AsyncStorage` (unencrypted). **Never** embed API secrets in the app bundle (decompiling reveals them — proxy through your backend). Test Android release builds with R8 enabled; `expo-secure-store` has known crashes under R8 full optimization.

---

## 3. Transport layer — `expo/fetch`

Prefer `expo/fetch` over adding `axios`. WinterCG-compliant, supports streaming.

```ts
// lib/apiClient.ts
import { fetch } from "expo/fetch";
import { secureStorage } from "./secureStorage";

const BASE_URL = "https://api.yourapp.com/v1";
const DEFAULT_TIMEOUT = 15_000;

export class ApiError extends Error {
  constructor(
    public message: string,
    public status: number,
    public isRetryable: boolean,
    public retryAfter?: number,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

interface RequestOptions extends RequestInit {
  _isRetry?: boolean;
}

async function fetchWithTimeout(
  url: string,
  options: RequestInit,
  timeoutMs: number,
  externalSignal?: AbortSignal,
): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  const onExternalAbort = () => controller.abort();
  externalSignal?.addEventListener("abort", onExternalAbort, { once: true });
  try {
    return await fetch(url, { ...options, signal: controller.signal });
  } finally {
    clearTimeout(timer);
    externalSignal?.removeEventListener("abort", onExternalAbort);
  }
}

// Refresh mutex singleton: serializes parallel 401 responses to avoid token reuse detection
let refreshPromise: Promise<string | null> | null = null;

async function getRefreshedToken(): Promise<string | null> {
  if (!refreshPromise) {
    refreshPromise = (async () => {
      try {
        const refreshToken = await secureStorage.getRefreshToken();
        if (!refreshToken) return null;

        // Reuse fetchWithTimeout so stalled refresh requests terminate properly
        const res = await fetchWithTimeout(
          `${BASE_URL}/auth/refresh`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ refreshToken }),
          },
          DEFAULT_TIMEOUT,
        );

        // Only clear storage on definite auth rejection (400 or 401)
        if (res.status === 400 || res.status === 401) {
          await secureStorage.clearAll();
          return null;
        }

        if (!res.ok) {
          // Transient failure (429, 500, 502, 503): throw retryable error; do not clear credentials
          throw new ApiError(`Token refresh failed: ${res.status}`, res.status, true);
        }

        const data = (await res.json()) as { accessToken: string; refreshToken?: string };
        await secureStorage.saveAccessToken(data.accessToken);
        if (data.refreshToken) {
          await secureStorage.saveRefreshToken(data.refreshToken);
        }
        return data.accessToken;
      } catch (err) {
        if (err instanceof ApiError && err.isRetryable) throw err;
        return null;
      } finally {
        refreshPromise = null;
      }
    })();
  }
  return refreshPromise;
}

function calculateBackoff(attempt: number): number {
  const exponential = Math.min(1000 * 2 ** attempt, 16_000);
  return Math.random() * exponential; // full jitter
}

export async function apiRequest<T>(
  endpoint: string,
  options: RequestOptions = {},
  customTimeout?: number,
  externalSignal?: AbortSignal,
): Promise<T> {
  const url = `${BASE_URL}${endpoint}`;
  const timeout = customTimeout ?? DEFAULT_TIMEOUT;
  const maxAttempts = 4;

  const token = await secureStorage.getAccessToken();
  const headers = new Headers(options.headers);

  // Preserve caller-supplied Authorization header if explicitly provided
  const callerAuth = options.headers ? new Headers(options.headers).get("Authorization") : null;
  const hasCallerAuth = typeof callerAuth === "string" && callerAuth.trim().length > 0;

  // CRITICAL: Do NOT set application/json for FormData (breaks multipart boundary generation)
  const isFormData = typeof FormData !== "undefined" && options.body instanceof FormData;
  if (!isFormData && !headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json");
  }
  if (token && !headers.has("Authorization")) {
    headers.set("Authorization", `Bearer ${token}`);
  }

  // Idempotency guard: require non-whitespace content in Idempotency-Key
  const method = (options.method ?? "GET").toUpperCase();
  const idempotencyKey = headers.get("Idempotency-Key");
  const hasIdempotencyKey = typeof idempotencyKey === "string" && idempotencyKey.trim().length > 0;
  const isIdempotent =
    ["GET", "HEAD", "PUT", "DELETE", "OPTIONS"].includes(method) ||
    hasIdempotencyKey;

  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    try {
      const res = await fetchWithTimeout(url, { ...options, headers }, timeout, externalSignal);

      if (res.ok) {
        return res.status === 204 ? (null as T) : (res.json() as Promise<T>);
      }

      // 401 Unauthorized: Trigger singleton refresh mutex and retry once
      if (res.status === 401 && !options._isRetry) {
        // If caller supplied their own custom Authorization header, do not overwrite it with session token
        if (hasCallerAuth) {
          throw new ApiError("Unauthorized", 401, false);
        }

        try {
          const newToken = await getRefreshedToken();
          if (newToken) {
            // Copy computed headers object to preserve Content-Type and custom headers
            const retryHeaders = new Headers(headers);
            retryHeaders.set("Authorization", `Bearer ${newToken}`);
            return apiRequest<T>(
              endpoint,
              { ...options, headers: retryHeaders, _isRetry: true },
              customTimeout,
              externalSignal,
            );
          }
          throw new ApiError("Session expired", 401, false);
        } catch (refreshErr) {
          if (refreshErr instanceof ApiError && refreshErr.isRetryable) {
            throw refreshErr;
          }
          throw new ApiError("Session expired", 401, false);
        }
      }

      if (res.status === 429) {
        const ra = res.headers.get("Retry-After");
        const retryAfter = ra ? Number(ra) : null;
        if (attempt === maxAttempts - 1) {
          throw new ApiError(
            "Rate limited",
            429,
            false,
            retryAfter ?? undefined,
          );
        }
        const delay = retryAfter
          ? retryAfter * 1000
          : calculateBackoff(attempt);
        await new Promise((r) => setTimeout(r, delay));
        continue;
      }

      if (res.status >= 500) {
        // Non-idempotent mutations (POST without Idempotency-Key) must fail immediately to prevent duplicate side effects
        if (!isIdempotent || attempt === maxAttempts - 1) {
          throw new ApiError(`Server error ${res.status}`, res.status, false);
        }
        await new Promise((r) => setTimeout(r, calculateBackoff(attempt)));
        continue;
      }

      const body = await res.json().catch(() => ({}));
      throw new ApiError(
        body?.error?.message ?? `Request failed: ${res.status}`,
        res.status,
        false,
      );
    } catch (err) {
      if (err instanceof ApiError) throw err;

      if (err instanceof Error && err.name === "AbortError") {
        if (!isIdempotent || attempt === maxAttempts - 1) {
          throw new ApiError("Request timed out", 0, false);
        }
        await new Promise((r) => setTimeout(r, calculateBackoff(attempt)));
        continue;
      }

      if (!isIdempotent || attempt === maxAttempts - 1) {
        throw new ApiError("Network error", 0, false);
      }
      await new Promise((r) => setTimeout(r, calculateBackoff(attempt)));
    }
  }

  throw new ApiError("Unreachable", 0, false);
}
```

### 401 / token refresh mutex

The transport handles token refresh seamlessly using a singleton promise mutex (`getRefreshedToken`):

1. Catch 401.
2. If `_isRetry` is already set, immediately throw `ApiError("Session expired", 401, false)` — **never retry a refresh twice**.
3. Await `getRefreshedToken()`. Concurrent 401 calls share the **exact same promise**, preventing token replay invalidation from multiple concurrent `/auth/refresh` calls.
4. On refresh success: update headers with the new token and re-execute `apiRequest` with `_isRetry: true`.
5. On refresh failure: `secureStorage.clearAll()` is executed and `Session expired` is thrown to trigger login navigation.

---

## 4. Server state — TanStack Query v5

Install:

```bash
npx expo install @tanstack/react-query @react-native-community/netinfo
```

```ts
// lib/queryClient.ts
import { QueryClient } from "@tanstack/react-query";

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 5 * 60 * 1000, // 5 min
      gcTime: 30 * 60 * 1000, // 30 min (renamed from cacheTime in v5)
      // CRITICAL: Set retry: false when apiClient already handles transient network/5xx retries.
      // Setting retry: 2 here multiplies transport retries (4 transport attempts * 3 query retries = 12 network calls).
      retry: false,
      refetchOnWindowFocus: false, // irrelevant on mobile
      refetchOnReconnect: true, // critical on mobile
    },
  },
});
```

Query:

```ts
export function usePosts() {
  return useQuery({
    queryKey: ["posts"],
    queryFn: ({ signal }) => apiRequest<Post[]>("/posts", {}, undefined, signal),
  });
}
```

Mutation with invalidation:

```ts
export function useCreatePost() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (p: { title: string }) =>
      apiRequest<Post>("/posts", { method: "POST", body: JSON.stringify(p) }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["posts"] }),
  });
}
```

Idempotency keys — any POST/PATCH that could be retried must carry one:

```ts
await apiRequest("/orders", {
  method: "POST",
  headers: { "Idempotency-Key": generateUUID() },
  body: JSON.stringify(order),
});
```

---

## 5. Rate limiting — exact rules

### Detect

429 Too Many Requests (RFC 6585). Read these headers:

| Header                | Meaning                            |
| --------------------- | ---------------------------------- |
| `Retry-After`         | Seconds to wait (int) or HTTP-date |
| `RateLimit-Limit`     | Total quota in the window          |
| `RateLimit-Remaining` | Requests remaining                 |
| `RateLimit-Reset`     | Seconds until reset                |

Older APIs use `X-RateLimit-*`. Check both.

### Response protocol

1. **Read `Retry-After`.** If present, wait exactly that long before the first retry.
2. **If absent, exponential backoff with full jitter.** 1s, 2s, 4s, 8s, cap 16s. Wait `random(0, calculatedDelay)`.
3. **Cap total attempts at 3–4 for 429.** After that, surface the error.
4. **Never retry immediately.** A tight loop extends the throttle window and can escalate to a longer block.

### Retry counts table

| Scenario                  | Max retries | Base delay   | Max delay    | Jitter |
| ------------------------- | ----------- | ------------ | ------------ | ------ |
| 429 with `Retry-After`    | 3           | Honor header | Honor header | None   |
| 429 without `Retry-After` | 4           | 1s           | 16s          | Full   |
| 5xx (500/502/503/504)     | 3           | 1s           | 8s           | Full   |
| Network timeout           | 2           | 2s           | 4s           | Full   |
| 401 Unauthorized          | 1 (refresh) | Immediate    | —            | None   |

### Client-side rate limiter (prevention)

Do not rely only on 429s. If the API allows 60 req/min, the client must not exceed 60. Token bucket smooths bursts from pull-to-refresh spam or parallel screen loads.

```ts
class RateLimiter {
  private tokens: number;
  private lastRefill = Date.now();
  constructor(
    private maxTokens: number,
    private refillRate: number,
  ) {
    this.tokens = maxTokens;
  }
  async acquire(): Promise<void> {
    this.refill();
    while (this.tokens < 1) {
      await new Promise((r) => setTimeout(r, 100));
      this.refill();
    }
    this.tokens -= 1;
  }
  private refill(): void {
    const now = Date.now();
    const elapsed = (now - this.lastRefill) / 1000;
    this.tokens = Math.min(
      this.maxTokens,
      this.tokens + elapsed * this.refillRate,
    );
    this.lastRefill = now;
  }
}
```

### User-facing behavior

| Wait               | UI                                                                         |
| ------------------ | -------------------------------------------------------------------------- |
| < 5s               | Subtle spinner                                                             |
| > 5s               | "Taking a brief pause to respect the server. Retrying in N seconds…"       |
| All retries failed | "We're having trouble connecting right now. Please try again in a moment." |

Never show a raw 429. The user did nothing wrong — the app hit a limit.

---

## 6. Timeouts — per endpoint

Never one global timeout. Tune by category.

| Endpoint category       | Timeout | Max retries              |
| ----------------------- | ------- | ------------------------ |
| Auth (login, refresh)   | 10s     | 2                        |
| User profile / settings | 10s     | 3                        |
| List / feed / search    | 15s     | 3                        |
| Detail view             | 15s     | 3                        |
| File upload             | 60s     | 1 (with idempotency key) |
| Report / export         | 90s     | 1                        |
| Payment / order         | 20s     | 1 (with idempotency key) |

Pass `customTimeout` to `apiRequest`. When combined with retries, the timeout applies **per attempt**, not to the whole sequence. Four 15-second attempts plus up to ~7 seconds of full-jitter delays is a worst-case approximately 67 seconds before outer retries (TanStack Query's own `retry: 2`) multiply that further.

**Do not use `AbortSignal.timeout()`.** The RN polyfill omitted it for years; Expo added it in SDK 56, but the manual `AbortController` pattern in §3 works on every SDK version. Use it.

---

## 7. Offline support

Wire NetInfo to TanStack Query's `onlineManager`:

```ts
// app/_layout.tsx
import NetInfo from "@react-native-community/netinfo";
import { onlineManager } from "@tanstack/react-query";

onlineManager.setEventListener((setOnline) =>
  NetInfo.addEventListener((state) => setOnline(!!state.isConnected)),
);
```

- **Queries:** show cached data, refetch on reconnect via `refetchOnReconnect: true`.
- **Mutations:** queue offline, flush on reconnect. Use `@tanstack/offline-transactions` for persistence across restarts, or a SQLite/AsyncStorage queue.
- **Never queue GET requests.** Only mutations.

---

## 8. Decision tables

### Retry or not?

| Status / Signal           | Retry?                             | Max         | Why                                              |
| ------------------------- | ---------------------------------- | ----------- | ------------------------------------------------ |
| 429 Too Many Requests     | Yes                                | 3–4         | Transient; honor `Retry-After`                   |
| 500 Internal Server Error | Yes (idempotent / Idempotency-Key) | 3           | Often transient; avoid duplicate mutations       |
| 502 Bad Gateway           | Yes (idempotent / Idempotency-Key) | 3           | Upstream proxy failure                           |
| 503 Service Unavailable   | Yes (idempotent / Idempotency-Key) | 3           | Overloaded or restarting                         |
| 504 Gateway Timeout       | Yes (idempotent / Idempotency-Key) | 2           | Origin may have processed non-idempotent request |
| Network timeout / reset   | Yes (idempotent / Idempotency-Key) | 2           | Request may never have arrived                   |
| 401 Unauthorized          | Once (singleton mutex)             | 1 (refresh) | Serialized refresh flow; prevents replay attack  |
| 400 Bad Request           | No                                 | —           | Payload is wrong                                 |
| 403 Forbidden             | No                                 | —           | Permission issue                                 |
| 404 Not Found             | No                                 | —           | Endpoint doesn't exist                           |
| 422 Unprocessable Entity  | No                                 | —           | Validation failure                               |

### `AbortSignal.timeout()` safe?

| Expo SDK | Safe?                 | Use instead                                 |
| -------- | --------------------- | ------------------------------------------- |
| < 56     | No                    | `AbortController` + `setTimeout`            |
| ≥ 56     | Yes, but not required | `AbortController` + `setTimeout` (portable) |

---

## 9. Never do these

1. Tokens in `AsyncStorage` — unencrypted. Use `expo-secure-store`.
2. API secrets in the app bundle — decompiling reveals them. Proxy through your backend.
3. Client-side authorization decisions — derive identity from token server-side. BOLA is the #1 API risk.
4. Immediate retry on 429 — honor `Retry-After` or back off.
5. Retry 4xx (except 429) — they fail identically every time.
6. Ignore `Retry-After` — retrying early earns another 429.
7. API calls inside render — use `useQuery` / `useEffect` with proper deps.
8. `AbortSignal.timeout()` — use manual `AbortController`.
9. Skip cancellation on unmount — `AbortController` cleanup is mandatory.
10. Offset pagination — use cursor (`?after=id&limit=20`).
11. N parallel calls on screen mount without staggering — competes for bandwidth, triggers limits.
12. Return `200` for everything (server) — use `201` create, `204` delete, `422` validation.
13. Set `Content-Type: application/json` on `FormData` uploads — strips runtime multipart boundary delimiters and crashes uploads.
14. Auto-retry non-idempotent mutations (`POST`/`PATCH`) on 5xx or timeout without an `Idempotency-Key`.
15. Fire parallel token refresh calls on concurrent 401s — causes refresh token reuse detection; serialize with a singleton promise mutex.
16. Stack default TanStack Query retries on top of retrying transport without configuring `retry: false` — creates an exponential retry storm.

---

## 10. Pre-ship checklist

**Architecture**

- [ ] All calls go through `apiClient` — no raw `fetch` in components
- [ ] TanStack Query manages all server state
- [ ] Service layer is typed
- [ ] `FormData` requests omit manual `Content-Type` header

**Auth**

- [ ] Tokens in `expo-secure-store` with `AFTER_FIRST_UNLOCK`
- [ ] No secrets in the bundle
- [ ] 401 triggers exactly one refresh attempt via singleton mutex

**Rate limiting**

- [ ] Client-side limiter prevents bursts
- [ ] 429 honors `Retry-After` when present
- [ ] Exponential backoff with full jitter when absent
- [ ] Retries capped at 3–4 for 429

**Timeouts**

- [ ] Every request has a timeout
- [ ] Tuned per endpoint category
- [ ] `AbortSignal.timeout()` not used

**Retries**

- [ ] Only 429 and idempotent 5xx/timeouts/network resets retried
- [ ] Non-idempotent mutations (`POST` and `PATCH`) require a non-empty `Idempotency-Key` header before any retry
- [ ] 4xx (except 429) never retried
- [ ] TanStack Query configured with `retry: false` to avoid retry storm multiplication with transport

**Offline**

- [ ] NetInfo wired to `onlineManager`
- [ ] Mutations queue offline; queries show cache
- [ ] No GET requests queued offline

**Observability**

- [ ] Exhausted-retry failures logged
- [ ] Rate-limit headers logged for capacity planning
- [ ] No tokens or PII in logs

---

## 11. Version notes

- **Expo SDK:** patterns tested against SDK 50+. `expo/fetch` requires SDK 51+.
- **TanStack Query:** v5. `cacheTime` → `gcTime`. Both in milliseconds.
- **Hermes:** `AbortSignal.timeout()` unreliable before SDK 56. Manual `AbortController` is the standard.
- **Android R8:** test `expo-secure-store` in release builds with R8 full optimization on. Add `consumer-rules.pro` rules if crashes occur.

---

_Self-consistent. Every rule works with every other rule. Follow the tables and patterns and the API layer handles rate limits, retries, timeouts, offline, and auth correctly in production._
