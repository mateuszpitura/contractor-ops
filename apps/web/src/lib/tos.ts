// apps/web/src/lib/tos.ts
//
// Phase 64 · D-30 — Platform Terms of Service version constant.
//
// Bump this value when the ToS content changes substantively.
// Format: YYYY.N.N (semver-ish — year + major + minor).
//
// The dashboard root layout checks the user's latest ConsentEvent (scope=TOS)
// against this constant. If stale or missing, <TosReacceptanceModal> is shown.

/**
 * Current Terms of Service version. Users who accepted an older version
 * (or have no ToS ConsentEvent) see the re-acceptance modal on next login.
 */
export const TOS_CURRENT_VERSION = '2026.1.0' as const;
export type TosVersion = typeof TOS_CURRENT_VERSION;
