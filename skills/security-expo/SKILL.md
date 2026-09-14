---
name: security-expo
description: >
  Security and crash-prevention skill for React Native and Expo mobile apps.
  MUST be loaded when the task touches: auth flows, token handling, login/logout,
  session management, secure storage, API request construction, deep links,
  push notification handlers, WebViews, input validation, error handling,
  crash prevention, error boundaries, secrets, environment variables, certificate
  pinning, TLS configuration, biometric authentication, rate limiting, brute-force
  protection, dependency auditing, LLM/AI feature integration, or production
  hardening. Also load when reviewing AI-generated code that touches networking,
  storage, or auth. This skill exists because mobile clients are untrusted
  devices and the backend is the only trust boundary — do not skip loading it
  because the task "looks small". Version 1.1.0.
version: 1.2.0
---

# Security Expo (React Native + Expo)

## Overview

Every React Native app ships a decompilable binary to an untrusted device. This skill defines the non-negotiable controls that prevent credential theft, data leakage, crashes, and account takeover — and the exact techniques for implementing them in Expo.

---

## When to Use

Load this skill immediately when the task involves any of the following:

**Authentication and identity**

- "Build a login screen" / "Add sign-in with Google/Apple"
- "Store the access token" / "Handle token refresh"
- "Implement biometric unlock" / "Add Face ID"
- "Log the user out" / "Clear session"

**Data handling**

- "Save user data locally" / "Cache the profile"
- "Pass data to a WebView" / "Render HTML from the API"
- "Handle a deep link" / "Parse a push notification payload"

**Networking**

- "Call the API" / "Add certificate pinning" / "Configure TLS"
- "Handle API errors" / "Show an error message"

**AI / LLM features**

- "Add a chatbot" / "Integrate an LLM" / "Build a RAG feature"
- "Display AI-generated content" / "Render LLM markdown"

**Production readiness**

- "Prepare for App Store submission"
- "Audit the app for security"
- "The app crashes in production but not in dev"

**Design phase**

- Any new feature that accepts user input, stores data, or talks to a third party — run the threat model before writing code

**AI-generated code review**

- Any code block that touches `fetch`, `SecureStore`, `AsyncStorage`, `Linking`, `WebView`, `AuthSession`, or `expo-local-authentication`

Do **not** skip this skill because the change "is only a small UI tweak." Small changes to error handling, deep links, or WebView props are how vulnerabilities ship.

---

## Process: Threat Model First

Controls bolted on without a threat model are guesses. Before writing hardening code for any feature, spend five minutes thinking like an attacker.

**1. Map trust boundaries.** Where does untrusted data enter your system? For a React Native app this is: the API response (server could be compromised or buggy), deep-link URLs, push notification payloads, clipboard contents, QR scans, WebView `postMessage`, native module callbacks, third-party SDK events, and user-typed input. Every one of these is attacker-controlled until proven otherwise.

**2. Name the assets.** What is worth stealing or breaking? Auth tokens, refresh tokens, PII, payment data, health data, admin actions, the user's session, the integrity of locally-cached data. Anything an attacker would pay for or a breach disclosure would cover.

**3. Run STRIDE over each boundary.** It is a lens, not a ceremony:

| Threat                     | Ask                                                        | Typical mitigation (mobile)                                                                      |
| -------------------------- | ---------------------------------------------------------- | ------------------------------------------------------------------------------------------------ |
| **S**poofing               | Can someone impersonate the user or the app?               | Server-side JWT verification, App Attest / Play Integrity, biometric step-up                     |
| **T**ampering              | Can data be altered in transit, at rest, or in the binary? | TLS, cert pinning, SecureStore, R8/Hermes                                                        |
| **R**epudiation            | Can an action be denied later?                             | Server-side audit log of auth events and sensitive mutations                                     |
| **I**nformation disclosure | Can data leak?                                             | SecureStore, log redaction, screenshot blocking, no PII in crash reports                         |
| **D**enial of service      | Can it be overwhelmed or crashed?                          | Server rate limits, client rate limiter, input size caps, error boundaries, global error handler |
| **E**levation of privilege | Can a user gain rights they shouldn't?                     | Server-side authorization per resource, no client-side authz decisions                           |

