---
name: design-foundations
description: >
  Mobile design foundations for React Native and Expo apps. MUST be loaded when
  the task touches: typography scales, font sizing, line height, letter spacing,
  spacing systems, 8pt grids, Gestalt proximity, visual grouping, color systems,
  60-30-10 palettes, semantic colors, dark mode elevation, WCAG contrast,
  UX laws (Fitts, Hick, Miller, Von Restorff, Jakob, Serial Position), CTA
  hierarchy, component selection (modal vs sheet vs toast), loading states, or
  any screen where hierarchy, density, or visual grouping matters. Also load
  when reviewing UI code for typography, spacing, color, or hierarchy
  correctness. Not for accessibility prop implementation (separate a11y skill).
  Not for web-only patterns (hover, cursor, scroll-jacking). Version 1.0.0.
version: 1.0.0
---

# Native Design Foundations (React Native + Expo)

## Overview

Every screen is built from four systems: typography, spacing, color, and hierarchy. Get any one wrong and the UI feels "off" — not broken, not ugly, just wrong — and users cannot articulate why. This skill defines the exact numbers, ratios, and laws that govern each system on mobile, and the rules that apply them without guesswork.

---

## When to Use

**Typography**
- "Choose font sizes" / "Build the type scale" / "The text feels too small"
- "Set line height" / "Tighten letter spacing" / "The header looks amateur"

**Spacing and grouping**
- "Fix the spacing" / "The form fields look confusing"
- "Set up the 8pt grid" / "Which elements belong together?"
- "The screen feels cluttered" / "Nothing is grouped"

**Color**
- "Choose a palette" / "Set up dark mode" / "The dark mode looks flat"
- "Semantic colors" / "The CTA doesn't stand out"

**Hierarchy and UX laws**
- "The screen feels overwhelming" / "Users aren't tapping the button"
- "Too many options" / "Where should the primary CTA go?"
- "Apply Fitts's law" / "Apply Hick's law"

**Component selection and loading**
- "Should this be a modal or a bottom sheet?"
- "Show a spinner" / "Add a skeleton" / "The screen flashes empty"

Do **not** load this skill for:
- Accessibility prop implementation (`accessibilityLabel`, VoiceOver, focus management — separate skill)
- Web/browser patterns (hover, cursor ergonomics, `:focus-visible`)
- Component library selection (Tamagui vs NativeBase vs custom)

---

## Process: Systems-First Screen Design

Before styling any screen, answer these five questions in order. If you cannot answer them, you are guessing at values.

**1. What is the type scale?** Pick the platform scale (iOS or Android) or define a modular scale. Name the body size first — it is the anchor. Everything else derives from it. Body ≥ 16px, never smaller.

**2. What is the spacing base unit?** 8px grid. Every margin, padding, and gap is a multiple of 8 (with 4px sub-steps allowed for tight inline gaps only). Name the three spacing levels before laying out.

**3. What is the color system?** One primary, one secondary, one accent. Semantic colors (error, success, warning, info) are separate. Dark mode mapped to the same scale.

**4. What is the visual hierarchy?** Name the top three elements in order of importance. The primary action wins the squint test. Everything else is secondary or hidden.

**5. Which UX law applies?** Name the cognitive constraint before choosing layout. Too many options → Hick's Law. Small target → Fitts's Law. No clear primary → Von Restorff. Everything looks the same → Gestalt similarity.

---

## Core Principles

**1. Body text is never smaller than 16px.** Smaller triggers iOS Safari auto-zoom on web and breaks layout on mobile. Body is 17pt on iOS (system default) and 16sp on Android. Anything below 15px is caption territory only.

**2. All spacing is a multiple of 4, preferably 8.** The 8pt grid is non-negotiable. Ad-hoc values (13px, 17px, 23px) create drift that compounds across screens. Half-steps of 4px are allowed only for icon-to-label gaps.

**3. More space around a group than inside it.** This is Gestalt proximity — the eye groups elements by spacing alone. If the gap between a label and its field equals the gap between fields, the eye cannot tell which label belongs to which field. Equal gaps kill grouping.

**4. The spacing ratio between levels must be at least 2×.** A 16px gap and a 20px gap read as the same gap. A 16px gap and a 32px gap read as different groups. Use 1× → 2× → 4× (8 / 16 / 32) as the default hierarchy. Below 1.5× difference, the eye reads it as the same gap.

