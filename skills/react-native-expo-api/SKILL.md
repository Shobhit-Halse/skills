---
name: react-native-expo-api
description: >
  Production-grade API integration for React Native and Expo apps. Use when
  writing, reviewing, or debugging network requests, API calls, data fetching,
  auth token storage, rate limiting, retries, timeouts, offline support, or
  error handling. Covers expo/fetch, expo-secure-store, TanStack Query v5,
  NetInfo, exponential backoff with jitter, idempotency keys, and exact retry
  counts. Activate for any React Native / Expo code touching an HTTP API.
version: 1.0.1
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

async function fetchWithTimeout(
  url: string,
  options: RequestInit,
  timeoutMs: number,
  externalSignal?: AbortSignal,
): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  const onExternalAbort = () => controller.abort();
  externalSignal?.addEventListener('abort', onExternalAbort, { once: true });
  try {
    return await fetch(url, { ...options, signal: controller.signal });
  } finally {
    clearTimeout(timer);
    externalSignal?.removeEventListener('abort', onExternalAbort);
  }
}

function calculateBackoff(attempt: number): number {
  const exponential = Math.min(1000 * 2 ** attempt, 16_000);
  return Math.random() * exponential; // full jitter
}

export async function apiRequest<T>(
  endpoint: string,
  options: RequestInit = {},
  customTimeout?: number,
  externalSignal?: AbortSignal,
): Promise<T> {
  const url = `${BASE_URL}${endpoint}`;
  const timeout = customTimeout ?? DEFAULT_TIMEOUT;
  const maxAttempts = 4;

  const token = await secureStorage.getAccessToken();
  const headers = new Headers(options.headers);
  headers.set("Content-Type", "application/json");
  if (token) headers.set("Authorization", `Bearer ${token}`);

  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    try {
      const res = await fetchWithTimeout(url, { ...options, headers }, timeout, externalSignal);

      if (res.ok) {
        return res.status === 204 ? (null as T) : (res.json() as Promise<T>);
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
        if (attempt === maxAttempts - 1) {
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
        if (attempt === maxAttempts - 1) {
          throw new ApiError("Request timed out", 0, false);
        }
        await new Promise((r) => setTimeout(r, calculateBackoff(attempt)));
        continue;
      }

      if (attempt === maxAttempts - 1) {
        throw new ApiError("Network error", 0, false);
      }
      await new Promise((r) => setTimeout(r, calculateBackoff(attempt)));
    }
  }

  throw new ApiError("Unreachable", 0, false);
}
```

### 401 / token refresh

The transport throws `ApiError` on 401. Handle refresh at the application level (hook or context) to avoid circular imports:

1. Catch 401.
2. `secureStorage.getRefreshToken()`.
3. If present, call `/auth/refresh`.
4. On success: save new tokens via `secureStorage`, **retry original request once**.
5. On failure: `secureStorage.clearAll()`, navigate to login.

Never retry a 401 more than once. A second 401 after refresh means the session is dead.

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
      retry: 2, // React Query-level retry, on top of transport
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

| Status / Signal           | Retry?                | Max         | Why                            |
| ------------------------- | --------------------- | ----------- | ------------------------------ |
| 429 Too Many Requests     | Yes                   | 3–4         | Transient; honor `Retry-After` |
| 500 Internal Server Error | Yes                   | 3           | Often transient                |
| 502 Bad Gateway           | Yes                   | 3           | Upstream proxy failure         |
| 503 Service Unavailable   | Yes                   | 3           | Overloaded or restarting       |
| 504 Gateway Timeout       | Yes (idempotent only) | 2           | Origin may have processed it   |
| Network timeout / reset   | Yes                   | 2           | Request may never have arrived |
| 401 Unauthorized          | Once                  | 1 (refresh) | Only with a refresh flow       |
| 400 Bad Request           | No                    | —           | Payload is wrong               |
| 403 Forbidden             | No                    | —           | Permission issue               |
| 404 Not Found             | No                    | —           | Endpoint doesn't exist         |
| 422 Unprocessable Entity  | No                    | —           | Validation failure             |

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

---

## 10. Pre-ship checklist

**Architecture**

- [ ] All calls go through `apiClient` — no raw `fetch` in components
- [ ] TanStack Query manages all server state
- [ ] Service layer is typed

**Auth**

- [ ] Tokens in `expo-secure-store` with `AFTER_FIRST_UNLOCK`
- [ ] No secrets in the bundle
- [ ] 401 triggers exactly one refresh attempt

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

- [ ] Only 429 and 5xx retried
- [ ] 4xx (except 429) never retried
- [ ] Mutations use idempotency keys

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
