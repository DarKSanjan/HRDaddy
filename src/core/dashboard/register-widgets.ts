/**
 * Widget registrations — DEPRECATED.
 *
 * All dashboard widgets are now declared in their owning module's manifest
 * via the `widgets` field. This file is kept as an empty barrel to avoid
 * breaking any stale imports during the transition.
 *
 * The dashboard kernel reads widgets from the module registry directly.
 * See: src/core/dashboard/index.ts → collectWidgets()
 */

// No registrations — widgets live in module manifests.
