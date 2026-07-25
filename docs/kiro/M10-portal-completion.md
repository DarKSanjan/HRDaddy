# kiro brief — M10: Portal completion pass

The modules are built and tested but the shell around them has real gaps: dead links, read-only screens where editing should exist, no branding, and rough touch/dark-mode behaviour. This brief closes those gaps. Every item below was found by reading the actual running code — not guessed.

**Do not gold-plate.** Fix exactly what's listed. If you find something similar while working, note it in your final report rather than expanding scope silently.

---

## 1. Dead sidebar links (404s)

- `src/modules/documents/manifest.ts` declares nav entry `{ href: '/documents' }` but no route exists at `src/app/(dashboard)/[orgSlug]/documents/`. Build a real documents list page: org-wide document library, filterable by employee/type/expiry, using the queries already built for M6 (`src/modules/documents/queries.ts` or equivalent — check what exists before writing new query code).
- `src/modules/employees/manifest.ts` declares `{ href: '/departments' }` but no route exists at `.../departments/`. Departments are currently only manageable from `settings/organisation` (`OrgStructurePanel`). Decide one canonical location and fix the other: either build a real `/departments` page, or remove the dead `/departments` nav entry and point users to Settings → Organisation instead. Prefer removing the duplicate entry point over building a second UI for the same data — check `OrgStructurePanel` first.
- The sidebar's "Settings" link points to `/${orgSlug}/settings` but there is no `page.tsx` at `src/app/(dashboard)/[orgSlug]/settings/` — only `settings/organisation/page.tsx` exists. Add a settings index (either a real overview page linking to sub-sections, or a server-side redirect to `/settings/organisation` if there's currently only one sub-section — but see item 4, which adds a second one).
- After fixing, click through every sidebar entry for every role (Owner, HR Admin, Manager, Employee) in both orgs (Northstar Studios — all modules, Harbour Logistics — employees + leave only) and confirm nothing 404s and nothing renders for a disabled module.

## 2. Employee profile: wire up existing edit action, stop faking tabs

- `src/modules/employees/actions.ts` already has a working, permission-gated `updateEmployee` server action (`requirePermission(org.id, 'employee.edit')`, defaults to `ADMIN_ROLES`). Nothing in the UI calls it. `src/app/(dashboard)/[orgSlug]/employees/_components/personal-tab.tsx` and `employment-tab.tsx` are pure read-only renders — zero inputs. Add an edit mode: an "Edit" affordance visible only when the viewer has `employee.edit` (Owner/HR Admin — check `ADMIN_ROLES` for the exact set), which turns the relevant fields into a form and submits to `updateEmployee`. Follow whatever form/validation pattern the rest of the app already uses (check the employee-creation form at `.../employees/new/` for the established pattern before inventing a new one).
- The "Documents" and "Leave" tabs in `profile-tabs.tsx` currently render literal `<p>Documents module coming soon.</p>` / `<p>Leave management coming soon.</p>` placeholder text — both modules are fully built and have working pages elsewhere (`/documents` after item 1, `/leave`). Replace both stubs with real data scoped to this employee: their documents (reusing item 1's queries filtered by employee), their leave balances/history (reusing the leave module's existing queries).

## 3. Organisation branding