**5. Color carries meaning, never decoration.** Semantic colors (red = error, green = success, amber = warning, blue = info) are functional only. Decorative color comes from the brand palette. Using red decoratively makes users think something is wrong.

**6. One primary action per screen, and it must win the squint test.** Filled with the accent color, largest tap target, thumb-zone placement. If the primary button does not dominate visually, the hierarchy is broken.

**7. Dark mode is not inverted colors.** Pure black (`#000000`) causes OLED smearing and removes elevation. Use `#121212` or a deeply tinted shade. Elevation comes from surface brightness (+4 to +6 lightness), not shadow. Accents desaturate −10 to −20 so they do not vibrate.

**8. Every UX law has a mobile-amplified cost.** Fitts's Law is worse on a phone (70% of taps miss targets under 44px). Hick's Law is worse (small screen, immediate decision). Miller's Law is worse (working memory plus interruption).

---

## Best Practices

### Typography — Exact Numbers

**Platform type scales.** Use the system scale unless you have a brand reason not to.

**iOS (SF Pro — use Dynamic Type, never fixed sizes):**

| Style | Size | Weight | Line Height |
|---|---|---|---|
| Large Title | 34pt | Bold | 41pt |
| Title 1 | 28pt | Bold | 34pt |
| Title 2 | 22pt | Bold | 28pt |
| Title 3 | 20pt | Semibold | 25pt |
| Headline | 17pt | Semibold | 22pt |
| Body | 17pt | Regular | 22pt |
| Callout | 16pt | Regular | 21pt |
| Subheadline | 15pt | Regular | 20pt |
| Footnote | 13pt | Regular | 18pt |
| Caption 1 | 12pt | Regular | 16pt |
| Caption 2 | 11pt | Regular | 13pt |

**Android (Material 3 — use `sp`, not `dp`, for text):**

| Role | Size | Weight | Line Height | Tracking |
|---|---|---|---|---|
| Display Large | 57sp | 400 | 64sp | −0.25 |
| Display Medium | 45sp | 400 | 52sp | 0 |
| Display Small | 36sp | 400 | 44sp | 0 |
| Headline Large | 32sp | 400 | 40sp | 0 |
| Headline Medium | 28sp | 400 | 36sp | 0 |
| Headline Small | 24sp | 400 | 32sp | 0 |
| Title Large | 22sp | 400 | 28sp | 0 |
| Title Medium | 16sp | 500 | 24sp | 0.15 |
| Title Small | 14sp | 500 | 20sp | 0.1 |
| Body Large | 16sp | 400 | 24sp | 0.5 |
| Body Medium | 14sp | 400 | 20sp | 0.25 |
| Body Small | 12sp | 400 | 16sp | 0.4 |
| Label Large | 14sp | 500 | 20sp | 0.1 |
| Label Medium | 12sp | 500 | 16sp | 0.5 |
| Label Small | 11sp | 500 | 16sp | 0.5 |

**Modular type scale (if building custom):**

| Ratio | Name | Sizes (base 16px) | Best For |
|---|---|---|---|
| 1.125 | Major Second | 13, 14, 16, 18, 20, 23 | Body-heavy, documentation |
| 1.200 | Minor Third | 11, 13, 16, 19, 23, 28 | **General purpose** |
| 1.250 | Major Third | 10, 13, 16, 20, 25, 31 | Marketing, clear hierarchy |
| 1.333 | Perfect Fourth | 9, 12, 16, 21, 28, 38 | Editorial, strong headlines |

**Typography rules:**

- **Use `sp` on Android, not `dp`.** `sp` scales with the user's font preference; `dp` does not. Users can scale from 85% to 200%.
- **Never use fixed font sizes.** Use Dynamic Type on iOS and `sp` on Android. Fixed sizes break accessibility.
- **Test at 200% font scaling.** Layouts that break need flexible containers, not fixed heights.
- **Large headers (>70px):** tighten letter spacing −2% to −3%, set line height to 110–120%. Large type at default tracking looks amateur.
- **Max 6 font sizes** on marketing screens. Dashboards cap body at ~24px for information density.
- **One sans-serif family.** A second only for a genuine editorial purpose (serif for reading-heavy screens).
- **Line height:** 1.2× for headlines, 1.4–1.6× for body text.
- **Max line length:** 40–60 characters on mobile. Wider exhausts the eye before wrapping.
- **Match icon size to line height.** 24px icon next to 24px line height.

