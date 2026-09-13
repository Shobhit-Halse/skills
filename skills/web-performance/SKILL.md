---
name: web-performance
description: >
  Production web performance for React and modern browsers. MUST be loaded when
  the task touches: Core Web Vitals (LCP, INP, CLS), load time reduction, bundle
  size, code splitting, lazy loading, barrel file imports, font loading and CDN
  strategy, font subsetting, image optimization (AVIF, WebP), critical CSS,
  render-blocking resources, resource hints (preload, preconnect, prefetch,
  dns-prefetch), 103 Early Hints, CDN edge caching, service workers, performance
  budgets, waterfall elimination, TTFB, or any work whose goal is a faster page.
  Also load when auditing a site for speed, setting up a performance budget, or
  reviewing build output for bundle bloat. Covers universal web performance
  principles (Core Web Vitals, budgets, caching, fonts, images, delivery). Not
  for component-level UI polish (separate web-polish skill). Not for backend API
  design. Version 1.0.0.
version: 1.0.0
---

# Web Performance (React + Modern Browsers)

## Overview

A page that works is not a page that loads fast. The difference between a site that feels instant and one that feels sluggish is almost never the framework — it is the delivery layer: what bytes ship, when they ship, how they are cached, and what blocks the first paint. This skill defines the measured targets, the budgets, and the highest-impact fixes that move real-user performance, in order of impact.

---

## When to Use

**Core Web Vitals**

- "LCP is bad" / "INP is high" / "CLS is failing"
- "Fix Core Web Vitals" / "Improve page experience"
- "Google ranking dropped"

**Load time and delivery**

- "The site loads slow" / "Reduce load time" / "TTFB is high"
- "Add a CDN" / "Set up edge caching" / "Cache-Control headers"
- "Fonts are slowing the page down" / "Google Fonts vs self-hosted"
- "Add 103 Early Hints" / "Resource hints" / "Preload the hero image"

**Bundle and JavaScript**

- "The JS bundle is too big" / "Bundle size" / "Bundle analysis"
- "Add code splitting" / "Lazy load routes" / "React.lazy"
- "Barrel file imports" / "Tree-shaking isn't working"
- "Third-party scripts are slowing us down"

**Images and media**

- "Optimize images" / "AVIF vs WebP" / "Images are too large"
- "LCP image is slow" / "Responsive images" / "srcset"

**Process and enforcement**

- "Set a performance budget" / "Enforce in CI"
- "Lighthouse score dropped" / "Catch regressions"
- "Set up performance monitoring"

**Design phase**

- Before writing any code that ships to the browser — name the budget first

Do **not** load this skill for:

- Component-level UI polish (scrollbars, focus rings, reduced motion — separate `web-polish` skill)
- Backend API design (server-side latency is a different concern)
- React Native / Expo (separate native skills)
- Bundler configuration specifics (Vite/Webpack setup — separate concern, but bundle _strategy_ belongs here)

---

## Process: Budget First, Then Fix

Before optimizing anything, answer these four questions. If you cannot answer them, you are guessing at what matters.

**1. What is the measured metric?** Open PageSpeed Insights or Chrome DevTools Performance panel. Name the specific number that is bad. "It feels slow" is not a problem statement. "LCP is 4.2s on mobile, LCP element is the hero image" is.

**2. Is the data field or lab?** Field data (CrUX, Search Console, RUM) is what Google ranks on — real users, 28-day rolling window, 75th percentile. Lab data (Lighthouse, WebPageTest) is for debugging. A site can score 100 in Lighthouse and still fail Core Web Vitals in the field. Always check field data first.

**3. Where is the time going?** TTFB (server), resource loading (network), parse/compile (CPU), or render (main thread). Each has a different fix. Do not apply a bundle fix to a TTFB problem.

**4. What is the budget?** Name the target before optimizing. LCP ≤ 2.5s, INP ≤ 200ms, CLS ≤ 0.1. Initial JS < 200KB gzipped. A budget turns optimization into a pass/fail decision.

**Recommended tooling (optional, not required):** Chrome DevTools MCP connects an AI agent to a live browser via the Model Context Protocol, letting it record and evaluate performance traces directly. Install with `npx chrome-devtools-mcp` or add it to your MCP client config. This is a suggestion for faster iteration, not a dependency — everything in this skill works without it.

