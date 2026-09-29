---
name: design-foundations
description: >
  Design rules for React Native and Expo mobile UI: type scales, spacing and
  grouping, color and dark mode, contrast, UX laws (Fitts, Hick, Miller, Jakob),
  CTA hierarchy, component choice (sheet vs dialog vs toast), loading and empty
  states, and premium or minimal style. Every rule is labeled Standard, Evidence
  or Heuristic so you know what is a hard requirement and what is only a default.
  Use whenever the user builds, styles, reviews or critiques mobile screens, asks
  why a UI feels off, cluttered, cheap or hard to tap, or wants a palette, type
  scale or spacing system, even if they never say "design". Not for accessibility
  props (separate a11y skill), web hover or cursor patterns, or component
  library selection.
metadata:
  version: "2.0.0"
---

# Design foundations (React Native + Expo)

## Overview

Every screen is built from four systems: typography, spacing, color, and hierarchy. This skill gives defaults for each, and says how much weight each rule deserves. Some rules come from published specs, some from research, and some are only common practice. If an agent treats all three the same, it ends up "fixing" a good design system with an opinion.

## How to read the labels

| Label | Source | What you do |
| --- | --- | --- |
| **[Standard]** | WCAG 2.2, Apple HIG, Material 3, React Native docs | Follow it. Name the spec when you explain. Break it only if the user says so. |
| **[Evidence]** | Research or well-established models (perception, memory, motor control) | Follow by default. Say what the evidence actually covers. Never invent numbers, timings or percentages. |
| **[Heuristic]** | Designer convention, common practice, opinion | Use as a starting default when the project has no system. If the project's tokens, brand or platform pattern disagree, the project wins. Present it as a default, not a rule. |

**When rules collide:** the user's explicit request, then Standard, then the project's existing design system, then Evidence, then Heuristic.

**When reviewing UI code,** report findings in three groups: *Must fix* (Standard violations), *Should fix* (Evidence), *Consider* (Heuristic). Never present a Heuristic as a defect. Say it is a preference.

## Process: systems-first screen design

**0. Look first.** Search the repo for existing tokens or a theme (`theme.ts`, Tailwind/NativeWind config, Tamagui config, a design system package). Reuse them. Everything below is the fallback when nothing exists.

Then answer these in order. If you can't, you are guessing.

1. **Type scale:** platform scale or a modular scale. Name the body size first, it anchors everything.
2. **Spacing unit:** a 4 or 8 base. Name three spacing levels before laying out.
3. **Color system:** neutrals, one primary, optional accent, four semantic colors. Dark mode mapped to the same roles.
4. **Hierarchy:** name the top three elements in order. The primary action should win a squint test.
5. **Constraint:** name the human limit you are designing around (too many choices, small target, no clear focal point, unclear grouping) before picking a layout.

---

## Typography

**Platform scales are the source of truth. [Standard]** Use the system scale unless the brand needs otherwise.

**iOS (SF Pro, Dynamic Type, default "Large" size):**

| Style | Size | Default weight | Line height |
| --- | --- | --- | --- |
| Large Title | 34pt | Regular | 41pt |
| Title 1 | 28pt | Regular | 34pt |
| Title 2 | 22pt | Regular | 28pt |
| Title 3 | 20pt | Regular | 25pt |
| Headline | 17pt | Semibold | 22pt |
| Body | 17pt | Regular | 22pt |
| Callout | 16pt | Regular | 21pt |
| Subheadline | 15pt | Regular | 20pt |
| Footnote | 13pt | Regular | 18pt |
| Caption 1 | 12pt | Regular | 16pt |
| Caption 2 | 11pt | Regular | 13pt |

Weights above are the system defaults. Apple's "emphasized" variants are Bold for Large Title, Title 1 and Title 2, and Semibold for Title 3 and below. Don't hard-code Bold on every title.

**Android (Material 3):**

| Role | Size | Weight | Line height | Tracking |
| --- | --- | --- | --- | --- |
| Display Large | 57 | 400 | 64 | -0.25 |
| Display Medium | 45 | 400 | 52 | 0 |
| Display Small | 36 | 400 | 44 | 0 |
| Headline Large | 32 | 400 | 40 | 0 |
| Headline Medium | 28 | 400 | 36 | 0 |
| Headline Small | 24 | 400 | 32 | 0 |
| Title Large | 22 | 400 | 28 | 0 |
| Title Medium | 16 | 500 | 24 | 0.15 |
| Title Small | 14 | 500 | 20 | 0.1 |
| Body Large | 16 | 400 | 24 | 0.5 |
| Body Medium | 14 | 400 | 20 | 0.25 |
| Body Small | 12 | 400 | 16 | 0.4 |
| Label Large | 14 | 500 | 20 | 0.1 |
| Label Medium | 12 | 500 | 16 | 0.5 |
| Label Small | 11 | 500 | 16 | 0.5 |