### Spacing — The 8pt Grid

**The scale:**

| Token | Value | Use |
|---|---|---|
| `2xs` | 4px | Icon-to-label gap, tight inline spacing |
| `xs` | 8px | Between related elements in a group |
| `sm` | 12px | Between sub-groups |
| `md` | 16px | Standard content padding, between groups |
| `lg` | 24px | Between sections |
| `xl` | 32px | Between major page sections |
| `2xl` | 48px | Section separators |
| `3xl` | 64px | Page-level spacing |

**The 1:2:4 proximity ratio.** More space around a group than inside it. The default hierarchy:

| Level | Value | Example |
|---|---|---|
| Label to its own field | 8px | `Name` label → `Name` input |
| Between fields in the same group | 16px | `Name` input → `Email` input |
| Between separate groups | 32px | `Personal Info` group → `Address` group |

Think of it as 1× → 2× → 4×. This creates clear visual boundaries.

**The perception threshold.** If two gaps are less than 1.5× different, the eye reads them as the same gap. A 16px and 20px gap will not separate groups. A 16px and 32px gap will. Use 2× as the minimum ratio; 3× when you have the space.

**Spacing rules:**

- **Screen edge padding: 16px minimum, 20–24px preferred.** Text touching the edge reads as broken.
- **Section spacing: 24px or 32px.** Below 24px, sections blur together.
- **Space within groups < space between groups.** This is the proximity principle in practice.
- **Never use a spacing value that is not a multiple of 4.** 13px, 17px, 23px are drift.
- **Set the design tool's nudge to 8px** so drift is impossible during handoff.
- **Use design tokens, never hardcode pixels.** Reference `space.md`, `space.lg`, etc.
- **Maximum 3 spacing levels** between intra-group and inter-group. More than 3 levels over-segments the content.

**Proximity applies everywhere, not just forms:**

- List item title + its meta info (8px) vs between list items (16–24px)
- Heading + the section it owns (8–12px) vs between sections (32px+)
- Icon + its label (4–8px) vs between icon-label pairs (16px+)

**Practical tip:** Start with too much space, then take it away until it stops looking cramped. Easier to reduce than to guess from the start.

**Platform spacing:**

- **iOS:** Use `useSafeAreaInsets()` for notch and Dynamic Island. Defer to platform defaults where possible.
- **Android:** Material baseline grid. 8dp grid, 4dp sub-grid for fine adjustments.

### Color — Systematic Approach

**The 60-30-10 rule:**

| Proportion | Role | Example |
|---|---|---|
| 60% | Primary/background | White canvas (light), `#121212` (dark) |
| 30% | Secondary/supporting | Cards, headers, structural elements |
| 10% | Accent | Primary CTA, active states, badges |

The most successful apps use only 2–4 colors total. Adding a fifth or sixth does not make the app more interesting — it makes the brand feel inconsistent and the interface cluttered.

**Six color roles:**

| Role | Purpose |
|---|---|
| Primary | Brand identity, key CTAs, active states |
| Secondary | Supporting actions, secondary buttons, highlights |
| Accent | Emphasis, badges, floating action buttons |
| Background | Page and card backgrounds (light + dark) |
| Surface | Cards, modals, elevated elements |
| Semantic | Error (red), success (green), warning (amber), info (blue) |

**Semantic color rules:**

- **Never hardcode colors.** Use semantic tokens that adapt to light/dark mode automatically.
- **Never use semantic colors decoratively.** Red is always an error. Blue is always a link or info. Yellow is always a warning.

| Instead of | Use |
|---|---|
| `#000000` | `.primaryText` (adapts to white in dark mode) |
| `#FFFFFF` | `.systemBackground` (adapts to near-black in dark mode) |
| Hardcoded gray | `.secondaryText` or `.tertiaryText` |
| `rgba(0,0,0,0.1)` for dividers | `.separator` |

**Dark mode rules:**

1. **Never use pure black (`#000000`).** Use `#121212` or a deeply tinted shade of the accent (dark blue, dark orange). Pure black causes OLED smearing during scroll and removes elevation capability.
2. **Desaturate primary and accent colors −10 to −20.** Fully saturated colors vibrate against dark backgrounds.
3. **Elevation comes from surface brightness, not shadow.** Lighten card backgrounds +4 to +6 in lightness relative to the dark background.
4. **Map light and dark systematically.** Light mode uses palette steps 50 (background) and 500 (accent); dark mode uses 950 (background) and 300 (primary). Following a scale keeps themes in sync.
5. **Maintain the same contrast ratios as light mode.** WCAG 2.2 applies to both themes equally.

