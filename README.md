# Skills For Engineers

A curated collection of production-grade AI agent skills for software and mobile engineers, published on [skills.sh](https://skills.sh).

## Why Use This?

AI coding assistants are fast at generating initial code, but they consistently fall short on production engineering:

- **Insecure defaults & naive patterns**: Storing secrets or auth tokens in unencrypted storage, skipping idempotency on state-changing requests, and writing fragile abstractions.
- **Missing real-world failure modes**: Failing to handle rate limits (HTTP 429), unhandled network drops, thread contention, and edge-case error recovery.
- **Repetitive prompting fatigue**: Engineers spend valuable time repeatedly correcting agents on standard architectural boundaries and defensive coding requirements.

### What This Solves

This repository gives AI agents explicit, domain-specific engineering playbooks. When an agent works on a task backed by one of these skills, it adheres to:

1. **Strict architectural boundaries**: Clean separation of UI, services, and transport layers.
2. **Defensive defaults**: Automatic backoff with jitter, exact retry caps, proper cancellation, and secure storage.
3. **Real-world reliability**: Code written to survive flaky connections, bad inputs, and production traffic from day one.

---

## Install

Add all skills to your project or agent environment via [skills.sh](https://skills.sh):

```bash
npx skills@latest add Shobhit-Halse/skills
```

Or install an individual skill directly:

```bash
npx skills@latest add Shobhit-Halse/skills/skills/api-expo
npx skills@latest add Shobhit-Halse/skills/skills/design-foundations
npx skills@latest add Shobhit-Halse/skills/skills/security-expo
```

---

## Skills

- **[api-expo](./skills/api-expo/SKILL.md)** — Production-grade API integration for React Native and Expo apps. Covers `expo/fetch`, token storage with `expo-secure-store`, TanStack Query v5, rate limiting & backoff with jitter, idempotency keys, request timeouts, and NetInfo offline handling.
- **[security-expo](./skills/security-expo/SKILL.md)** — Security and crash prevention for React Native and Expo apps. Covers token security, biometric auth, deep link & push notification validation, TLS/certificate pinning, WebView isolation, Hermes & R8 release hardening, and privacy checklists.
- **[design-foundations](./skills/design-foundations/SKILL.md)** — Mobile design foundations for React Native and Expo apps. Covers typography scales (Dynamic Type/`sp`), 8pt grid & Gestalt proximity, 60-30-10 color systems, dark mode elevation, WCAG contrast, UX laws (Fitts, Hick, Miller), CTA hierarchy, and loading states.

*More skills will be added soon.*
