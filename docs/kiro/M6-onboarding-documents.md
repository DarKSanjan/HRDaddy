# kiro brief — M6: Onboarding and Documents

**Read first:** the M3 brief's "Rules that apply to every module" — unchanged here.

---

## Onboarding — `/[orgSlug]/onboarding`

### Templates — `/[orgSlug]/settings/onboarding`
Named templates holding ordered tasks. Each task: title, description, assignee **type** (`EMPLOYEE` / `MANAGER` / `HR`), and `dueInDays` **relative to the employee's start date** — never an absolute date, because templates are reused.

Ship a sensible Singapore default template: sign employment contract, submit NRIC/FIN, CPF nomination, bank details for payroll, IT account setup, workplace orientation, first-week manager check-in.

### Assignment
Applying a template to an employee materialises `EmployeeOnboardingTask` rows, resolving:
- `dueInDays` → concrete dates from the start date, skipping non-working days via `src/core/calendar` from M4.
- assignee type → an actual person. `MANAGER` resolves through the reporting line; if the employee has **no manager**, fall back to an HR admin rather than leaving it unassigned and invisible.

All in one transaction. Notify each assignee.

**If the start date changes, due dates must recompute** for incomplete tasks. Completed tasks keep their dates. This is the edge case that gets missed — handle it and test it.

### Tracking
Per-employee checklist with progress. Complete, reopen, waive (with reason), add notes. Overdue = incomplete and past due; surface it clearly. HR sees all in-flight onboardings with progress and an overdue count. Deactivating an employee mid-onboarding cancels it rather than leaving orphaned tasks.

---

## Documents — `/[orgSlug]/documents`

### Storage
Use `getStorage()` from `src/core/storage` — the **caller-scoped** client, so Storage RLS applies. Never `getStorageUnscoped()` in request paths; it exists only for background jobs. Keys follow `org/{orgId}/employee/{employeeId}/{uuid}`, which is what the storage policy matches on.

### Upload
Categories are org-configurable, each flagged sensitive or not. Validate **server-side**: MIME allowlist (PDF, PNG, JPEG, WebP, DOC/DOCX, XLS/XLSX) and 25MB cap — the bucket enforces both too, but do not rely on the client.

**Partial-failure handling is the point here.** If the object uploads but the metadata write fails, the object must be removed — otherwise the bucket accumulates unreferenced files nobody can see or delete. Equally, never write metadata for an object that failed to upload. Test both directions explicitly.

### Access
Download via **short-lived signed URL** generated server-side after a permission check. Never a public URL, never a long-lived one. Documents in a category marked sensitive require `document.view_all`; an employee always sees their own non-sensitive documents.

### Expiry
Optional `expiresAt` — work passes and certifications need it. Documents expiring within 30 days surface as warnings; expired ones are flagged. A daily job emits `DocumentExpiring` notifications. Build the job as a callable function with an entrypoint; do not add a scheduler.

Replace (supersede, keeping history), archive, and delete — delete is HR-only, audited, and confirmed.

---

## Tests

Unit: relative due-date resolution including start-date change; assignee resolution with and without a manager; MIME and size validation; expiry classification boundaries.

Integration: storage upload failure leaves no metadata row and no orphaned object; cross-tenant document access rejected at both the app and storage layers; signed URLs expire; sensitive-category enforcement.

E2E: HR applies a template → tasks appear for the employee → employee completes one → HR sees progress. HR uploads a document → employee opens it → an employee from another org gets 404.

---

## Definition of done

All gates clean. Both modules work against the live Supabase project including real Storage operations. Verified in a browser at 1440×900 in both themes.