**WCAG 2.2 contrast requirements:**

| Text Type | Minimum Ratio |
|---|---|
| Normal text (< 18pt or < 14pt bold) | **4.5:1** |
| Large text (≥ 18pt or ≥ 14pt bold) | **3:1** |
| UI components and graphical objects | **3:1** against adjacent colors |

**Color psychology (for brand decisions):**

| Color | Communicates | Best For |
|---|---|---|
| Blue | Trust, stability, professionalism | Banking, healthcare, enterprise |
| Red | Urgency, attention | Error states, sale badges (use sparingly) |
| Green | Growth, success, nature | Success states, financial gain |
| Yellow/Orange | Warmth, energy, optimism | Warnings, playful brands |
| Purple | Creativity, luxury, innovation | Distinctive brands (Figma, Twitch) |
| Neutrals | Reduce cognitive load | Most productivity tools |

**Cultural note:** Color meanings are not universal. White = purity in the West, mourning in parts of East Asia. Red = luck in China, danger in the West. Research key markets if shipping globally.

### UX Laws — Applied with Mobile Examples

**Fitts's Law — time to reach a target depends on distance and size.**

> **Mobile application:** Spotify's Play button is large and centered in the bottom bar. Touch targets ≥ 44×44pt (iOS) / 48×48dp (Android). Primary CTAs go in the bottom third of the screen (thumb zone).  
> **Violation:** Small icon-only buttons in the top-right corner. 70% of taps miss targets under 44px on mobile.

**Hick's Law — decision time increases logarithmically with the number of choices.**

> **Mobile application:** Netflix starts with "Top Picks," revealing genres as you scroll. Spotify's playlist creation shows three large buttons (New, Search, Browse), not endless options.  
> **Rule:** Maximum 5–7 options per visible screen. Everything else goes behind progressive disclosure.

**Miller's Law — working memory holds 7±2 chunks.**

> **Mobile application:** Google's hamburger menu groups 20+ links into categories. A mobile bottom tab bar is capped at 5 icons (3–4 ideal).  
> **Rule:** Chunk navigation into 5–9 items. Anything more goes into accordions or categories.

**Jakob's Law — users expect your app to work like the other apps they use.**

> **Mobile application:** Instagram's bottom navigation allows swipe-up for stories, matching TikTok. Salesforce mimics Excel grids.  
> **Rule:** Use platform-standard patterns (bottom tabs, swipe-back, pull-to-refresh, long-press context menus). Deviate only with a clear, tested reason.

**Von Restorff Effect — the visually distinct item is remembered and clicked.**

> **Mobile application:** LinkedIn highlights connection requests in orange. A red "Buy Now" among blues receives 21% more clicks.  
> **Rule:** One primary CTA per screen. It must be visually distinct from everything around it (filled, accent color, larger).

**Serial Position Effect — items at the beginning and end of a list are remembered best.**

> **Mobile application:** Navigation: most important items first and last. Long landing page: CTA at hero (top) and repeated at bottom.  
> **Rule:** Put key information at the top and bottom of scrollable content.

**Gestalt — proximity, similarity, and continuity define what the eye groups.**

> **Mobile application:** Notion's database layouts use spacing and color to make relationships obvious without tutorials. Airbnb listings cluster price and review together.  
> **Rule:** Space between groups must be visibly larger than space within a group (minimum 2× ratio). Related elements share visual style.

### Component Selection — Which Interaction Layer?

| Interaction | Component | Why |
|---|---|---|
| Confirm destructive action (delete, logout with unsaved changes) | **Confirm dialog** | Requires explicit acknowledgment. Safe action (Cancel) is primary. |
| Short form or quick edit keeping context | **Bottom sheet** | Thumb-reachable. Reduced touch distance 40–60% vs centered dialog. |
| Filter, sort, share options | **Bottom sheet / action sheet** | Contextual. Dismissible with swipe. |
| Quick confirmation ("Saved", "Copied") | **Toast** | Non-blocking. Auto-dismisses. Never requires a tap. |
| Persistent status (offline, update available) | **Banner** | Persistent. Dismissible. Does not block. |
| Full-screen task (compose, checkout) | **Full-screen modal / push** | The task is the screen. |
| Detail adding context to an element | **Popover** (anchored) | Anchored. Non-blocking. Dismisses on outside tap. |
| Critical blocking error | **Blocking dialog** | Rare. Only when app cannot function without a decision. |
| Non-critical error | **Inline error** | Appears at the field or section. No modal. |

