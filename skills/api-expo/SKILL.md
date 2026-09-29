---
name: api-expo
description: >
  Production-grade API layer for React Native and Expo apps. Use this skill whenever
  the user writes, reviews or debugs anything that talks to an HTTP API from a
  React Native / Expo app: fetch or axios calls, auth token storage and refresh,
  login/logout, 401s, 429s and Retry-After, timeouts, retries and backoff,
  idempotency keys, cancellation on unmount, offline behavior, TanStack Query
  (v5) setup, or "why is my request slow / duplicated / retried". Also use it for
  audits of an existing mobile API layer, even if the user never says "API layer".
  Covers expo/fetch, expo-secure-store, NetInfo and TanStack Query. Skip for
  web-only React, Next.js and backend API design.
metadata:
  version: "2.0.0"
---

# API integration for React Native + Expo

A small, tested transport layer plus the rules around it. The transport code lives in `references/` and has a test suite. Copy it, do not rewrite it from memory: the hard parts (refresh races, cancellation, retry safety) are easy to get subtly wrong.

## Files

| File | Read it when |
| --- | --- |
| `references/apiClient.ts` | Building or changing the transport (retries, refresh, timeouts, limiter). No Expo imports. |
| `references/apiClient.test.ts` | Changing anything in `apiClient.ts`. Run it before and after. |
| `references/api.ts` | Wiring the client to Expo (`expo/fetch`, base URL, session-expired handler). |
| `references/secureStorage.ts` | Setting up token storage. |
| `references/queryClient.ts` | Setting up TanStack Query, NetInfo, hooks, idempotency-key pattern. |

## Workflow

1. **New project:** copy the five files into `lib/`, install deps, set `EXPO_PUBLIC_API_URL`, register the session-expired handler (see Auth).
2. **Existing project:** compare their code against the behaviors below. Report gaps by severity before rewriting anything.
3. **After any change to `apiClient.ts`:** run `npx tsx --test lib/apiClient.test.ts`. The tests encode the rules below. If a rule changes, change the test first.

```bash
npx expo install expo-secure-store expo-crypto @react-native-community/netinfo
npm i @tanstack/react-query
```

## Architecture

```
UI hook (TanStack Query)  ->  service function  ->  apiRequest (transport)
features/<domain>/use*.ts     features/<domain>/api.ts    lib/apiClient.ts
```

- Components never import `fetch` or `apiRequest`. They use hooks.
- Service functions only know paths and types. They pass `signal`, `policy` and `json` through and nothing else.
- The transport is the only place that knows tokens, retries, backoff and headers. This keeps every retry decision in one testable file.

## Policies (timeout is per attempt)

Pass `policy: POLICIES.<name>` to `apiRequest`. Default is `read`.

| Policy | Timeout | Retries (5xx, timeout, network) | Use for |
| --- | --- | --- | --- |
| `auth` | 10s | 2 | login, register |
| `profile` | 10s | 3 | user profile, settings |
| `read` | 15s | 3 | lists, feeds, search, detail |
| `upload` | 60s | 1, only with `Idempotency-Key` | file upload |
| `export` | 90s | 1 | reports, exports |
| `payment` | 20s | 1, only with `Idempotency-Key` | payments, orders |

The timeout covers the response body too, so a stalled download fails instead of hanging.
Worst case for `read`: 4 attempts x 15s + about 7s of backoff = about 67s. That is why TanStack retries are off (below).

## Retry matrix (this is exactly what the code does)

