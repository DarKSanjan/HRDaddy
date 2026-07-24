/**
 * No-op stand-in for the `server-only` package under Vitest.
 *
 * The real package throws when imported outside a React Server Component,
 * which is the correct behaviour in a build but makes every server module
 * impossible to unit test. Aliased in vitest.config.ts only — the genuine
 * guard is still in force everywhere else.
 */
export {}
