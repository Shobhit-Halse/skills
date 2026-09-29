// lib/api.ts
// The only file that knows about Expo, the base URL and the session. Everything else imports apiRequest.
import { fetch as expoFetch } from "expo/fetch";
import { RateLimiter, createApiClient, type ClientEvent } from "./apiClient";
import { secureStorage } from "./secureStorage";

let sessionExpiredHandler: (() => void) | undefined;
let eventListener: ((e: ClientEvent) => void) | undefined;

/** Register in app/_layout.tsx: clear the query cache, then router.replace("/login"). */
export const setSessionExpiredHandler = (fn: () => void) => void (sessionExpiredHandler = fn);

/** Subscribe for "Retrying in N seconds…" UI and logging. Never log tokens or PII. */
export const setApiEventListener = (fn: (e: ClientEvent) => void) => void (eventListener = fn);

const client = createApiClient({
  baseUrl: process.env.EXPO_PUBLIC_API_URL!, // e.g. https://api.yourapp.com/v1
  fetch: expoFetch as unknown as typeof fetch,
  tokens: secureStorage,
  onSessionExpired: () => sessionExpiredHandler?.(),
  onEvent: (e) => eventListener?.(e),
  // Set from the API's documented quota. 60 req/min = burst 10, refill 1/s. Omit if none is documented.
  rateLimiter: new RateLimiter(10, 1),
});

export const apiRequest = client.request;