---

## Core Principles

**1. Ship less JavaScript.** JavaScript is the most expensive resource on the web: it must be downloaded, parsed, compiled, and executed. A 1MB image costs network time; a 1MB script costs network time plus CPU time plus main-thread blocking. Every kilobyte of JS is a tax on INP.

**2. Eliminate waterfalls before optimizing anything else.** Sequential `await` calls and chained fetches are the #1 performance killer. Each adds full network latency. Move `await` into the branches that need it. Parallelize independent fetches with `Promise.all`. A 3-call waterfall on a 150ms RTT connection costs 450ms before any work begins.

**3. Fonts are a layout problem, not just a visual one.** A custom font that swaps in after first paint causes Cumulative Layout Shift. Self-host fonts, subset them, preload above-the-fold weights, and always set `font-display`. The shared-cache argument for Google Fonts died when browsers partitioned HTTP caches by site — self-hosting wins on both speed and privacy in 2026.

**4. Critical CSS inlined, everything else deferred.** A render-blocking stylesheet delays first paint by the full round-trip. Inline the 5–10KB of rules needed for above-the-fold content, then lazy-load the full stylesheet via `preload`. This cuts LCP by 200–500ms on a 3G connection.

**5. Images are the LCP element more often than not.** Serve AVIF with a WebP fallback, size responsively with `srcset` and `sizes`, set `width` and `height` to prevent CLS, and mark the hero image `fetchpriority="high"` and `loading="eager"`. Everything below the fold is `loading="lazy"`.

**6. Long tasks destroy INP.** Any task over 50ms blocks the main thread and delays the next paint. Break long tasks with `scheduler.yield()` or `setTimeout`. Defer non-critical JavaScript. Offload heavy work to Web Workers. 40% of sites that passed FID (the old metric) fail INP.

**7. Cache at the edge, not just the origin.** Hashed static assets get `Cache-Control: public, max-age=31536000, immutable`. HTML gets a short TTL with revalidation. Serve from CDN PoPs closest to the user. This reduces TTFB, which directly improves LCP.

**8. Budgets make performance a release policy, not a personality trait.** A budget is a set of limits enforced in CI. When a PR exceeds the budget, the build fails. Without enforcement, every "we'll optimize later" becomes permanent.

---

## Best Practices

### Core Web Vitals — Measured Targets (2026)

| Metric                              | Good    | Needs improvement | Poor    |
| ----------------------------------- | ------- | ----------------- | ------- |
| **LCP** (Largest Contentful Paint)  | ≤ 2.5s  | 2.5–4.0s          | > 4.0s  |
| **INP** (Interaction to Next Paint) | ≤ 200ms | 200–500ms         | > 500ms |
| **CLS** (Cumulative Layout Shift)   | ≤ 0.1   | 0.1–0.25          | > 0.25  |
| **FCP** (First Contentful Paint)    | ≤ 1.8s  | 1.8–3.0s          | > 3.0s  |
| **TTFB** (Time to First Byte)       | ≤ 0.8s  | 0.8–1.8s          | > 1.8s  |

Source: Google web.dev, 2026 thresholds. Google uses field data (CrUX, 75th percentile, 28-day window) for ranking — not Lighthouse lab scores.

**INP replaced FID in March 2024.** FID measured only input delay; INP measures the full interaction including processing and presentation. 43% of sites that passed FID now fail INP. The fix is different: break long tasks, not just reduce input delay.

**LCP element identification:** The LCP element is usually a hero image, a large text block, or a video poster. Find it in DevTools Performance panel → Timings → LCP. Optimize that specific element first.

**CLS sources:** Images without dimensions, font swaps, injected banners, ads, cookie consent bars, and late-loading content. Reserve space for all of them.

### Performance Budgets (2026)