React Native takes plain numbers for `fontSize`, `lineHeight` and `letterSpacing`. There are no `sp` or `dp` strings.

**Custom modular scale (base 16):** Major Second 1.125 gives 13, 14, 16, 18, 20, 23 (dense, document-like). Minor Third 1.2 gives 11, 13, 16, 19, 23, 28 (general purpose). Major Third 1.25 gives 13, 16, 20, 25, 31. Perfect Fourth 1.333 gives 12, 16, 21, 28, 38 (editorial). Ignore any step below 11. No platform style goes that low. **[Heuristic]** on which ratio fits which product.

**Rules**

- **[Standard]** Let text scale. Keep `allowFontScaling` on (default), and cap with `maxFontSizeMultiplier` (around 1.5 to 2) only where a layout truly can't grow. WCAG 1.4.4 expects text to resize to 200% without loss of content. iOS Dynamic Type reaches React Native automatically, so don't hard-code point sizes.
- **[Standard]** No fixed `height` on containers that hold text. Use `minHeight` plus padding, or fixed heights truncate at large text sizes. Test at the largest OS text size.
- **[Heuristic]** Reading-length body text: 16 or larger (iOS Body 17, Material Body Large 16). Smaller styles (Footnote, Caption, Body Small) are for metadata and dense secondary text. Material's own Body Medium is 14, so this is a preference for long-form reading, not a platform rule.
- **[Heuristic]** Line height: use the platform table for UI text. For long-form reading, 1.4 to 1.6x. (iOS Body is about 1.29x and that is fine for UI.) WCAG 1.4.12 only requires that layouts survive 1.5x, not that you use it.
- **[Heuristic]** Large custom-font headlines look better tightened, about -2% to -3% tracking and 110% to 120% line height. React Native `letterSpacing` is in points, so for a 40pt headline use about -0.8 to -1.2. System fonts already adjust tracking by size, so this applies to custom fonts.
- **[Heuristic]** One sans family, a second only for a real editorial reason. No more than about 6 distinct sizes on a screen.
- **[Heuristic]** Line length 40 to 60 characters. On phones this mostly happens by itself. It matters on tablets and wide layouts.
- **[Heuristic]** Match icon size to the adjacent line height (24 icon beside 24 line height).
- Style for visual hierarchy, mark up for semantics. In React Native the semantic part is `accessibilityRole="header"`. A screen title can look small and muted if the balance number is what matters.

---

## Spacing

**One system, no contradictions:**

