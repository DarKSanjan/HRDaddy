# kiro brief — M2b: UI polish, motion, and the chart system

Two jobs: make the product feel finished, and lay the visual groundwork the feature modules will build on.

**Read first:** `docs/superpowers/specs/2026-07-25-hrdaddy-design.md` §6, and the existing tokens in `src/core/ui/tokens.css`. Use the primitives in `src/core/ui/` — extend them, do not fork them.

**Next.js 16.2.** Consult `node_modules/next/dist/docs/` before using any framework API. `params`/`searchParams` are Promises; `cookies()`/`headers()` are async.

---

## 0. Non-negotiables

- **No emoji anywhere in the UI.** Not in module cards, not in empty states, not in nav. Use `lucide-react`. The current step-3 module cards use emoji — that is the single most visible thing to fix.
- **Laptop-first.** Design and verify at **1440×900** first, then 1280×800. Mobile must not break, but it is not the target. Do not let mobile-first assumptions drive layout.
- **No hardcoded colours.** Everything through tokens. No `bg-gray-*`, no raw hex outside `tokens.css` and the logo.
- **Respect `prefers-reduced-motion`** on every animation added. Non-negotiable, not a nicety.

---

## 1. Known defects to fix

1. **Progress indicator labels overlap their segment bars** in the wizard header. Rebuild it: segment bar above, label below with real spacing, current step emphasised, completed steps get a check.
2. **Wizard card stretches to full viewport height**, leaving dead space below the actions. It should size to content and sit optically centred.
3. **Page title renders duplicated** — "Set up your organisation — HR Daddy | HR Daddy". Fix the metadata template.
4. **Working-day chips wrap** so Saturday lands alone on a second row. All seven fit one row at ≥1280px.
5. **Country, timezone, currency and leave-year-start are not editable.** They are captured with Singapore defaults and persisted correctly, but a non-Singapore organisation cannot configure itself. Add them to step 2 as real controls: country select (default Singapore), timezone select (default Asia/Singapore), currency select (default SGD), leave-year-start. Changing country should update timezone/currency defaults without clobbering an explicit choice.

---

## 2. Auth and wizard — make it genuinely polished

Reference quality: Supabase's and Linear's auth screens. Restrained, precise, confident. Not decorative.

- Tighten the auth card: deliberate optical centring, considered vertical rhythm, a real focus treatment. The gradient bloom behind it already exists in `src/app/(auth)/layout.tsx` — keep it, refine it.
- **Step transitions:** slide+fade, ~180ms, ease-out, direction-aware (forward advances left, Back reverses). Never animate height in a way that makes the card jump.
- **Icon motion, tasteful and brief:**
  - Step completion: check mark draws in via `stroke-dashoffset` (~240ms).
  - Module cards: on select, the card border adopts the accent and the icon does one small scale pop (1.0 → 1.08 → 1.0, ~200ms). On hover, a 1px lift and a subtle border brighten — no shadow.
  - Continue button: spinner cross-fades in on pending; never a layout shift.
  - Slug availability: inline spinner → check or cross, animated, never a layout jump.
- **Step 3 module cards** are the product's pitch. Each: a lucide icon, name, one-line plain-English benefit, and a small "what you get" list of 2–3 items. `employees` shows a lock affordance and reads as permanently on rather than merely disabled.
- Every step: real empty, loading, and error states. Errors inline and specific, wired with `aria-describedby`.

---

## 3. Chart system — `src/core/ui/charts/`

The dashboard depends on this. Build it as a system, not one-off charts.

Use **Recharts**. Wrap it so feature code never imports Recharts directly — `src/core/ui/charts/` exports our components.

### Palette — validated, do not substitute

Categorical, in this **fixed order**. Assign by series identity, never by rank, never cycled:

```
1 #6758FF  2 #0891B2  3 #DB2777  4 #D97706  5 #7C3AED  6 #15803D
```

This passed colour-blindness validation against both our light (`#FFFFFF`) and dark (`#141419`) surfaces — worst adjacent CVD ΔE 10.3, above the ≥8 target. **Use the same six in both themes.** Do not "lighten them for dark mode" — that was tested and fails the lightness band.

A 7th series is never a new hue: fold into "Other", or use small multiples.

- **Sequential** (magnitude): one hue, light→dark, from the accent ramp.
- **Diverging** (polarity): two hues with a **neutral grey** midpoint. Never a hue at the midpoint, never a rainbow.
- **Status** (`--success`/`--warning`/`--danger`) is reserved for state and never reused as "series 4". Always paired with an icon or label, never colour alone.

### Rules

- **Never a dual-axis chart.** Two measures of different scale become two charts, small multiples, or values indexed to a common base.
- Thin marks. 2px lines. Markers ≥8px. Bars get 4px rounded ends on the data end only, square against the baseline. A 2px surface-coloured gap between stacked segments and adjacent bars.
- Grid and axes recessive — hairline, muted. No chart junk, no 3D, no drop shadows.
- **Text uses text tokens, never the series colour.** A coloured mark beside a label carries identity.
- **Hover is default**, not optional: crosshair + tooltip on line/area, per-mark tooltip on bar/dot/cell. Hit targets larger than the marks.
- **Legend whenever there are ≥2 series** (a single series needs none — the title names it). With ≤4 series, also direct-label.
- Tabular figures on every number.
- Each chart offers a table view of the same data — that is the accessibility fallback and it is required.

### Components to build

`LineChart` · `AreaChart` · `BarChart` (grouped + stacked) · `DonutChart` · `Sparkline` · `StatTile` (label, big number, delta with direction, optional sparkline) · `ChartCard` (title, optional filter row, body, table toggle) · `ChartEmpty` / `ChartSkeleton` / `ChartError`.

Sometimes the right answer is **not a chart** — a single number reads better as a `StatTile`. Build that and use it.

---

## 4. App shell polish

- Sidebar: active item gets an accent left-rail and a weight change, hover is a background shift only. Collapse/expand animates width, ~160ms, with the label cross-fading.
- Command palette (⌘K): fuzzy match with matched characters highlighted, grouped sections, arrow-key navigation with a visible active row, Esc to close, focus restored on close.
- Skeletons that match real layout — never a centred spinner over a blank page.
- Toasts: slide in from bottom-right, auto-dismiss, pause on hover, stack.
- Every interactive element has a visible focus ring. Keyboard-only operation must be possible everywhere.

---

## 5. Verification

Do not report done because it compiles.

- `npx tsc --noEmit`, `npx eslint`, `npx vitest run` all clean.
- Playwright: load the wizard at **1440×900**, walk all five steps, assert zero console errors at each.
- Screenshot every step in both light and dark.
- Grep the diff: zero emoji in `src/`, zero `bg-gray-*`, zero raw hex outside `tokens.css` and `logo.tsx`.
- Contrast meets WCAG 2.2 AA in both themes.
- Every animation is disabled under `prefers-reduced-motion: reduce`.

---

## Non-goals

No feature modules — employees, leave, attendance, onboarding, documents and payroll are separate briefs. Build the wizard polish, the shared chart system, and the shell. The dashboard that *uses* the charts comes later.