**4. Write abuse cases next to use cases.** For each feature, ask "how would I misuse this if I were the attacker?" — then make that the first test you write. Example: for a "reset password by email" feature, the abuse case is "enumerate which emails are registered" and "spam reset emails to a victim." Those two cases dictate the response shape (always the same) and the rate limit (per account and per IP).

If you cannot name the trust boundaries for a feature, you are not ready to secure it. This is OWASP **A04: Insecure Design** — most breaches begin in design, not code.

---

## Core Principles

Each principle states what matters and the concrete cost of breaking it.

**1. The backend is the only trust boundary. The client is never trusted for authorization.**
Anything in the client bundle can be extracted in minutes with `apktool` or `unzip`. Hiding a UI element is not authorization. If the server accepts a request because the client said "this user is an admin," an attacker can replay that request with the same claim. Derive user identity and permissions from a verified token on the server. Cost of breaking: horizontal and vertical privilege escalation, data exposure across tenants.

**2. Input validation for security happens on the server. Client-side validation is UX only.**
OWASP is unambiguous: "Input validation must always be done on the server-side for security. While client-side validation can be useful for both functional and some security purposes it can often be easily bypassed." In React Native there is no browser — there is a decompilable binary you do not control. Validate type, length, format, and range on the server. Use client-side validation only to reduce round trips and improve UX. Cost of breaking: injection, stored XSS via the API, business-logic abuse, malformed data that crashes downstream consumers.

**3. Every boundary crossing is an untrusted input.** Deep links, push payloads, clipboard contents, QR scans, WebView `postMessage`, native module props, and data from third-party SDKs are all attacker-controlled. Validate against a strict allowlist before use. Never pass a parsed deep-link param directly into a navigation route or a native module call. Cost of breaking: deep-link hijacking, unauthorized navigation, arbitrary native-module invocation, WebView XSS.

**4. No secret ever lives in the client bundle.** API keys, client secrets, signing keys, and database credentials embedded in the app are extractable. `EXPO_PUBLIC_` variables are inlined into the client bundle at build time and are readable by anyone with the app. Cost of breaking: full third-party API access at your expense, data breach, financial loss.

**5. Crashes are a security problem, not just a UX problem.** An unhandled error that dumps a stack trace, a token, or a PII payload into logs or a crash reporter is a data leak. An app that crashes on malformed server input is a denial of service. Error boundaries catch render errors; they do **not** catch event-handler errors, async rejections, or `setTimeout` callbacks — those need a global handler and `try/catch`. Cost of breaking: PII in Sentry, users locked out of the app, store rejections.

**6. Auth tokens must be short-lived, rotated, and revoked server-side.** Access tokens live 15 minutes. Refresh tokens rotate on every use and are stored in the OS keychain — never in `AsyncStorage`. Every endpoint validates signature, issuer, audience, and expiry server-side. Cost of breaking: a single leaked token grants indefinite account access.

**7. Rate limiting and brute-force protection are server-side controls.**
The client cannot enforce them. A login endpoint without a rate limit is a credential-stuffing target. A password-reset endpoint without one is an account-enumeration oracle. Implement limits on the server, return `429` with `Retry-After`, and never leak whether an account exists. Cost of breaking: account takeover at scale, user data exposure.

**8. Dependency supply chain is part of your attack surface.** React Native apps have three dependency layers — npm packages, native modules (CocoaPods/Gradle), and platform SDKs. `npm audit` only sees layer 1. Native modules run with full app privileges and bypass `npm audit` entirely. Cost of breaking: a malicious or compromised dependency reads tokens, exfiltrates data, or injects code into production builds.

---

## Change Tiers

Not every change is equal. This is the operating rule for when to act alone, when to stop and ask, and when to refuse.

### Always Do — no approval needed

- Validate all external input on the server with a runtime schema library
- Parameterize every database query — never concatenate
- Store tokens in SecureStore, never AsyncStorage
- Set `usesCleartextTraffic: false` and validate TLS config
- Run `npm audit --audit-level=high` and `npx expo-doctor` before every release
- Wrap async boundaries in `try/catch` and install a global error handler
- Redact tokens, auth headers, and PII before any log or crash-report emission

### Ask First — stop and get human approval