| Budget item              | Green                   | Warning | Hard stop |
| ------------------------ | ----------------------- | ------- | --------- |
| Total mobile page weight | ≤ 1.5 MB                | 2.0 MB  | > 2.5 MB  |
| JavaScript transferred   | ≤ 350 KB                | 500 KB  | > 650 KB  |
| Initial JS (gzipped)     | < 200 KB                | —       | —         |
| Per-route JS (gzipped)   | < 100 KB                | —       | —         |
| Image bytes (landing)    | ≤ 600 KB                | 900 KB  | > 1.2 MB  |
| Third-party requests     | ≤ 20                    | 35      | > 50      |
| Font files               | 2 families, 4 files max | 6 files | > 8 files |
| Initial CSS (gzipped)    | < 50 KB                 | —       | —         |

**Enforce in CI:** Use Lighthouse CI, `perfgate`, or a custom script that measures bundle size and fails the build when a budget is exceeded. Track historical data to catch regressions. A budget that is not enforced is a suggestion.

**Set budgets per route, not globally.** A marketing page and a dashboard have different budgets. The marketing page should be lighter (it is the first impression); the dashboard can be heavier (the user is already committed).

### JavaScript Bundle Optimization

**Avoid barrel file imports.**

Barrel files (`index.ts` that re-exports from many modules) force bundlers to load the entire module graph even when you only use one export. This is the #1 bundle size issue in React apps.

```ts
// BAD — loads every component in the barrel, plus all 1,500+ icons
import { Button, TextField } from "@/components";
import { Check, X, Menu } from "lucide-react";

// GOOD — direct imports
import { Button } from "@/components/Button";
import { TextField } from "@/components/TextField";
import Check from "lucide-react/dist/esm/icons/check";
import X from "lucide-react/dist/esm/icons/x";
import Menu from "lucide-react/dist/esm/icons/menu";
```

Impact: 200–800ms added to startup, 2–4s added to dev server boot. Commonly affected libraries: `lucide-react`, `@mui/material`, `@mui/icons-material`, `@tabler/icons-react`, `react-icons`, `@radix-ui/react-*`, `lodash`, `date-fns`, `rxjs`.

Auto-fix: `vite-plugin-barrel` transforms barrel imports into direct imports at build time.

**Route-based code splitting.**

```tsx
import { lazy, Suspense } from "react";

const Home = lazy(() => import("./pages/Home"));
const Dashboard = lazy(() => import("./pages/Dashboard"));

function App() {
  return (
    <Suspense fallback={<PageSkeleton />}>
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/dashboard" element={<Dashboard />} />
      </Routes>
    </Suspense>
  );
}
```

Every route the user has not visited should not be in the initial bundle.

**Manual chunk splitting.** Split vendor code from app code so frequently-changing app code does not invalidate the vendor cache.

```ts
// vite.config.ts
build: {
  rollupOptions: {
    output: {
      manualChunks: {
        'vendor-react': ['react', 'react-dom'],
        'vendor-router': ['react-router-dom'],
        'vendor-data': ['@tanstack/react-query', 'axios'],
      },
    },
  },
}
```

**Lazy-load heavy components below the fold.** Recharts (~280KB), Monaco (~3MB), dnd-kit (~40KB), chart libraries, rich text editors, and map libraries are the usual culprits. Load them on demand with `React.lazy` or dynamic `import()`.

**Analyze before optimizing.** Run `npx vite-bundle-visualizer` (or `webpack-bundle-analyzer`) to see what is actually in the bundle. Do not guess — the largest module is often a transitive dependency you did not know about.

### Font Loading and CDN Strategy

**Self-host fonts. The shared-cache argument for Google Fonts is dead.**

Every major browser now partitions its HTTP cache by requesting site. A font downloaded on site A is re-downloaded on site B. The historical speed benefit no longer exists. Self-hosting wins on:

| Factor                   | Google Fonts (CDN)         | Self-hosted            |
| ------------------------ | -------------------------- | ---------------------- |
| Cross-site cache benefit | None (cache partitioned)   | N/A                    |
| Extra DNS / connections  | Yes (two Google origins)   | No                     |
| Preloadable              | Hard (URL hidden in CSS)   | Yes                    |
| Privacy / GDPR           | Sends visitor IP to Google | No third-party request |
| Subsetting control       | Limited                    | Full                   |

For EU-facing sites, self-hosting is effectively mandatory: a German court ruled that loading Google Fonts from Google's servers without consent violates GDPR.