**Component rules:**

- **Bottom sheet is the mobile default for modals.** Centered dialogs are hard to reach on a 6.7" screen.
- **Confirm dialogs always have a Cancel.** Safe action is primary (Cancel/Keep), destructive is secondary (Delete/Discard).
- **Toasts never carry critical information.** If the user must read it, use a banner or inline message.
- **Never stack modals.** If a modal needs to open a modal, the flow is wrong. Use a sheet that expands.

### Loading States — Match Signal to Wait Time

| Wait time | Signal | Example |
|---|---|---|
| 0–1s | **No indicator** (press state only) | Tap feedback is enough. A flash of spinner is worse than nothing. |
| 1–2s | **Button spinner** (replace label) | Login submit, save action. |
| 2–4s | **Inline skeleton** (mirrors final shape) | List items, cards, profile sections. |
| 4–10s | **Skeleton with shimmer** or **progress bar** | Feed loading, search results. |
| 10s+ | **Background process + push notification** | Report generation, export. Do not hold the user on screen. |

**Loading rules:**

- **Skeleton beats spinner.** Users perceive a 3s skeleton wait as roughly equivalent to a 1.5s spinner wait. 30–50% perceived performance gain with no backend change.
- **Never show a full-screen spinner that blocks all interaction.** Worst loading pattern on mobile.
- **Match skeleton shape to real content.** Mismatch causes layout shift, which feels broken.
- **Disable the triggering button during async.** Prevents duplicate submissions.
- **Never show stale UI under a spinner.** If cached data exists, show it with a subtle refresh indicator.

### CTA and Hierarchy Rules

1. **One primary action per screen.** If you name two, split the screen or move one to a sheet.
2. **The primary button must win the squint test.** Filled, accent color, larger. If it does not dominate visually, hierarchy is broken.
3. **Never put two filled buttons side by side.** One filled, one ghost. Never two filled.
4. **Hide advanced and unneeded options until requested.** Progressive disclosure. Do not render disabled options for features the user has not unlocked — that is noise.
5. **If an option is not relevant to the user's current state, do not show it.** State-aware UI beats disabled UI.
6. **Secondary CTAs are ghost/outline or text links.** Tertiary actions are icon buttons or text.
7. **CTA placement: bottom third of the screen** (thumb zone). Avoid top corners for primary actions.
8. **CTA copy: verb + outcome.** "Start free trial," "Save changes," "Send message." Never "Submit" or "OK."

---

## Common Rationalizations

| Excuse | Why it is wrong |
|---|---|
| "The 13px padding looks fine." | It looks fine on this screen. It drifts on the next one. Grid discipline is what makes a suite of screens feel like one product. |
| "16px and 20px are different enough." | A 25% difference reads as the same gap. Use 2× minimum. 16px and 32px separate groups. 16px and 20px do not. |
| "The body text at 14px is readable." | On a phone at arm's length, 14px is caption territory. Body is 16–17px. iOS Safari auto-zooms on anything smaller. |
| "Dark mode is just inverted colors." | Inverted colors look broken — bright accents vibrate, shadows disappear, pure black smears on OLED. Dark mode needs its own elevation and desaturation logic. |
| "The button works, the loading state is a nice-to-have." | Silent buttons cause duplicate taps, duplicate network calls, and duplicate payments. Loading feedback is not cosmetic. |
| "I'll show a spinner, it's loading." | A full-screen spinner for a 400ms request is worse than no indicator. Match signal to duration. |
| "The user will figure out which button is primary." | If hierarchy requires thought, it is broken. The primary must win the squint test. |
| "Two filled buttons look balanced." | Balance is not the goal. Guidance is. Two equally weighted buttons force a decision the design should make for the user. |
| "I'll show the disabled state so users know the feature exists." | Disabled controls add cognitive load and communicate "you cannot do this." Hide what is not relevant yet. |
| "More colors make the app more interesting." | The highest-converting apps use 2–4 colors total. Adding colors makes the brand feel inconsistent and the interface cluttered. |
| "Hover looks good in the prototype." | React Native has no hover. Prototypes built in Figma with hover states do not translate. Use pressed. |
| "The skeleton doesn't need to match the layout." | A skeleton that does not match the final shape causes layout shift, which feels broken. |
| "Users will read the toast." | Toasts auto-dismiss in 2–3 seconds. Never put critical information there. |