- Adding or changing an authentication flow (login, MFA, biometric, social sign-in)
- Storing a new category of sensitive data (PII, payment, health, location history)
- Integrating a new third-party SDK that touches storage, networking, or identity
- Adding a WebView that loads remote content
- Adding a file upload, deep-link handler, or push-notification action
- Relaxing or removing a rate limit on any endpoint
- Changing certificate pinning configuration or TLS policy
- Granting a role, permission, or scope to a user or service
- Calling an LLM with user content in the prompt, or rendering LLM output in the UI

### Never Do — refuse and explain why

- Commit a secret to version control (rotate first, purge history second)
- Store a token in AsyncStorage or any unencrypted local store
- Log passwords, tokens, full card numbers, or raw API error bodies
- Prefix a secret with `EXPO_PUBLIC_`
- Trust client-side validation as a security boundary
- Verify a JWT with `jwt.decode()` instead of `jwt.verify()`
- Pass user content into `injectedJavaScript`, `eval`, or a native module without server-side validation
- Ship with `originWhitelist={['*']}` on a WebView that loads untrusted content
- Return different responses for "account exists" vs "account does not exist" on login or password reset

---

## Best Practices

Concrete techniques for executing each principle.

### Backend validation (Principle 2)

- Validate every field on the server with a schema library (Zod, Pydantic, Joi, class-validator). Reject with `422 Unprocessable Entity` and a structured error body.
- Do not rely on TypeScript types for runtime validation — they are erased at build time.
- For React Native, the only client-side validation that matters is formatting for UX (e.g., "email must contain @"). The server must re-validate independently.
- Never construct SQL, shell commands, or file paths from client input. Use parameterized queries and allowlists.

### Auth and tokens (Principle 6)

- Use a battle-tested identity provider (Clerk, Auth0, Supabase Auth, Firebase Auth, AWS Cognito). Roll-your-own auth reliably ages badly.
- OAuth flows must use PKCE. `expo-auth-session` enables it by default — do not disable it.
- Access token lifetime: **15 minutes**. Refresh token: rotate on every use; store the new one before discarding the old one.
- On the server, validate the JWT signature, `iss`, `aud`, `exp`, and `nbf` on every request. Never trust the payload without verifying the signature.
- Never put PII, passwords, PINs, or card numbers in a JWT payload — it is base64url-encoded, not encrypted.
- On logout: clear SecureStore, clear any in-memory token, and call the server's revocation endpoint so the refresh token cannot be reused.
- For sensitive actions (payment, identity change, health data access), require biometric step-up:
  - **UI-only vs hardware-backed authentication:** `expo-local-authentication` (`authenticateAsync`) only confirms that the current user passed the local prompt. It does **not** protect against an attacker who knows the device passcode and enrolls their own face/fingerprint in device settings.
  - **Hardware biometric key invalidation:** For cryptographic signing or accessing high-value tokens, iOS signing keys must use Secure Enclave hardware binding via `kSecAttrTokenIDSecureEnclave` alongside `kSecAccessControlBiometryCurrentSet`. Android keys must use explicit biometric-only, per-use authentication with `setUserAuthenticationParameters(0, KeyProperties.AUTH_BIOMETRIC_STRONG)`, `setInvalidatedByBiometricEnrollment(true)`, and verification of the required hardware security level (StrongBox or TEE); do not treat `setUserAuthenticationRequired(true)` alone as sufficient. When a new biometric identity is enrolled at the OS level, the operating system hardware permanently invalidates the key.

### Secrets (Principle 4)

- Only `EXPO_PUBLIC_`-prefixed variables are inlined into the client bundle. Everything else is build-time only. **Never** prefix a secret with `EXPO_PUBLIC_`.
- Use EAS Secrets (`secret` type) for values that must never leave EAS servers. Use `sensitive` for values that may be revealed locally. Use plain text only for non-sensitive config.
- For any third-party API that requires a secret key, proxy the call through your own backend. The client never holds the key.
- Run `npx expo-doctor` and an ESLint rule (`no-sensitive-public-env-var`) in CI to catch accidental `EXPO_PUBLIC_` secrets before they ship.

### Input validation at boundaries (Principle 3)

Deep links — never trust the parsed URL:

```ts
import * as Linking from "expo-linking";

const ALLOWED_ACTIONS = new Set([
  "open_profile",
  "open_order",
  "reset_password",
]);

function handleDeepLink(url: string) {
  const { path, queryParams } = Linking.parse(url);
  if (!path || !ALLOWED_ACTIONS.has(path)) {
    return; // Unknown or malformed deep link — drop it silently
  }
  const id = queryParams?.id;
  if (typeof id !== "string" || !/^[a-zA-Z0-9_-]{1,64}$/.test(id)) {
    return; // Reject malformed IDs
  }
  // Now safe to navigate
}
```