**The font stack:**

```css
@font-face {
  font-family: "Inter";
  src: url("/fonts/inter-subset.woff2") format("woff2");
  font-display: swap;
  font-weight: 400;
  unicode-range: U+0000-00FF, U+0131, U+0152-0153, U+02BB-02BC, U+2000-206F;
}
```

- **WOFF2 only.** 30% smaller than WOFF, which is 30% smaller than TTF. All modern browsers support it.
- **`font-display: swap`** eliminates FOIT (flash of invisible text). Use `optional` + preload for the strictest CLS control on body text.
- **Preload only above-the-fold weights.**
  ```html
  <link
    rel="preload"
    href="/fonts/inter-subset.woff2"
    as="font"
    type="font/woff2"
    crossorigin
  />
  ```
- **Subset physically, then declare `unicode-range`.** Subsetting removes unused glyphs from the file (Inter drops from 303KB to 22KB). `unicode-range` tells the browser which subset file to download — it does not reduce file size on its own. Use both.
- **Limit weights.** Every weight is a separate file. 400, 500, 700 is three files. Do not load 300, 600, 800, 900 "just in case."
- **Match fallback metrics.** Use `size-adjust`, `ascent-override`, `descent-override`, and `line-gap-override` on `@font-face` to match the fallback font's metrics, reducing layout shift on swap.

### Image Optimization

**Format decision tree:**

| Content type                      | Format | Fallback |
| --------------------------------- | ------ | -------- |
| Photographic images               | AVIF   | WebP     |
| Illustrations, icons, UI elements | SVG    | —        |
| Screenshots, UI captures          | WebP   | PNG      |
| Pixel art                         | PNG    | —        |

AVIF is 20–30% smaller than WebP for photographic content and 30–50% smaller than equivalent-quality JPEG. Browser support is ~93–94% in 2026, rising. WebP is the safe universal fallback at ~97% support.

**Responsive images:**

```html
<img
  src="/hero-800.webp"
  srcset="/hero-400.avif 400w, /hero-800.avif 800w, /hero-1200.avif 1200w"
  sizes="(max-width: 600px) 400px, (max-width: 1200px) 800px, 1200px"
  width="1200"
  height="675"
  loading="eager"
  fetchpriority="high"
  alt="Hero"
/>
```

**LCP image rules:**

- `loading="eager"` — do not lazy-load the LCP element.
- `fetchpriority="high"` — tell the browser this is the most important resource.
- Preload it in `<head>` if the URL is known at build time.
- Always set `width` and `height` to prevent CLS.

**Everything below the fold:**

- `loading="lazy"` on every image, iframe, and video below the fold.
- Use `aspect-ratio` or explicit dimensions on all media containers.

**Use a CDN with image transformation.** Cloudinary, Imgix, Cloudflare Images, or Vercel Image Optimization can serve AVIF/WebP automatically, resize on the fly, and cache at the edge. This is the single highest-impact image optimization for most sites.

### Critical CSS and Render-Blocking Resources

**What blocks rendering:**

- External stylesheets in `<head>` (blocking by default)
- Synchronous `<script>` in `<head>` (blocking)
- Web fonts referenced by blocking CSS (delayed until CSS loads)

**Critical CSS:**

```html
<head>
  <style>
    /* 5–10KB of rules needed for above-the-fold content */
    .header { ... }
    .hero { ... }
    .nav { ... }
  </style>
  <link
    rel="preload"
    href="/styles/main.css"
    as="style"
    onload="this.onload=null;this.rel='stylesheet'"
  />
  <noscript><link rel="stylesheet" href="/styles/main.css" /></noscript>
</head>
```

- Inline the critical rules directly in the HTML.
- Lazy-load the full stylesheet with `rel="preload"` + `onload` swap.
- Use a tool like `penthouse` or `critical` to generate the critical CSS automatically. Update it when the page changes.

**Script loading strategy:**

| Attribute                | Behavior                                      | Use for                            |
| ------------------------ | --------------------------------------------- | ---------------------------------- |
| `<script>`               | Blocks parsing                                | Never (in `<head>`)                |
| `<script async>`         | Downloads in parallel, executes immediately   | Independent scripts (analytics)    |
| `<script defer>`         | Downloads in parallel, executes after parsing | App bundles, DOM-dependent scripts |
| `<script type="module">` | Deferred by default                           | Modern app entry points            |

