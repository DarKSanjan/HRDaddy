# kiro brief — M1b: Design System & App Shell

Build the visual foundation for HR Daddy. Every subsequent module renders through what you build here, so precision matters more than volume.

**Read first:** `docs/superpowers/specs/2026-07-25-hrdaddy-design.md` §6.

**Prerequisite:** M1 kernel (`docs/kiro/M1-kernel-foundation.md`) is complete. Use `resolveNav()` from `src/core/modules/` to build the sidebar — do not hardcode navigation.

---

## The look

Linear/Vercel: dense, sharp, precise. Restraint is the point. A person should be able to read a 200-row employee table without fatigue, and the only saturated colour on a typical screen should be the one thing that needs attention.

Concretely, this means:
- Hairline 1px borders instead of drop shadows. Shadows appear only on floating overlays (dropdowns, dialogs, popovers).
- Tabular figures on every numeric column, so digits align in columns.
- 4px spacing grid. Default radius 6px.
- No decorative gradients, no glassmorphism, no rounded-3xl cards, no emoji in the UI chrome.

**Do not use the stock shadcn slate palette.** The tokens below are the palette.

---

## 1. Tokens — `src/core/ui/tokens.css`

Rewrite `src/app/globals.css` around these. Every colour is a CSS custom property consumed through Tailwind 4's `@theme inline`. **No component may hardcode a colour.** The current `src/components/sidebar.tsx` uses `bg-gray-50` and `text-gray-600` — that class of thing is now a lint-level mistake.

### Brand

```
--brand-gradient: linear-gradient(135deg, #0EE7FF 0%, #6758FF 50%, #8A1FFF 100%)
--brand-cyan:   #0EE7FF
--brand-indigo: #6758FF
--brand-purple: #8A1FFF
```

### Accent scale — default, org-overridable

Built around the gradient's mid-stop. An organisation can override `--accent-500` and the scale rederives.

```
50 #F0EFFF · 100 #E4E1FF · 200 #CDC7FF · 300 #ADA3FF · 400 #8B7BFF
500 #6758FF · 600 #5340F0 · 700 #4632D4 · 800 #3A2BAB · 900 #322887 · 950 #1E184F
```

### Neutrals

| Token | Light | Dark |
|---|---|---|
| `--bg` | `#FFFFFF` | `#0B0B0F` |
| `--bg-subtle` | `#FAFAFB` | `#101015` |
| `--surface` | `#FFFFFF` | `#141419` |
| `--surface-hover` | `#F5F5F7` | `#1A1A21` |
| `--border` | `#E8E8EC` | `#22222B` |
| `--border-strong` | `#D5D5DC` | `#32323D` |
| `--text` | `#101014` | `#F5F5F7` |
| `--text-muted` | `#61616B` | `#9B9BA6` |
| `--text-subtle` | `#8A8A96` | `#6E6E7A` |

Dark canvas is `#0B0B0F` — near-black, echoing the logo's inner square. Not slate.

### Status

| Token | Light | Dark | Used for |
|---|---|---|---|
| `--success` | `#16A34A` | `#22C55E` | active, approved, present |
| `--warning` | `#D97706` | `#F59E0B` | pending, expiring, on leave |
| `--danger` | `#DC2626` | `#EF4444` | overdue, rejected, deactivated |
| `--info` | `#2563EB` | `#3B82F6` | informational only |

### Type & metrics

Inter. Scale: 11 / 12 / 13 / 14 / 16 / 20 / 24 / 32. Body 14px; data tables 13px.
Radii: 4 / 6 / 8 / 10. Spacing: 4px grid.

Both themes are authored explicitly. Respect `prefers-color-scheme`, and provide a user toggle that persists and overrides it.

---

## 2. Where the gradient may appear

**Exactly four places.** Nowhere else.

1. Auth pages (sign-in, sign-up, wizard) — as a background treatment
2. Marketing surfaces
3. Empty-state accent illustrations
4. The `◈ HRDaddy` wordmark pinned to the **sidebar footer**