- **[Heuristic]** Every spacing value is a multiple of 4, preferably 8. The benefit is consistency and fast handoff, not perception. If the project already uses another scale, follow it.
- **[Heuristic]** Allowed palette: 4, 8, 16, 24, 32, 48, 64. Use design tokens (`space.sm`), not raw numbers.
- **[Evidence]** Proximity is a strong grouping cue (Gestalt). Elements closer together read as related. More space around a group than inside it.
- **[Heuristic]** Adjacent spacing levels should differ by at least about 2x, or the eye reads them as the same gap. Default: 8 (label to field), 16 (between fields), 32 (between groups). Dense lists can shift down: 4, 8, 16. The 2x figure is a working rule, not a measured threshold.
- **[Heuristic]** The 2x rule applies to *adjacent levels*, so 16 and 24 can both exist in your tokens as long as they are not neighboring levels on the same screen. Use at most 3 levels in one region.
- **[Heuristic]** Group with whitespace before adding borders or dividers. Proximity usually beats similarity as a grouping cue, but not always, so check the result.
- **[Heuristic]** Screen edge padding 16 minimum (Material's compact margin is 16dp), 20 to 24 for a roomier feel. Sections need enough space to separate: 24 minimum, and 32 when fields inside are 16 apart.
- **[Standard]** Use logical properties for RTL: `marginStart`, `marginEnd`, `paddingStart`, `paddingEnd`. Avoid `marginLeft` and `right` for layout that should mirror.
- **[Standard]** Use `useSafeAreaInsets()` for notches and the home indicator. When the keyboard is open, its height replaces the bottom inset, it doesn't add to it.
- **[Heuristic]** `KeyboardAvoidingView` is inconsistent across OS versions. `react-native-keyboard-controller` is the usual upgrade for forms. `keyboardShouldPersistTaps="handled"` is typically what you want on form scroll views.
- **[Heuristic]** Start with too much space and remove until it stops looking loose.

---

## Color

**Generating ramps**

- **[Heuristic]** HSL is fine for simple tint and shade ramps: vary Lightness, and Saturation a little. Keep hue within about 10 degrees across a ramp, since big hue jumps break the brand color. Small warm or cool shifts are a normal technique, not an error.
- **[Evidence]** HSL lightness is not perceptually uniform: yellow at L50 looks much lighter than blue at L50, so equal L steps do not give equal contrast. For ramps where contrast must be predictable, use OKLCH or Material's HCT and verify with a contrast checker.
- Don't build tints in HSB/HSV. Raising "Brightness" doesn't wash a color toward white.

**Proportions and roles**

- **[Heuristic]** 60-30-10 is a proportion guide borrowed from interior design, not a UI study. Read it as: about 60% neutral background, about 30% surfaces and structure, about 10% primary or accent color (main CTA, active states).
- **[Heuristic]** Keep the brand palette small: primary, an optional accent, and neutrals cover most apps. There is no research behind an exact count. More brand colors mostly means more inconsistency to maintain.
- Roles: Primary, Secondary, Accent, Background, Surface, Semantic (error, success, warning, info). Semantic colors are separate from the brand palette.
- **[Heuristic]** Semantic conventions: red for error and destructive, green for success, amber for warning, blue for info. Don't use them decoratively. If a brand color is close to one, differentiate by shade or icon.
- **[Standard]** Never rely on color alone for meaning (WCAG 1.4.1). Pair error red with an icon or text.
- **[Standard]** Use theme tokens, not hard-coded hex. Resolve them from `useColorScheme()`. On iOS, `PlatformColor('label')`, `PlatformColor('systemBackground')` and `PlatformColor('separator')` follow the system. Names like `.primaryText` or `.systemBackground` are Swift, not React Native.

**Interaction states**

- **[Heuristic]** Pressed: slightly darker or lower opacity. Disabled: reduced emphasis. Hover does not apply on touch screens.
- **[Standard]** Material 3 disabled state uses about 38% opacity for content. iOS dims with opacity.

**Dark mode**

- **[Standard]** Follow the platform. iOS dark mode uses a true black base with slightly lighter elevated surfaces. Material uses dark gray surfaces (Material 2 guidance is around `#121212`, Material 3 uses tonal surface roles). "Never use pure black" is not a rule. It is a Material-flavored preference, and on iOS black is native.
- **[Standard]** Elevation comes from lighter surfaces, not shadows. Both platforms do this.
- **[Heuristic]** Starting points: raise card lightness roughly +4 to +6 over the base, and desaturate saturated accents a little in dark mode. Then verify contrast and adjust by eye. The exact numbers are not from a spec.
- **[Heuristic]** Map light and dark to one shared ramp (for example 50 and 500 in light, 950 and 300 in dark) so themes stay in sync. The step numbers are an example, not a rule.
- **[Standard]** Contrast rules apply to both themes. Re-check dark mode separately.

**Contrast**

| What | Minimum | Source |
| --- | --- | --- |
| Normal text (under 18pt, or under 14pt bold) | 4.5:1 | WCAG 1.4.3 |
| Large text (18pt+, or 14pt+ bold) | 3:1 | WCAG 1.4.3 |
| UI components, icons, focus indicators | 3:1 | WCAG 1.4.11 |

**[Standard]** WCAG is written for web content, and is the common benchmark applied to mobile.

**Color meaning (brand work)**

**[Heuristic, weak evidence]** Color associations (blue trust, green growth, purple creativity) are cultural and context dependent, and studied effects are small. Use them as a starting hypothesis, not a reason. White means purity in some cultures and mourning in others, so check your target markets. Red for a sale badge conflicts with red as error, so pick one meaning per screen.

---

## Premium and restrained minimalism

**[Heuristic]** A style register, not a law of design. Apply it only when the user asks for premium, luxury or minimal, or the brand is already there.

- Restraint reads as confidence: remove what isn't doing work before adding anything.
- Generous, uneven whitespace around few elements. Edge-to-edge packing is the most common way to break the register.
- Near-monochrome palette, one deliberate accent or none.
- 1 to 2 typefaces, 2 to 3 weights, and let size and space do the hierarchy.
- Real photography over stock icons and illustration where feasible.
- Slow, subtle motion (fades, gentle easing). Motion should never be the loudest thing on screen.
- One loudest element per screen. If two fight, one is wrong.

---

## UX laws: what each one actually supports

**Fitts's law. [Evidence]** Movement time grows with distance and shrinks with target size (roughly logarithmically). Bigger, closer targets are faster and cause fewer misses. Don't quote specific millisecond or error-rate figures, none are established here.
- **[Standard]** Minimum touch targets: 44x44pt on iOS, 48x48dp on Android. WCAG 2.2 sets 24x24 CSS px as the AA floor (2.5.8). Use `hitSlop` when the visual is smaller.
- **[Heuristic]** Primary actions within thumb reach (see CTA rules for the platform caveat).

**Hick's law. [Evidence]** Decision time grows roughly logarithmically with the number of equally likely options. It describes *decisions*, so apply it at decision points (paywalls, action menus, onboarding choices). It does not limit scannable lists, pickers or settings. There is no proven "5 to 7 options" cutoff. Treat 3 to 5 primary choices at a decision point as **[Heuristic]**, and group the rest.

**Miller's law. [Evidence]** Short-term memory holds roughly 7 plus or minus 2 chunks (Miller, 1956), and later work suggests closer to 4 (Cowan, 2001). It is about remembering, not about how long a menu can be.
- **[Standard]** Bottom tab bars: up to 5 destinations (iOS HIG on iPhone, Material navigation bar 3 to 5). Use a "More" tab or a drawer beyond that.

**Jakob's law. [Heuristic]** People expect your app to work like the apps they already use. Use platform patterns (tabs, swipe-back, pull-to-refresh, long-press menus) and deviate only for a tested reason. This is the tie-breaker when a heuristic below conflicts with the platform.

**Von Restorff (isolation) effect. [Evidence]** The item that differs from its surroundings is remembered best (memory studies, 1930s onward). Applying it to CTAs is a reasonable **[Heuristic]** extension: make the one primary action visibly different (filled, accent).

**Serial position effect. [Evidence]** People recall the first and last items of a list best. Using it for navigation order or landing-page CTAs is a **[Heuristic]** extension.

**Gestalt. [Evidence]** Proximity, similarity and common region are well-established perception principles. The numeric spacing ratios built on them are **[Heuristic]**.

---

## Component selection

**[Heuristic]** These are platform conventions and common practice. Follow the project's existing patterns first.

| Interaction | Component | Why |
| --- | --- | --- |
| Confirm a destructive or discard action | Alert / confirm dialog | Needs explicit acknowledgment. Make the safe option the easy one. |
| Short form, filter, sort, share | Bottom sheet or action sheet | Contextual, thumb-reachable, dismissible by swipe. |
| Quick confirmation ("Saved") | Toast | Non-blocking, auto-dismisses. |
| Persistent status (offline, update available) | Banner | Stays until resolved. |
| Full-screen task (compose, checkout) | Full-screen modal or pushed screen | The task is the screen. |
| Detail anchored to an element | Popover | Non-blocking, dismisses on outside tap. |
| App cannot continue without a decision | Blocking dialog | Rare. |
| Non-critical error | Inline message at the field or section | No modal. |

- Prefer a sheet for contextual tasks that can be dismissed. Use a centered alert for destructive confirmations and critical errors. Both are native patterns.
- Don't put critical information in a toast. Toasts disappear and are easy to miss. If the user must read it, use a banner or inline message.
- Avoid stacking modals. The standard exception is a confirm dialog over a sheet or screen, for example "Discard changes?".

---

## Loading states

**[Evidence]** The response-time limits behind this table: about 0.1s feels instant, about 1s keeps the user's flow, and about 10s is the limit of their attention (Nielsen's summary of older HCI research). The mapping to UI is **[Heuristic]**.