**Rule:** Every script in `<head>` should be `defer`, `async`, or `type="module"`. No exceptions.

### Resource Hints

| Hint           | What it does                             | Cost                        | Use for                                                                  |
| -------------- | ---------------------------------------- | --------------------------- | ------------------------------------------------------------------------ |
| `dns-prefetch` | DNS only                                 | Trivial                     | Multiple third-party origins you will connect to                         |
| `preconnect`   | DNS + TCP + TLS                          | Socket + memory             | Critical origins (API, CDN, fonts) — max 2–4                             |
| `preload`      | High-priority fetch                      | Competes with critical path | Current-page resources discovered late (fonts, hero image, critical CSS) |
| `prefetch`     | Low-priority fetch for future navigation | Bandwidth + disk            | Next-route resources, below-fold images                                  |

```html
<link rel="preconnect" href="https://api.example.com" />
<link rel="preconnect" href="https://fonts.example.com" crossorigin />
<link
  rel="preload"
  href="/fonts/inter-subset.woff2"
  as="font"
  type="font/woff2"
  crossorigin
/>
<link rel="preload" href="/hero.avif" as="image" fetchpriority="high" />
<link rel="dns-prefetch" href="https://analytics.example.com" />
```

**Rules:**

- `preconnect` is expensive. Limit to 2–4 origins. Too many preconnects starve the critical path.
- `preload` only what is discovered late and is critical for LCP. Over-preloading delays everything else.
- `prefetch` on navigation links is useful in SPAs. Do not prefetch everything on the page — it wastes bandwidth on mobile.

### 103 Early Hints

Early Hints is an HTTP status code (103) that lets the server send `Link` headers with preload/preconnect hints before the final response. The browser starts fetching critical subresources while the server is still generating HTML.

```http
HTTP/1.1 103 Early Hints
Link: </styles/main.css>; rel=preload; as=style
Link: </fonts/inter-subset.woff2>; rel=preload; as=font; crossorigin
Link: <https://api.example.com>; rel=preconnect
```

- Supported by Chrome, Edge, Firefox, and Safari (Safari 17+).
- Shopify and Cloudflare observed LCP improvements of several hundred milliseconds to one second.
- Most impactful on landing pages where the browser has no cached resources.
- Requires server or CDN support. Cloudflare, Fastly, and Vercel support it; check your hosting provider.

### CDN and Edge Caching

**Cache-Control strategy:**

| Asset type                     | Header                                            | Rationale                                               |
| ------------------------------ | ------------------------------------------------- | ------------------------------------------------------- |
| Hashed static (JS, CSS, fonts) | `public, max-age=31536000, immutable`             | Filename changes on every build; cache forever          |
| HTML                           | `public, max-age=0, must-revalidate` or short TTL | Content changes; revalidate                             |
| API responses                  | Depends on data volatility                        | Short TTL for public data; `no-store` for user-specific |
| Images (transformed)           | `public, max-age=31536000, immutable`             | CDN serves versioned URLs                               |

**The rules:**

- **Version every static asset in the filename** (`app.a1b2c3.js`, not `app.js?v=a1b2c3`). Query-string versioning has spotty CDN support; filename versioning works everywhere.
- **Serve HTML from the edge with a short TTL.** Do not cache HTML for a year — the user will never see updates. Use `stale-while-revalidate` to serve stale HTML while fetching a fresh copy in the background.
- **Use a CDN with edge compute** (Cloudflare Workers, Vercel Edge, Fastly Compute) to personalize or A/B test at the edge without hitting the origin.
- **Purge on deploy.** When you deploy new HTML, purge the CDN cache for that route. Hashed assets do not need purging.

### Service Workers

**Cache-first for static assets:**

```js
// Workbox example
workbox.routing.registerRoute(
  ({ request }) =>
    request.destination === "script" ||
    request.destination === "style" ||
    request.destination === "font",
  new workbox.strategies.CacheFirst({
    cacheName: "static-assets",
    plugins: [
      new workbox.expiration.ExpirationPlugin({
        maxAgeSeconds: 30 * 24 * 60 * 60,
      }),
    ],
  }),
);
```