Rules:

- Allowlist route names. Never `navigate(path)` with a value from the URL.
- Regex-validate every param for type, length, and character class.
- **Anti-replay nonces and timestamps:** Any deep link triggering state changes (magic links, auth callbacks, invite redemption) must carry a single-use cryptographically random nonce (`state`) and a Unix expiration timestamp (`exp`). The backend must bind `state` to the initiating authorization or app transaction (validating the intended action, account, and redirect target) and revoke it immediately upon first receipt to prevent replay attacks from system logs or clipboard snooping. For OAuth flows, validated PKCE serves as the primary authorization code defense; require equivalent transaction binding for magic-link and invite flows.
- Never pass a deep-link param into a native module without the same validation on the native side.

### Push notification privacy and silent push

Visual push notifications (APNs / FCM alerts) are displayed on locked device screens and cached unencrypted in OS notification logs.

- **Never include raw PII, auth tokens, or sensitive account data in visual notification payloads** (e.g. "Your new password is X" or "Wire transfer of $50,000 to Account #12345").
- **Silent push as best-effort wake-up:** Treat silent push (`content-available: 1` on iOS, `data-only` messages on Android) strictly as a best-effort wake-up hint, not the sole delivery path for sensitive events. APNs and FCM throttle or drop background wakeups under battery saving, low power mode, or system resource constraints. Require server-side event persistence and foreground reconciliation on app resume. When user notification is necessary, display a generic visible alert (e.g. "You have a new secure update") that directs the user to open the app.
- **iOS Notification Service Extensions:** If a notification banner must display customized information, use a Notification Service Extension to perform on-device decryption or redaction before the notification banner renders.
- Treat `notification.data` as attacker-controlled input: validate and sanitize all payload fields before routing or executing actions.

WebView — every prop is a potential XSS vector:

- Always set `originWhitelist` to the exact origins you need. Never `['*']`.
- Never enable `javaScriptEnabled` and `injectedJavaScript` on untrusted content.
- Never pass user content into `injectedJavaScript` or `injectedJavaScriptBeforeContentLoaded`.
- Use `onShouldStartLoadWithRequest` to block unexpected navigations.
- If rendering user HTML, sanitize server-side (DOMPurify or equivalent) before it reaches the WebView.

Clipboard and QR — same class of input. Validate before acting.

### Error handling and crash prevention (Principle 5)

React Native has three distinct error channels. Handle all three:

**1. Render errors** — caught by Error Boundaries:

```tsx
class AppErrorBoundary extends React.Component<
  { children: React.ReactNode },
  { hasError: boolean }
> {
  state = { hasError: false };
  static getDerivedStateFromError() {
    return { hasError: true };
  }
  componentDidCatch(error: Error, info: React.ErrorInfo) {
    logger.error("render_crash", {
      name: error.name,
      message: error.message,
      componentStack: info.componentStack,
    });
  }
  render() {
    if (this.state.hasError)
      return (
        <FallbackScreen onRetry={() => this.setState({ hasError: false })} />
      );
    return this.props.children;
  }
}
```

**2. Event-handler and async errors** — Error Boundaries do **not** catch these. Use `try/catch` around every async boundary and a global handler for the rest:

```ts
import { ErrorUtils } from "react-native";

ErrorUtils.setGlobalHandler((error, isFatal) => {
  logger.error("unhandled", {
    name: error.name,
    message: error.message,
    isFatal,
  });
  // Do NOT rethrow in production — rethrowing crashes the app
});
```

**3. Promise rejections** — attach a handler at app startup. Unhandled rejections in Hermes will not crash the app, but they will silently swallow errors.

**Log redaction is mandatory.** A crash reporter that captures a full API error object can leak an `Authorization` header, a response body containing PII, or a token. Redact before logging:

```ts
function redact(value: unknown): unknown {
  if (typeof value !== "object" || value === null) return value;
  // Walk the object, replace values under keys like 'authorization',
  // 'token', 'password', 'secret', 'cookie' with '[REDACTED]'
  // (use a dedicated library — do not hand-roll this)
}
```