| Signal | Retried? | Count | Delay |
| --- | --- | --- | --- |
| 429 | Yes, any method (server rejected it before doing work) | 3 | `Retry-After` plus 0 to 0.5s jitter. No header: 1s, 2s, 4s (cap 16s) with equal jitter |
| 429 or 503 with `Retry-After` over 30s | No, fails fast as `rate_limited` / `http` with `retryAfterMs` | 0 | Show the wait in the UI |
| 408, 500, 502, 503, 504 | Only if the method is GET/HEAD/PUT/DELETE/OPTIONS, or an `Idempotency-Key` is present | policy | 1s base, cap 8s, equal jitter. `Retry-After` wins if present |
| Timeout, network drop | Same rule as above | policy | Same |
| 401 | Once per request, via one shared refresh. Not for `skipAuth` or caller-supplied `Authorization` | 1 refresh | none |
| Cancelled (abort) | Never | 0 | none |
| Other 4xx, parse errors | Never | 0 | none |

Equal jitter means half the delay is fixed and half is random. Full jitter can return about 0ms, which is an immediate retry and defeats the point of backing off.
`Retry-After` accepts seconds or an HTTP-date. Both are parsed.

## Errors

`apiRequest` throws `ApiError` with a `kind`. Branch on `kind`, never on message text.

| kind | Meaning | UI |
| --- | --- | --- |
| `network`, `timeout` | Connectivity | "Can't reach the server. Check your connection." plus Retry button |
| `rate_limited` | Retries ran out, or the wait was too long | "Too many requests. Try again in a moment." Use `retryAfterMs` if present. Never show a raw 429 |
| `session_expired` | Refresh token missing or rejected | Handled by the session-expired handler (go to login) |
| `http` | Non-retryable status. `status` and `body` are set | Show `error.message` for 4xx, generic message for 5xx |
| `parse` | 2xx with invalid JSON | Generic error, log it |
| `cancelled` | Caller aborted | Show nothing |

Waiting over 5s during retries: subscribe with `setApiEventListener` and show "Taking a moment, retrying in N seconds" from the `retry` event's `delayMs`.

## Auth and tokens

- Store tokens in `expo-secure-store` with `AFTER_FIRST_UNLOCK` (see `secureStorage.ts` for why). Never `AsyncStorage`.
- Never ship API secrets in the bundle. Anything in the app can be extracted. Proxy through your backend.
- Do not store the user profile in SecureStore. Keep it in the query cache.
- Login, register and other public calls must pass `skipAuth: true`. Otherwise a wrong password returns 401, triggers a refresh, and shows "Session expired".
- Parallel 401s share one refresh. A 401 that arrives after another request already refreshed reuses the new token instead of refreshing again. Both cases are tested.
- A refresh that fails because of the network, a timeout or a 5xx does **not** log the user out and does not clear tokens. Only a 400/401 from the refresh endpoint does.
- Register the handler once in `app/_layout.tsx`:

```ts
setSessionExpiredHandler(() => { queryClient.clear(); router.replace("/login"); });
```

- On manual logout, also call `secureStorage.clear()` and `queryClient.clear()`. Otherwise the next user briefly sees the previous user's cached data.
- Smoke-test login and token reads on an **Android release build** (minification on). Debug builds hide keystore and minification problems.

## Idempotency keys

- Any POST or PATCH that may be retried needs an `Idempotency-Key`. Without one, the transport will not retry it on 5xx, timeout or network errors, by design.
- Create the key once per user action, not per call: `useRef(Crypto.randomUUID())` when the form opens, rotate it after success.
- Put the key in the mutation variables so a double-tap, a retry and an offline replay after restart all send the same key.
- The transport reuses the same key across its own retries automatically.
- Whitespace-only keys do not count.

## TanStack Query v5

- Set `retry: false` for queries and mutations. The transport retries already. Stacking both multiplies calls (4 attempts x 3 = 12) and hammers a struggling server.
- Always pass `{ signal }` from `queryFn` to `apiRequest`, or unmounting will not cancel the request. Cancelled requests are never retried.
- `gcTime` replaced `cacheTime` in v5.
- `AppState` must be wired to `focusManager` for foreground refetch to work in React Native (done in `queryClient.ts`).
- Uploads: pass `FormData` as `body` and do not set `Content-Type`. The transport strips it, because the runtime must generate the multipart boundary. Test uploads on a real device. If `expo/fetch` rejects React Native style file parts (`{ uri, name, type }`) on your SDK, pass a different `fetch` to `createApiClient` for the upload client.

