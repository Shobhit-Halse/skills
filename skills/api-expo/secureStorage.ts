// lib/secureStorage.ts
// Tokens only. Do not store the user profile here: SecureStore is meant for small secrets
// (Expo docs recommend values under ~2 KB), and profile data belongs in the query cache.
import * as SecureStore from "expo-secure-store";
import type { TokenStore } from "./apiClient";

const ACCESS_KEY = "auth_access_token";
const REFRESH_KEY = "auth_refresh_token";

// AFTER_FIRST_UNLOCK lets iOS read the Keychain when the app wakes in the background
// (push, background fetch) while the phone is locked. The default WHEN_UNLOCKED throws
// "User interaction is not allowed" there. iOS-only option, ignored on Android.
const OPTS: SecureStore.SecureStoreOptions = {
  keychainAccessible: SecureStore.AFTER_FIRST_UNLOCK,
};

// Every request reads the access token. Hitting the native Keychain each time is slow,
// so cache it in memory. undefined = not loaded yet, null = loaded and empty.
let cachedAccess: string | null | undefined;

export const secureStorage: TokenStore = {
  async getAccessToken() {
    if (cachedAccess === undefined) cachedAccess = await SecureStore.getItemAsync(ACCESS_KEY, OPTS);
    return cachedAccess;
  },

  getRefreshToken: () => SecureStore.getItemAsync(REFRESH_KEY, OPTS),

  async saveTokens({ accessToken, refreshToken }) {
    // Refresh token first. If the app dies between the two writes, a rotated (now invalid)
    // refresh token would log the user out, while a stale access token just triggers a refresh.
    if (refreshToken) await SecureStore.setItemAsync(REFRESH_KEY, refreshToken, OPTS);
    await SecureStore.setItemAsync(ACCESS_KEY, accessToken, OPTS);
    cachedAccess = accessToken;
  },

  async clear() {
    cachedAccess = null;
    await Promise.all([
      SecureStore.deleteItemAsync(ACCESS_KEY, OPTS),
      SecureStore.deleteItemAsync(REFRESH_KEY, OPTS),
    ]);
  },
};