| Wait | Signal |
| --- | --- |
| Under ~1s | No spinner. Show the pressed state. A flash of spinner is worse than nothing. |
| 1 to 2s | Button spinner for an action. For content, keep the previous content or a quiet placeholder. |
| 2 to 10s | Skeleton for content with a known layout. Spinner for actions. Progress bar if you know the progress. |
| 10s+ | Determinate progress, let the user leave, and notify on completion. |

- **[Evidence, mixed]** Skeleton vs spinner. Results conflict. A 2017 Viget study (136 participants) found skeleton screens felt *longer* than spinners. A 2018 study by Mejtoft et al. found the opposite. Skeletons seem to help in familiar layouts and hurt when unfamiliar. Don't promise "30 to 50% faster perceived speed". No such number is established.
- **[Heuristic]** If you use a skeleton, match the final layout so nothing jumps when content arrives. Reserve space either way.
- **[Heuristic]** Show cached data with a subtle refresh indicator instead of a blank state under a spinner.
- **[Heuristic]** Avoid full-screen blocking spinners for content loads. A brief blocking state is acceptable for irreversible actions like payment.
- **[Heuristic]** Prevent duplicate submits while an action is in flight. Disabling the button works, and so does ignoring presses. Keep the button visible with a spinner.

---

## CTA and hierarchy