**Network-first for API and HTML:**

```js
workbox.routing.registerRoute(
  ({ request }) =>
    request.destination === "document" || request.url.includes("/api/"),
  new workbox.strategies.NetworkFirst({
    cacheName: "dynamic",
    plugins: [new workbox.expiration.ExpirationPlugin({ maxEntries: 50 })],
  }),
);
```

**Rules:**

- Use Workbox. Do not hand-roll a service worker.
- Cache-first for immutable assets (hashed filenames).
- Network-first for HTML and API, with an offline fallback.
- Version your caches. Old caches should be deleted on activation.
- Do not cache user-specific data in a shared cache.

### INP Optimization (Interaction to Next Paint)

**Find the long task.** Open DevTools Performance panel, record an interaction, look for tasks over 50ms. The longest task in the interaction is the INP bottleneck.

**The fixes, in order:**

1. **Break long tasks.** Use `scheduler.yield()` (Chrome 129+) or `setTimeout(fn, 0)` to yield to the main thread between chunks of work. The browser can then paint the next frame before continuing.
   ```js
   async function processLargeList(items) {
     for (let i = 0; i < items.length; i++) {
       processItem(items[i]);
       if (i % 50 === 0) await scheduler.yield(); // yield every 50 items
     }
   }
   ```
2. **Debounce input handlers.** A search input that filters on every keystroke runs a filter per character. Debounce to 150–300ms.
3. **Use `startTransition` for non-urgent updates.** React 18+ marks the update as interruptible. The input stays responsive while the expensive render runs in the background.
4. **Avoid layout thrashing.** Read DOM properties first, then write. Do not interleave reads and writes in a loop.
5. **Offload heavy work to a Web Worker.** Parsing, sorting, and heavy computation can run off the main thread entirely.
6. **Defer non-critical JavaScript.** Analytics, chat widgets, A/B testing scripts, and social embeds should load after the page is interactive, not during.

---

## Common Rationalizations

| Excuse                                          | Why it is wrong                                                                                                                                          |
| ----------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------- |
| "The site feels fast on my machine."            | Your machine is not the target. Test on a mid-tier Android device with a throttled network. That is where the problems are.                              |
| "Lighthouse says 100, so we're fine."           | Google ranks on field data (CrUX, 75th percentile of real users), not Lighthouse lab scores. A site can score 100 and fail Core Web Vitals in the field. |
| "We'll optimize the bundle later."              | Every sprint adds dependencies. "Later" becomes never, and the bundle grows 50KB per quarter. Enforce a budget in CI now.                                |
| "Google Fonts is faster because of the CDN."    | Browsers partitioned their HTTP caches. The shared-cache benefit no longer exists. Self-hosting is faster and avoids GDPR risk.                          |
| "One more third-party script won't hurt."       | Third-party scripts are the most common cause of INP regressions. Each one runs on the main thread, competes for bandwidth, and can block rendering.     |
| "We need `useMemo` everywhere for performance." | Memoization has overhead. Wrapping cheap work in `useMemo` is slower than recomputing it. Profile first.                                                 |
| "Images are already compressed."                | JPEG is not compressed enough. AVIF is 30–50% smaller at equivalent quality. Serve AVIF with a WebP fallback.                                            |
| "Preload everything to make it faster."         | Preloading competes for bandwidth on the critical path. Preload only what is discovered late and is critical for LCP.                                    |
| "INP is just FID with a new name."              | FID measured only input delay. INP measures the full interaction. 43% of sites that passed FID fail INP. The fix is different.                           |
| "A service worker is overkill."                 | A service worker is the only way to make repeat visits fast. Without it, every navigation refetches everything.                                          |
| "The CDN handles caching automatically."        | The CDN caches what you tell it to cache. Without correct `Cache-Control` headers, the CDN either caches nothing or caches stale content.                |
| "We'll add Early Hints later."                  | Early Hints is a server/CDN configuration, not a code change. It is a one-time setup that improves LCP on every landing page.                            |

---

## Verification

### Warning signs to watch for

