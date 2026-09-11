# Skills For Engineers

[![skills.sh](https://skills.sh/b/Shobhit-Halse/skills)](https://skills.sh/Shobhit-Halse/skills)

A curated collection of production-grade AI agent skills for mobile and software engineers.

Knowing how to properly architect networking, state management, auth, and offline resilience in modern apps is hard. AI agents frequently suggest naive implementations—like storing plain auth tokens in `AsyncStorage`, infinite-looping on HTTP 429 rate limits, or failing to handle network disconnects.

These skills encode battle-tested production patterns, security standards, and defensive engineering practices so your AI agents write code that survives real-world users and mobile networks.

## Install

Add these skills to your project or agent environment:

```bash
npx skills@latest add Shobhit-Halse/skills
```

Or install an individual skill directly:

```bash
npx skills@latest add Shobhit-Halse/skills/skills/api-expo
```

---

## Skills Reference

- **[api-expo](./skills/api-expo/SKILL.md)** — Production-grade API integration for React Native and Expo apps. Covers `expo/fetch`, secure token storage with `expo-secure-store`, TanStack Query v5 server state, rate-limiting & backoff with jitter, idempotency keys, request timeouts, and NetInfo offline management.

---

## Upcoming Skills (Adding Soon)

More high-impact skills are actively being written and refined:

- **`auth-expo`** — Secure authentication flows, biometric auth (`expo-local-authentication`), session lifecycle, and OAuth/SSO handling.
- **`offline-expo`** — Offline-first architecture, SQLite / WatermelonDB synchronization, mutation queues, and conflict resolution.
- **`navigation-expo`** — Expo Router deep-linking, typed routes, modal stacks, and state restoration patterns.
- **`perf-react-native`** — Memory leak prevention, FlashList optimization, Hermes memory profiling, and frame drop diagnosis.

Stay tuned—more skills will be published regularly!