- **[Heuristic]** One primary action per screen, visibly dominant (filled, accent, larger). If you name two, split the screen or move one into a sheet.
- **[Heuristic]** Secondary actions are outline or text. Avoid two filled buttons side by side. Platform alerts and paired action bars are an exception.
- **[Heuristic]** Thumb-zone placement (bottom third) helps one-handed use. The evidence is observational grip studies (Hoober, 2013, updated 2017) and dated for large phones. **Platform convention wins:** iOS puts Done, Save and Cancel in the navigation bar, so don't relocate those to the bottom for the sake of the thumb zone.
- **[Heuristic]** CTA copy: specific verb plus outcome ("Send message", "Start free trial") beats "Submit". "Done", "Save" and "OK" are fine where the platform uses them.
- **[Heuristic]** Hide options that are irrelevant to the user's state. Keep a disabled control, with a reason, when the user needs to know it exists or how to enable it (for example a submit button until the form is valid).
- **[Heuristic]** Progressive disclosure: advanced options behind "More".

## Empty and error states

- **[Heuristic]** An empty state should give a next step when one exists ("Add your first project"). Some empty states are success states ("You're all caught up") and need no button.
- **[Heuristic]** Search with no results: echo the query so typos are visible, suggest a fix, and offer an exit ("Clear filters", "Browse categories").
- **[Heuristic]** Errors go inline at the field or section unless the whole screen is blocked.
- **[Heuristic]** Error copy says what happened and what to do: "Email must include @" beats "Invalid input". "Check your connection and try again" beats "Error 500".

---

## Common rationalizations

| Excuse | Reality |
| --- | --- |
| "13px padding looks fine." | **[Heuristic]** It looks fine here and drifts on the next screen. Tokens are what make a suite feel like one product. |
| "14px body is readable." | **[Heuristic]** For reading-length text on a phone, 16 to 17 is safer. 14 is fine for dense secondary text. |
| "The tap target is small but the icon is clear." | **[Standard]** 44pt / 48dp is the platform minimum. Add `hitSlop`. |
| "Red button looks better in our brand color." | **[Heuristic]** Destructive actions read as destructive when red. Don't fight the convention without a reason. |
| "Color already shows it's an error." | **[Standard]** Add an icon or text (WCAG 1.4.1). |
| "Dark mode is just inverted light mode." | **[Standard]** Each platform tunes dark surfaces and elevation separately. Re-check contrast. |
| "The skill says X, but the project's design system says Y." | Follow the project for Heuristics. Standards still win, and flag the gap to the user. |

---

## Verification

### Must fix (Standard)

- Text contrast under 4.5:1 (3:1 for large text, 3:1 for UI components and icons), in light and dark
- Meaning carried by color alone
- Touch targets under 44pt iOS / 48dp Android
- Fixed heights on text containers, `allowFontScaling` disabled, or layout breaks at the largest text size
- `fontSize` as a string
- Physical left/right layout props in an app that supports RTL
- More than 5 bottom-tab destinations
- Content hidden under the notch, home indicator or keyboard

### Should fix (Evidence)

- Related items not visibly closer together than unrelated items (label to field gap equals field to field gap)
- No feedback for an action that takes over about 1 second
- Many equal-weight choices at a single decision point
- No element that stands out as the primary action

### Consider (Heuristic)

- Spacing values that are not multiples of 4, or adjacent spacing levels under about 2x apart
- Reading-length text under 16 (iOS 17)
- More than about 6 font sizes on one screen
- More than 2 typefaces in active use
- Skeleton shape that doesn't match the loaded layout
- Two filled buttons side by side
- Modal used for a contextual task where a sheet would fit
- Toast carrying important information
- Empty state with no next step where one exists
- Generic CTA copy ("Submit")
- Premium register: more than 2 to 3 weights, multiple accents, or competing loudest elements

---

## Sources to check when in doubt

WCAG 2.2 (SC 1.4.1, 1.4.3, 1.4.4, 1.4.11, 1.4.12, 2.5.8), Apple Human Interface Guidelines (Typography, Layout, Tab bars, Dark Mode), Material Design 3 (Typography, Color, Navigation bar, State layers), React Native docs (Text, `PlatformColor`, layout props), Nielsen Norman Group on response times, Viget "A Bone to Pick with Skeleton Screens" (2017).