- A barrel import in any file (`from '@/components'`, `from 'lucide-react'`)
- A route component imported statically in the router (no `React.lazy`)
- A font loaded from Google Fonts instead of self-hosted
- A custom font with no `font-display` property
- More than 3 font weights loaded
- More than 4 font files total
- A JPEG or PNG used for photographic content (should be AVIF/WebP)
- An image without `width` and `height` (CLS)
- The LCP image with `loading="lazy"` (should be `eager`)
- A `<script>` in `<head>` without `defer`, `async`, or `type="module"`
- No `Cache-Control` header on hashed static assets
- No service worker in a production SPA
- A task over 50ms in an event handler (INP killer)
- No performance budget in CI
- Field data (CrUX) not checked before lab data (Lighthouse)
- `preconnect` to more than 4 origins

### Pre-ship checklist

**Core Web Vitals**

- [ ] Field data (CrUX) checked; LCP ≤ 2.5s, INP ≤ 200ms, CLS ≤ 0.1
- [ ] Lab data used for debugging, not as the pass/fail gate
- [ ] LCP element identified and optimized specifically
- [ ] INP measured on a mid-tier device with real interactions

**JavaScript bundle**

- [ ] No barrel file imports (direct imports only)
- [ ] Every route code-split with `React.lazy` or dynamic `import()`
- [ ] Vendor chunks split from app code
- [ ] Bundle analyzed (`vite-bundle-visualizer` or equivalent)
- [ ] Initial JS < 200KB gzipped
- [ ] Per-route JS < 100KB gzipped
- [ ] Heavy components lazy-loaded below the fold

**Fonts**

- [ ] Self-hosted (not Google Fonts)
- [ ] WOFF2 format
- [ ] Subsetted to used characters
- [ ] `unicode-range` declared per subset
- [ ] `font-display: swap` (or `optional` + preload for body text)
- [ ] Above-the-fold font preloaded
- [ ] ≤ 3 weights, ≤ 4 files
- [ ] Fallback metrics matched with `size-adjust`

**Images**

- [ ] AVIF with WebP fallback for photographic content
- [ ] `srcset` and `sizes` on responsive images
- [ ] `width` and `height` on all images (CLS)
- [ ] LCP image: `loading="eager"`, `fetchpriority="high"`
- [ ] Below-fold images: `loading="lazy"`
- [ ] CDN image transformation configured

**CSS and rendering**

- [ ] Critical CSS inlined above the fold
- [ ] Full stylesheet lazy-loaded via `preload`
- [ ] No render-blocking stylesheets
- [ ] No synchronous scripts in `<head>`
- [ ] All scripts use `defer`, `async`, or `type="module"`

**Delivery and caching**

- [ ] Hashed static assets: `Cache-Control: public, max-age=31536000, immutable`
- [ ] HTML: short TTL with `stale-while-revalidate`
- [ ] CDN configured with edge caching
- [ ] CDN purged on deploy
- [ ] Service worker: CacheFirst for static, NetworkFirst for HTML/API
- [ ] 103 Early Hints configured (if server/CDN supports it)

**Resource hints**

- [ ] `preconnect` to ≤ 4 critical origins
- [ ] `preload` for late-discovered critical resources (fonts, hero image)
- [ ] `dns-prefetch` for non-critical third-party origins
- [ ] No over-preloading

**INP**

- [ ] No task over 50ms in event handlers
- [ ] Long tasks broken with `scheduler.yield()` or `setTimeout`
- [ ] Input handlers debounced (150–300ms)
- [ ] `startTransition` used for non-urgent updates
- [ ] No layout thrashing (read then write, not interleaved)
- [ ] Heavy work offloaded to Web Workers
- [ ] Non-critical JS deferred until after interactive

**Budgets and enforcement**

- [ ] Performance budget defined per route
- [ ] Budget enforced in CI (Lighthouse CI, `perfgate`, or custom)
- [ ] Historical performance tracked
- [ ] Regression caught before merge

**Tooling (optional)**

- [ ] Chrome DevTools MCP configured for live performance tracing (optional, recommended)

---

_Every checklist item is measurable. Every budget is enforceable. If an item cannot be checked, the page is not fast — it is merely working._