---

## Verification

### Warning signs to watch for

If any of these are true, stop and fix before proceeding:

- A body text size below 16px
- A spacing value in the code that is not a multiple of 4
- Two gaps in the same screen that are 1.5× or less different (16px vs 20px)
- A label whose gap to its field equals the gap between fields
- Two filled buttons in the same row
- A centered dialog on a screen where a bottom sheet would work
- A full-screen spinner blocking all interaction
- A skeleton that does not mirror the final content shape
- Pure black (`#000000`) used as a large surface in dark mode
- More than 6 font sizes on a marketing screen
- More than 7 options in a visible list or menu
- A screen with no visible primary action
- An empty state with no CTA
- A disabled option that is not relevant to the user's current state

### Pre-ship checklist

**Typography**
- [ ] Body text ≥ 16px (iOS 17pt, Android 16sp)
- [ ] Dynamic Type / `sp` used, not fixed sizes
- [ ] Tested at 200% font scaling without layout break
- [ ] ≤ 6 font sizes on the screen
- [ ] Large headers have tightened letter spacing (−2% to −3%) and 110–120% line height
- [ ] Line height: 1.2× headlines, 1.4–1.6× body
- [ ] Max line length: 40–60 characters
- [ ] Icons match adjacent text line height

**Spacing and proximity**
- [ ] All spacing values are multiples of 4 (preferably 8)
- [ ] More space around a group than inside it
- [ ] Spacing ratio between levels is at least 2× (8 → 16 → 32)
- [ ] Label to field: 8px. Between fields: 16px. Between groups: 32px.
- [ ] Screen edge padding ≥ 16px
- [ ] Section spacing ≥ 24px
- [ ] Maximum 3 spacing levels
- [ ] Design tool nudge set to 8px

**Color**
- [ ] 60-30-10 ratio: 60% background, 30% secondary, 10% accent
- [ ] 2–4 colors total
- [ ] Semantic colors used only for function (red = error, etc.)
- [ ] Dark mode uses surface brightness for elevation, not shadow
- [ ] No pure black (`#000000`) for large surfaces
- [ ] Accents desaturated −10 to −20 in dark mode
- [ ] WCAG 2.2: 4.5:1 body text, 3:1 large text
- [ ] Light/dark themes mapped to a shared color scale

**Hierarchy and CTA**
- [ ] One primary action per screen
- [ ] Primary button wins the squint test
- [ ] No two filled buttons side by side
- [ ] Primary CTA in bottom third (thumb zone)
- [ ] CTA copy is verb + outcome, not "Submit"
- [ ] Advanced options hidden until requested
- [ ] Irrelevant options not rendered (not just disabled)

**UX laws**
- [ ] ≤ 7 visible options per screen (Hick's Law)
- [ ] Bottom tab bar ≤ 5 icons (Miller's Law)
- [ ] Touch targets ≥ 44pt iOS / 48dp Android (Fitts's Law)
- [ ] One visually distinct element per screen (Von Restorff)
- [ ] Platform-standard navigation patterns used (Jakob's Law)
- [ ] Key info at top and bottom of scrollable content (Serial Position)
- [ ] Related elements grouped, unrelated separated (Gestalt)

**Component selection and loading**
- [ ] Destructive actions use confirm dialog with safe primary (Cancel/Keep)
- [ ] Mobile modals use bottom sheet, not centered dialog
- [ ] Toasts only for non-critical confirmations
- [ ] No modal stacks another modal
- [ ] Under 1s: no indicator. 1–2s: button spinner. 2–4s: skeleton. 10s+: background.
- [ ] Skeleton matches final content shape
- [ ] Triggering button disabled during async

**States**
- [ ] Empty state points to primary action
- [ ] Search empty state offers suggestion + exit
- [ ] Error state is inline unless it blocks the screen
- [ ] Error copy is specific and actionable

---

*Every principle is verifiable on a real device. Every checklist item maps to a screen the user will touch. If an item cannot be checked, the screen is not ready to ship.*