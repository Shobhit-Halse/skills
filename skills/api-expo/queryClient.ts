// lib/queryClient.ts  (TanStack Query v5)
// Not executed in the skill's test run (needs the Expo runtime). Check names against the current v5 docs.
import { AppState } from "react-native";
import NetInfo from "@react-native-community/netinfo";
import { QueryClient, focusManager, onlineManager } from "@tanstack/react-query";

// Online = connected AND not known-unreachable. isInternetReachable is null until NetInfo has probed,
// so `!== false` avoids showing "offline" on cold start.
onlineManager.setEventListener((setOnline) =>
  NetInfo.addEventListener((s) => setOnline(!!s.isConnected && s.isInternetReachable !== false)),
);

// Without this, refetchOnWindowFocus does nothing in React Native. With it, stale queries
// refetch when the app returns to the foreground.
AppState.addEventListener("change", (s) => focusManager.setFocused(s === "active"));

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 5 * 60_000,
      gcTime: 30 * 60_000, // v5 name (was cacheTime)
      // The transport already retries. Query retries multiply with it:
      // transport attempts x (1 + query retries). retry: 2 turns 4 attempts into 12 calls.
      retry: false,
      refetchOnReconnect: true,
    },
    mutations: { retry: false },
  },
});

// ---------- Patterns ----------
// features/posts/usePosts.ts
//
// export function usePosts() {
//   return useQuery({
//     queryKey: ["posts"],
//     // Pass TanStack's signal through, or unmounting will not cancel the request.
//     queryFn: ({ signal }) => apiRequest<Post[]>("/posts", { signal }),
//   });
// }
//
// features/orders/useCreateOrder.ts
// One Idempotency-Key per USER ACTION, not per call. Put it in the mutation variables so
// double-taps, retries and offline replays after an app restart all reuse the same key.
//
// export function useCreateOrder() {
//   const qc = useQueryClient();
//   return useMutation({
//     mutationKey: ["orders", "create"],
//     mutationFn: ({ order, idempotencyKey }: { order: NewOrder; idempotencyKey: string }) =>
//       apiRequest<Order>("/orders", {
//         method: "POST",
//         json: order,
//         headers: { "Idempotency-Key": idempotencyKey },
//         policy: POLICIES.payment,
//       }),
//     onSuccess: () => qc.invalidateQueries({ queryKey: ["orders"] }),
//   });
// }
//
// In the screen:
//   import * as Crypto from "expo-crypto";
//   const keyRef = useRef(Crypto.randomUUID());          // created when the form opens
//   create.mutate({ order, idempotencyKey: keyRef.current }, {
//     onSuccess: () => { keyRef.current = Crypto.randomUUID(); },   // new action, new key
//   });
//
// Logout and session expiry (register in app/_layout.tsx via setSessionExpiredHandler):
//   queryClient.clear();   // otherwise the next user briefly sees the previous user's cached data
