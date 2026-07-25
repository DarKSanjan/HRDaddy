# ADR-019: Design System — Token-Only Colour, No Hardcoded Hex in Components

**Status:** Accepted

## Context

HR Daddy supports organisation-level brand customisation (accent colour override) and system-level light/dark mode. If components hardcode hex values, achieving consistent theming requires finding and updating every instance — a maintenance burden that grows with the component library and inevitably leads to visual inconsistencies.

## Decision

Every colour used in the application is a CSS custom property defined in `src/core/ui/tokens.css`. Components never reference hex values directly; they use Tailwind utility classes that resolve to token values via `@theme inline` in `src/app/globals.css`.

The token system defines:

- **Brand gradient** — `--brand-gradient` (cyan → indigo → purple), plus individual stops `--brand-cyan`, `--brand-indigo`, `--brand-purple`.
- **Accent scale** — `--accent-50` through `--accent-950` (11 stops). `--accent-500` is the org-overridable primary colour; organisations can set `brandPrimaryColor` in their settings, which overrides this single token and the entire accent scale derives from it.
- **Neutrals** — `--bg`, `--bg-subtle`, `--surface`, `--surface-hover`, `--border`, `--border-strong`, `--text`, `--text-muted`, `--text-subtle` — all redefined under `.dark` class.
- **Status colours** — `--success`, `--warning`, `--danger`, `--info` — separate light/dark values.
- **Typography** — `--font-body` (Inter via next/font), `--font-mono`.
- **Spacing** — 4px base grid (`--space-1` through `--space-16`).
- **Radii** — `--radius-xs` (4px) through `--radius-lg` (10px).

Dark mode is activated via:
1. The `.dark` class on a parent element (for manual toggle).
2. `@media (prefers-color-scheme: dark)` on `:root:not(.light)` (for system preference, unless user has explicitly chosen light).

This dual mechanism ensures dark mode works automatically but can be overridden per-user.

## Alternatives Considered

- **Tailwind's built-in colour palette** — convenient but not overridable per-organisation; hardcodes specific shades.
- **CSS-in-JS theme objects** — runtime overhead, incompatible with server-component streaming, harder to inspect in DevTools.
- **SASS variables** — compile-time only, cannot be overridden at runtime for org branding.

## Consequences

- Any component can be themed by changing tokens alone; no component source changes needed.
- Organisation brand colour override is a single CSS variable change at render time.
- Light/dark mode is zero-JS (CSS only) for the initial paint, avoiding FOUC.
- The ESLint/review convention "no hex in components" is enforced by code review; there is no automated lint rule yet.
- Animations and transitions respect `prefers-reduced-motion` via conditional `@media` blocks in globals.css.

## Risks

- Without an automated lint rule, hex values could slip in via copy-paste. Mitigated by PR review convention.
- The 11-stop accent scale assumes a single-hue brand; multi-hue brands would need a more complex token structure.

## Revisit Conditions

- If an automated lint rule for hex-in-components becomes available (e.g. stylelint or eslint-plugin-css).
- If multi-hue brand support is required (e.g. a client with a gradient brand that needs different hues at different stops).
- If Tailwind 5 changes the `@theme` mechanism.