Use `babel-plugin-transform-remove-console` in production builds. `console.log` statements are readable in release builds and can expose tokens, payloads, and internal state.

### Crash-safe data access

- Never access nested API response fields without a guard. `data.user.profile.name` will crash the screen if `profile` is undefined.
- Validate API responses against a schema (Zod) at the service boundary. This turns a runtime crash into a handled error.
- Wrap native module calls in `try/catch`. Native modules can throw for reasons the JS layer cannot anticipate (permission revoked, hardware unavailable).
- For sensitive screens, disable screenshot capture with `expo-screen-capture` and clear navigation state before backgrounding if it contains PII.

### Rate limiting and brute-force protection (Principle 7)

Server-side, per endpoint:

| Endpoint               | Limit                   | Window                      | Action on exceed                                                       |
| ---------------------- | ----------------------- | --------------------------- | ---------------------------------------------------------------------- |
| Login                  | 5 attempts              | 15 min per account + per IP | `429` with `Retry-After`                                               |
| Password reset request | 3 attempts              | 1 hour per account          | `429`, always return the same response regardless of account existence |
| OTP / MFA verify       | 5 attempts              | 10 min per session          | `429`, invalidate the session                                          |
| Registration           | 3 accounts              | 1 hour per IP               | `429`                                                                  |
| Any authenticated API  | Based on business logic | —                           | `429` with `Retry-After`                                               |

Rules:

- Rate-limit on both the account identifier and the IP — either alone is bypassable.
- Never return a different response for "account exists" vs "account does not exist" on login or password reset. This is an account-enumeration oracle.
- Log rate-limit events for detection, but never log the credentials being attempted.

### Dependency supply chain (Principle 8)

Run in CI on every PR:

```bash
npm ci                              # never npm install in CI
npm audit --audit-level=high
npx expo-doctor
```

**Triaging `npm audit` results.** Not every finding is a blocker. Walk the tree:

```
Finding severity
├── Critical / High
│   ├── Reachable in production code path?
│   │   ├── YES → Fix now. Update, patch, or replace the dependency.
│   │   └── NO (dev-only dep, unreachable code) → Fix in the next release; not a blocker.
│   └── Fix available?
│       ├── YES → Update to the patched version.
│       └── NO → Look for a workaround, evaluate replacement, or allowlist with a review date.
├── Moderate
│   ├── Reachable in production? → Fix next cycle.
│   └── Dev-only? → Backlog.
└── Low → Fix during regular dependency updates.
```

Key questions to answer for each finding:

- Is the vulnerable function actually called on a code path the attacker can reach?
- Is the dependency runtime or dev-only?
- Is the vulnerability exploitable in your deployment context (e.g., a server-side CVE in a client-only package is usually not exploitable)?

When you defer a fix, document the reason and set a review date. Silent deferral is how backlogs become breaches.

Beyond `npm audit`:

- Keep lockfiles (`package-lock.json` / `yarn.lock`) in source control. Use `npm ci`, never `npm install`, in CI.
- Add Snyk or Socket for behavioral analysis — `npm audit` only catches known CVEs, not malicious packages.
- Audit native modules personally if they touch storage, networking, credentials, or the clipboard. They bypass `npm audit`.
- Check `ios/Podfile.lock` and `android/app/build.gradle` for native dependency versions separately.
- Pin native module versions. Review updates manually — do not auto-merge Dependabot PRs that touch native code.
- Be suspicious of `postinstall` scripts in unfamiliar packages — they run arbitrary code at install time.
- Watch for typosquats (`cross-env` vs `crossenv`, `react-native` vs `reactnative`).

### LLM and AI feature security