- `src/core/ui/tokens.css` already has a comment "Accent scale — org-overridable via `--accent-500`" but nothing in the app currently sets it per-org — confirm this and either wire it up (an org can override its accent colour, persisted, applied as an inline CSS variable on the dashboard layout) or remove the stale comment if it's genuinely out of scope for now — your call, but don't leave a comment promising a feature that doesn't exist.
- Add an **Organisation Profile** panel to Settings (alongside or before Organisation Structure): edit org display name, and **upload a company logo**. Use whatever storage abstraction already exists for documents (`src/core/storage/` — check ADR-009 and the actual implementation before adding a new upload path) so this isn't a second file-upload mechanism. The uploaded logo should show in `AppSidebar` (it already accepts `orgLogo` as a prop — check where that prop is currently sourced from and wire the real value through) and anywhere else the org identity currently falls back to a monogram letter.
- Gate logo/name editing behind the same permission tier as org structure management (`department.manage` or equivalent — check what's already used in `settings/organisation/page.tsx` and stay consistent).

## 4. Dark mode: fix the ugly sidebar selection

Root cause, confirmed by reading `tokens.css`: the `.dark` class and the `prefers-color-scheme: dark` block both override neutrals and status colors, but **never override `--accent-50` through `--accent-950`**. `AppSidebar`'s active nav item uses `bg-accent-50 text-accent-700` — in dark mode that renders as a near-white (`#F0EFFF`) block sitting on a near-black sidebar, which is exactly the jarring result being complained about.

Fix at the token layer, not the component layer: add dark-mode-appropriate accent values inside the existing `.dark` block and the `prefers-color-scheme: dark` block in `tokens.css` (e.g. a low-opacity/darkened accent for backgrounds used as "selected" states, a lighter accent for text-on-dark so it stays legible — pick values that pass reasonable contrast, this doesn't need the full dataviz-palette validator, just don't ship another near-white blob). Then **grep the whole codebase for every other place `accent-50` or `accent-100` is used as a background** (tabs, badges, buttons, empty states) and confirm each one still looks right in dark mode after the token fix — screenshot-check a few, don't assume the token fix alone is sufficient if a component also hardcodes an opacity or blend mode.

## 5. Touch-friendliness pass

Current sidebar nav rows (`app-sidebar.tsx`) are `py-1.5` with 13px text — well under the ~44×44px minimum comfortable touch target. Audit and fix, sitewide, without wrecking the dense desktop-first look:
- Sidebar nav rows, tab bars (`profile-tabs.tsx` style), table row actions, and any icon-only buttons need a real touch target — use padding or a min-height/min-width applied at `(pointer: coarse)` or a `sm:` breakpoint rather than uniformly bloating the desktop density.
- Confirm the mobile sidebar toggle in `app-shell.tsx` (`md:hidden` button at top-3 left-3) actually opens a usable mobile nav drawer, not just a UI element that does nothing — click through it.
- Check any hover-only affordances (e.g. row actions that only appear on `:hover`) have a touch-accessible equivalent (always-visible on narrow viewports, or tap-to-reveal).

## 6. Feature gaps against current HRMS norms

Researched against current top-ESS-portal expectations (payslip/document access, leave+attendance self-service, personal info self-service with approval, mobile-first access — see sources below). Add what's realistically missing, skip what's already covered:
- Employee self-service edit for **their own** low-risk personal info (contact details, emergency contact) — separate permission from `employee.edit` (that one's for admin editing anyone; this is `employee.edit_own` or similar — check if it exists in the manifest already before adding a new permission key).
- Profile photo upload for employees (same storage abstraction as the org logo).
- Confirm payslip download already surfaces from the payroll module on the employee's own profile/dashboard — if it's only reachable from a separate payroll page, add a shortcut from the profile.

Do not add benefits enrollment, AI/chatbot-led navigation, or anything requiring new infrastructure — those are out of scope for this pass.

You may look at `~/coding/jjt-tutor-portal` (`frontend/src/views/AdminDashboard.js`, `TutorDashboard.js`, `FinanceICDashboard.js`) purely for structural/UX ideas on role-scoped dashboards and dense data tables — it's a different stack (plain React, not Next.js/RSC) and a different domain (tutoring, not HR), so treat it as inspiration for layout/information-density decisions only, never copy code from it.

---

## Rules that apply to all of the above

- No emojis anywhere.
- No hardcoded hex colors in components — tokens only (this is what ADR-019 documents, see M9).
- Every new server-side mutation goes through `dbAs()` and an explicit `requirePermission` check, consistent with every other module.
- Every edit of employee/org data that's already audited elsewhere (check the audit log pattern in `employees/actions.ts`) must also write an audit entry — don't add a silent write path.

## Gate before you report done

`npm test`, `tsc --noEmit`, `eslint .` all clean. Then walk through, as both an Owner and an Employee, in both light and dark mode: sidebar (no dead links, selection state doesn't look broken in dark mode), employee profile (can edit as Owner, tabs show real data not placeholders), settings (logo upload works, org name edit works), and check touch targets on a narrow viewport. Report exactly what you changed, file by file, and flag anything you decided was out of scope so it doesn't get silently dropped.

Sources consulted for the feature-gap section: qandle.com (best ESS software 2026), technologyadvice.com (HR software 2026), savvyhrms.com (employee self-service portals 2026).
