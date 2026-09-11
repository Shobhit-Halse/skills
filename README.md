# Skills For Engineers

A curated collection of production-grade AI agent skills for software and mobile engineers.

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

Add the skills to your project or agent environment:

```bash
npx skills@latest add Shobhit-Halse/skills
```

Or install a specific skill directly:

```bash
npx skills@latest add Shobhit-Halse/skills/skills/api-expo
```

---

## Skills

- **[api-expo](./skills/api-expo/SKILL.md)** — Production-grade API integration for React Native and Expo apps. Covers `expo/fetch`, token storage with `expo-secure-store`, TanStack Query v5, rate limiting & backoff with jitter, idempotency keys, request timeouts, and NetInfo offline handling.

*More skills will be added soon.*