If your app has any AI feature — chatbot, summarizer, RAG, agent, image generation — it inherits a new attack surface. Map it to the [OWASP Top 10 for LLM Applications (2025)](https://genai.owasp.org/llm-top-10/).

**The client never calls an LLM provider directly.** The LLM API key is a secret (Principle 4). Route all LLM calls through your backend, which holds the key and applies rate limits, input filtering, and cost caps. A direct client-to-LLM call means anyone with your APK can burn your quota and impersonate your app.

**Treat all model output as untrusted input (LLM05).** Never render LLM output as HTML, never `eval` it, never pass it into a native module, a file path, a deep link, or a navigation route. In React Native, the specific risks are:

- Markdown renderers (`react-native-markdown-display`, etc.) — sanitize the Markdown before rendering. A crafted link can navigate to `javascript:` or a phishing URL. Restrict allowed link schemes to `https:` and `mailto:` only.
- `<Text>` is safe by default. There is no `innerHTML` in RN, so the classic DOM XSS vector does not apply — but anything that turns a string into a route, a URL, or a native call does.
- Image URLs inside LLM output — allowlist the host. An LLM can be prompted to embed `http://169.254.169.254/...` or a tracking pixel.

**Assume prompts can be hijacked (LLM01).** Untrusted text in the context window — a user message, a fetched web page, a PDF — can carry instructions. The system prompt is not a security boundary. Enforce permissions in code, not in the prompt. If your RN app sends user-controlled content (chat input, uploaded doc text, scraped page) into the LLM, that content can attempt to override the system prompt and steer the model toward attacker goals.

**Keep secrets and other users' data out of prompts (LLM02 / LLM07).** Anything in the context can be echoed back. Do not put API keys, cross-tenant data, or the full system prompt where the model can repeat it — and never log the full prompt, since it may contain PII from other users in a RAG flow.

**Constrain tool and agent permissions (LLM06).** If the LLM can call tools on behalf of the user (create order, send email, modify data), scope each tool to the minimum, require explicit confirmation for destructive or irreversible actions, and validate every tool argument server-side. Never let the model pick arbitrary tool names or arbitrary parameters.

**Bound consumption (LLM10).** Cap tokens per request, requests per user per hour, and loop/recursion depth for agentic flows. A crafted input that triggers a 50-step agent loop is a denial-of-service and a cost attack.

**Isolate retrieval data (LLM08).** In RAG, treat the vector store as a trust boundary. Partition embeddings per tenant so one user cannot retrieve another's data. Validate documents before indexing so poisoned content cannot steer answers. Sanitize retrieved chunks before they enter the prompt — a poisoned document is a prompt-injection payload.

### Network hardening (Principles 1 and 6)

- TLS 1.2 minimum, TLS 1.3 preferred. Reject cleartext traffic: set `usesCleartextTraffic: false` in `app.json` and verify no `NSAllowsArbitraryLoads` snuck into `Info.plist`.
- Certificate pinning for high-value endpoints (auth, payment, PII):
  - Pin to the SPKI hash, not the leaf certificate.
  - Ship at least one backup pin.
  - Have a documented rotation plan — a pin set without rotation will brick your app when the cert expires.
- Use `expo-network` to detect connectivity, but never trust the client's claim of being online or offline for security decisions.

### Binary hardening (resilience)

- Ship Hermes bytecode — harder to reverse than plain JS. But treat it as plaintext: Hermes bytecode is not encryption.
- Enable R8 with shrinking and obfuscation on Android release builds.
- Strip source maps from production bundles (`bundleInRelease: false`).
- `jail-monkey` for rooted/jailbroken detection: use it as a **risk signal**, not a hard block. Never rely on it for authorization.
- Apple App Attest + Google Play Integrity API to verify the app calling your backend is the real app. This is the only reliable anti-tamper control because it runs on the server.

### Privacy controls

- Maintain a data inventory: what you collect, where it is stored, how long you keep it.
- Request permissions just-in-time with context. Never request all permissions at first launch.
- Audit analytics and ad SDKs quarterly — they change data practices on their own schedule.
- Build account-delete and account-export flows that actually delete and export. Store submission and GDPR both require them.

---

## Common Rationalizations

| Excuse                                                                   | Why it is wrong                                                                                                                                                                                  |
| ------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| "It's just a small app, nobody will attack it."                          | Automated scanners find and exploit trivial vulnerabilities at scale. Attackers do not target you personally — they target patterns. A hardcoded key in a small app is still a valid key.        |
| "The client already validates the input, so the server doesn't need to." | Client validation is trivially bypassed. An attacker sends requests directly to the API with `curl`. The server must validate independently.                                                     |
| "It's just an API key for a free service, not a secret."                 | Any key is a secret if it authorizes access to your account, quota, or data. Free-tier keys are still abused to exhaust your quota and impersonate your app.                                     |
| "We'll add security before launch."                                      | Security is not a phase. Retrofitting auth, validation, and storage after launch requires migrations, session invalidation, and user disruption. Add it while the code is small.                 |
| "Threat modeling is overkill for a small feature."                       | Five minutes of "how would I attack this?" prevents the design flaws no control can patch later. Most breaches begin in design, not code (OWASP A04).                                            |
| "The token is in SecureStore, so we're safe."                            | SecureStore protects at-rest storage. It does not protect against a compromised device, a malicious native module, or a token leaked through logs or error reports. Defense in depth.            |
| "AsyncStorage is fine, the data isn't that sensitive."                   | AsyncStorage is plaintext on disk. It is readable on a rooted/jailbroken device and in device backups. If the data is a token, it grants account access. If it is PII, it is a breach.           |
| "Error boundaries catch all errors, so the app won't crash."             | Error boundaries only catch render errors. Event handlers, async rejections, and `setTimeout` callbacks bypass them entirely. Without a global handler, those crash the app.                     |
| "We log the full error object so we can debug production issues."        | Full error objects frequently contain tokens, auth headers, and PII. That data ends up in your crash reporter, where it is retained, searchable, and subject to breach disclosure. Redact first. |
| "Certificate pinning is overkill for our app."                           | Pinning is the only control that stops a MITM with a trusted CA certificate. If you handle auth or PII over public networks, the cost of not pinning is a full session compromise.               |
| "Rate limiting is the backend team's problem."                           | The mobile client is the primary abuse vector for credential stuffing and account enumeration. If the backend does not rate-limit, the client cannot compensate. Raise it as a shipping blocker. |
| "We'll add MFA later."                                                   | MFA is table stakes. Credential stuffing succeeds against password-only auth at scale. Bolting on MFA after launch requires re-enrolling every user.                                             |
| "Jailbreak detection blocks the app, so we're protected."                | Jailbreak detection runs on the device and can be patched out. It is a signal, not a security control. The server must independently verify tokens and device attestation.                       |
| "It's just LLM output, it's only text."                                  | That "text" can be a phishing link, a Markdown injection into your renderer, an image URL that hits a metadata endpoint, or a tool call that moves money. Treat it like any untrusted input.     |
| "The system prompt tells the model not to do that."                      | The system prompt is not a security boundary. Prompt injection is a known class of attack. Enforce permissions in code, not in the prompt.                                                       |
| "We'll figure out the audit findings later."                             | Silent deferral is how backlogs become breaches. Every deferred finding needs a documented reason and a review date.                                                                             |

---

## Verification

Run this checklist before every release. Each item is a shipping blocker.

### Warning signs to watch for

If any of these are true, stop and fix before proceeding:

- `console.log` of a token, request body, or error object exists anywhere in the codebase
- `AsyncStorage.setItem` is called with a key containing `token`, `auth`, `session`, `secret`, or `password`
- A `EXPO_PUBLIC_` variable name contains `SECRET`, `KEY`, `TOKEN`, or `PASSWORD`
- A deep-link handler calls `navigation.navigate` or `Linking.openURL` with a value parsed directly from the URL
- A WebView has `originWhitelist={['*']}` or `injectedJavaScript` with interpolated user content
- An API response field is accessed more than two levels deep without a guard (`data.a.b.c`)
- A login, password-reset, or OTP endpoint has no rate limit configured server-side
- A JWT is verified with `jwt.decode()` instead of `jwt.verify()`
- A crash reporter is configured to capture full request/response bodies without redaction
- `npm audit --audit-level=high` reports unresolved high or critical findings that are reachable in production
- An LLM API key is present in the client bundle, or the client calls an LLM provider directly
- LLM output is rendered through a Markdown renderer without link-scheme restrictions
- An agentic LLM tool can execute destructive actions without server-side confirmation

### Pre-ship checklist

**Design**

- [ ] Threat model written for every new feature that accepts input, stores data, or talks to a third party
- [ ] Abuse cases named next to use cases and turned into tests

**Secrets and bundle**

- [ ] No secrets in the client bundle — search for `EXPO_PUBLIC_` and confirm no secret is prefixed with it
- [ ] EAS Secrets used for all build-time secrets; `secret` type used for values that must never leave EAS
- [ ] `npx expo-doctor` passes
- [ ] `babel-plugin-transform-remove-console` is active in production builds

**Auth and tokens**

- [ ] Access tokens expire in ≤ 15 minutes
- [ ] Refresh tokens rotate on every use and are revoked server-side on logout
- [ ] JWT signature, `iss`, `aud`, `exp`, `nbf` validated server-side on every request
- [ ] No PII in JWT payloads
- [ ] OAuth flows use PKCE
- [ ] Biometric step-up required for payment, identity, and health-data actions
- [ ] High-value biometric keys bound to hardware keystore with automatic invalidation on enrollment change (`BIOMETRY_CURRENT_SET`)

**Storage**

- [ ] Tokens stored with `expo-secure-store` (or `react-native-keychain`), never `AsyncStorage`
- [ ] `keychainAccessible` set to `WHEN_UNLOCKED_THIS_DEVICE_ONLY` (or `AFTER_FIRST_UNLOCK` if background refresh is required, with the tradeoff documented)
- [ ] No PII in unencrypted local storage or logs

**Input validation**

- [ ] All server endpoints validate with a runtime schema library — not just TypeScript types
- [ ] Deep links validated against a route allowlist with regex-validated params
- [ ] Deep links triggering state or auth transitions define a maximum TTL, validate `exp` against server time (rejecting expired values), and consume single-use nonces bound to the transaction
- [ ] Push notification payloads treated as untrusted input and strictly schema-validated
- [ ] Push notifications: all payloads (including silent and data-only APNs/FCM) prohibit raw PII, containing only opaque event identifiers and non-sensitive metadata with sensitive records fetched over authenticated TLS
- [ ] WebViews have a strict `originWhitelist`, no user content in `injectedJavaScript`, and `onShouldStartLoadWithRequest` guarding navigation
- [ ] Clipboard and QR data validated before use

**Error handling**

- [ ] Error boundary wraps the navigation tree
- [ ] `ErrorUtils.setGlobalHandler` installed at app startup
- [ ] Promise rejection handler installed at app startup
- [ ] Every async boundary has `try/catch`
- [ ] Crash reporter redacts tokens, auth headers, and PII before transmission
- [ ] Nested API response access is guarded or validated by schema

**Network**

- [ ] `usesCleartextTraffic: false` confirmed in the production build
- [ ] No `NSAllowsArbitraryLoads` in `Info.plist`
- [ ] Certificate pinning configured for auth, payment, and PII endpoints, with a backup pin and a rotation plan

**Rate limiting (server-side)**

- [ ] Login limited to 5 attempts / 15 min per account + IP
- [ ] Password reset does not leak account existence
- [ ] OTP verify limited to 5 attempts / 10 min per session
- [ ] Authenticated endpoints have per-user rate limits

**Dependencies**

- [ ] `npm ci` (not `npm install`) used in CI
- [ ] `npm audit --audit-level=high` findings triaged with the decision tree — every deferred item has a documented reason and review date
- [ ] Lockfiles in source control
- [ ] Snyk or Socket configured for behavioral analysis
- [ ] Native modules touching storage, networking, or credentials reviewed manually
- [ ] `Podfile.lock` and `build.gradle` native dependency versions audited

**LLM / AI (if applicable)**

- [ ] No LLM provider key in the client bundle; all LLM calls proxied through the backend
- [ ] Model output treated as untrusted: no `eval`, no `innerHTML`-equivalent, no direct route/native-module use
- [ ] Markdown renderer restricts link schemes to `https:` and `mailto:`
- [ ] Image URLs in LLM output are host-allowlisted
- [ ] Prompt injection considered — permissions enforced in code, not in the prompt
- [ ] Agent tool permissions scoped; destructive actions require server-side confirmation
- [ ] Token, request, and loop-depth caps enforced server-side
- [ ] RAG embeddings partitioned per tenant; documents validated before indexing
- [ ] Full prompts and completions not logged with PII

**Production hardening**

- [ ] Hermes bytecode enabled
- [ ] R8 with shrinking and obfuscation enabled on Android release
- [ ] Source maps stripped from production bundles
- [ ] App Attest / Play Integrity verification active server-side
- [ ] Screenshot capture disabled on sensitive screens

**Privacy**

- [ ] Data inventory documented
- [ ] Permissions requested just-in-time with context
- [ ] Account delete and export flows implemented and tested
- [ ] Analytics and ad SDKs audited for data collection practices

---

_Every principle here is a shipping blocker. Every checklist item is verifiable. If any item cannot be checked, the release is not ready._
