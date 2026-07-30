/**
 * Registration barrel.
 *
 * defineModule() and registerPermissions() run as import-time side effects, so
 * something must import this file for the registry to be populated. Server
 * components, client components and the proxy are separate module graphs in
 * Next.js — a context that never reaches this barrel sees an empty registry,
 * which surfaces as an empty sidebar rather than as an error.
 *
 * src/modules/__tests__/registration.test.ts pins that contract.
 */

// Kernel permissions first. Organisation admin, notifications and audit belong
// to the platform, not to any module, and must resolve even when every optional
// module is disabled.
import '@/core/permissions/kernel'

import '@/modules/employees/manifest'
import '@/modules/attendance/manifest'
import '@/modules/leave/manifest'
import '@/modules/calendar/manifest'
import '@/modules/assets/manifest'
import '@/modules/expenses/manifest'
import '@/modules/performance/manifest'
import '@/modules/payroll/manifest'
import '@/modules/documents/manifest'
import '@/modules/onboarding/manifest'