## Offline

- Wire NetInfo to `onlineManager` (done in `queryClient.ts`). Queries then pause offline, show cached data, and refetch on reconnect.
- Mutations pause offline by default and resume on reconnect. Do not build a second queue on top of that.
- To survive an app restart, use TanStack's persistence: `persistQueryClient` (or `PersistQueryClientProvider`), `setMutationDefaults` for each `mutationKey` so a restored mutation knows its function, and `resumePausedMutations()` after hydration. Check the current TanStack docs for exact names, this area changes.
- Persisting the cache writes server data to disk. Exclude sensitive queries with `shouldDehydrateQuery`.
- Never queue GETs. Only mutations.

## Rate limiting

- 429 handling is in the retry matrix. The client-side `RateLimiter` (token bucket) is wired into the transport and prevents bursts from pull-to-refresh spam or many parallel screen loads.
- Size it from the API's documented quota: 60 req/min is `new RateLimiter(10, 1)`. If the API documents no quota, omit it.
- Log `RateLimit-*` and `X-RateLimit-*` headers from the `rate_limit` event for capacity planning.

## Never do these

1. Tokens in `AsyncStorage`, or secrets in the bundle.
2. Authorization decisions on the client. The server derives identity from the token.
3. Retry a 4xx (except 429 and the single 401 refresh). It fails the same way every time.
4. Retry POST or PATCH on 5xx, timeout or network errors without an `Idempotency-Key`.
5. Retry on cancel, or ignore the abort signal during backoff sleeps.
6. Sleep through a huge `Retry-After`. Fail fast and tell the user.
7. Log the user out because a refresh failed on the network.
8. Refresh from several requests at once.
9. Set `Content-Type` on `FormData` bodies.
10. Call the API inside render. Use `useQuery` or an event handler.
11. Stack TanStack retries on top of transport retries.
12. Fire many identical requests on mount. Let TanStack dedupe by query key, batch on the server, or lazy-load below the fold. The rate limiter is the safety net, not the plan.

## Pre-ship checklist

**Architecture:** all calls go through `apiRequest`. No raw `fetch` in components. Service layer typed. Every public endpoint uses `skipAuth`.
**Auth:** tokens in SecureStore (`AFTER_FIRST_UNLOCK`). Session-expired handler registered. Logout clears tokens and the query cache. Login and token read verified on an Android release build.
**Retries:** `retry: false` in QueryClient. Every retried POST or PATCH carries an `Idempotency-Key` created once per user action. `signal` passed from every `queryFn`.
**Timeouts and limits:** a `policy` chosen per endpoint category. Limiter sized from the real quota. Retry UI for waits over 5s. No raw 429 shown to users.
**Offline:** NetInfo wired to `onlineManager`. Persisted mutations resume after restart if the app needs that. No queued GETs.
**Observability:** `giveup` events logged. Rate-limit headers logged. No tokens or PII in logs.
**Tests:** `apiClient.test.ts` passes.

## Version notes and things to verify

- Needs TanStack Query v5, `expo/fetch` (SDK 52 or newer, check your SDK's docs), and a TypeScript version that supports `satisfies` (4.9+).
- Reported in Expo SDK 56 tooling issues: `expo/fetch` becomes the global `fetch`. Importing it explicitly, as `api.ts` does, stays correct either way.
- `AbortSignal.timeout()` is deliberately not used. The client needs its own `AbortController` to tell a timeout from a user cancel, and that works on every SDK.
- SecureStore value size: Expo's docs recommend values under about 2 KB. If your JWT is larger, check current docs or store a shorter opaque token.
- These files were type-checked and the transport was tested under Node. `secureStorage.ts`, `api.ts` and `queryClient.ts` depend on the Expo runtime and were not executed. Run the app once before trusting them.