Rule 4 is a product requirement, not a stylistic one: inside an organisation, that company's identity leads and HR Daddy's recedes. The footer mark is small (16px), sits below the nav with a hairline separator above it, and carries the version number in `--text-subtle`.

Logo source files: `/Users/dark_sanjan/coding/HRDaddy Marketing Website/assets/hrdaddy-logo.svg` and `favicon.svg`. Copy them into `public/`, and build an inline React `<Logo />` so the gradient inherits `currentColor` context correctly.

---

## 3. Primitives — `src/core/ui/`

Rebuild the existing `src/components/ui/*` against the tokens, and add what is missing. Every one needs keyboard support and correct ARIA — this is an HR system, accessibility is not optional.

`Button` (primary/secondary/ghost/danger × sm/md/lg, loading, icon-only) · `Input` `Textarea` `Select` `Checkbox` `Radio` `Switch` `DatePicker` · `Label` `FormField` (label + control + hint + error, wired with `aria-describedby`) · `Card` · `Badge` (status variants above) · `Avatar` (initials fallback) · `Dropdown` `Dialog` `Popover` `Tooltip` `Toast` · `Tabs` · `Table` · `EmptyState` · `Skeleton` · `Breadcrumb` · `Pagination`

### Table

The component the product lives in. It needs: sticky header, sortable columns, row selection, keyboard navigation (arrows, Home/End, Enter to open), tabular figures, a density toggle, and column visibility control. Below `md` it collapses each row into a stacked card rather than scrolling horizontally.

### Three states, always

Every data surface authors an **empty**, **loading**, and **error** state. Loading is a skeleton matching the real layout, never a centred spinner. Empty states explain what the thing is and offer the primary action. Error states say what failed and offer a retry.

---

## 4. App shell — `src/core/ui/shell/`

```
┌────────────┬──────────────────────────────────────┐
│ Org switch │  Breadcrumb            ⌘K   🔔   👤  │
├────────────┼──────────────────────────────────────┤
│ nav (from  │                                      │
│ resolveNav)│           page content               │
│            │                                      │
│ ─────────  │                                      │
│ Settings   │                                      │
│ ◈ HRDaddy  │                                      │
└────────────┴──────────────────────────────────────┘
```

- **Sidebar** — 240px, collapsible to 56px icon rail, state persisted. Nav comes from `resolveNav(role, enabledModules)`; entries the viewer cannot access are absent, not disabled. Badge counts render from module widgets.
- **Org switcher** at the top, showing the org's own logo and accent when set.
- **Header** — breadcrumbs, `⌘K` command palette trigger, notification bell with unread count, profile menu with theme toggle and sign-out.
- **Command palette** — `⌘K` / `Ctrl+K`. Navigate to any permitted page, plus module-contributed actions. Fuzzy match, keyboard-only operable.
- **Mobile** (below `md`) — sidebar becomes a slide-over sheet, header gains a hamburger, bottom nav for the four most-used destinations.

---

## 5. Auth pages

Rebuild sign-in and sign-up against the tokens: centred card on a subtle brand-gradient field, the full HR Daddy logo above the form, clear inline validation, visible focus rings. These are the only pages where the gradient is prominent.

The 5-step signup wizard itself is **M2** — do not build it here. Sign-up may remain a single form for now.

---

## 6. Verification

Do not report done because it compiles.

- `npx tsc --noEmit`, `npx eslint`, `npx vitest run` all clean
- A Playwright smoke test that loads the shell at 1440px, 768px and 375px and asserts zero console errors at each
- Every primitive reachable and operable by keyboard alone
- Contrast meets WCAG 2.2 AA in **both** themes — verify, do not assume
- Grep the diff for hardcoded colours: no `bg-gray-*`, `text-slate-*`, or raw hex outside `tokens.css`

---

## Non-goals

No feature pages. No employee, leave, attendance, or payroll UI. No signup wizard. Build the system and the shell; the modules fill them in later milestones.
