/**
 * Platform Terms of Service version constant.
 *
 * Lifted from apps/web/src/lib/tos.ts unchanged. The dashboard root
 * layout checks the user's latest ConsentEvent (scope=TOS) against
 * this constant; stale or missing → TosReacceptanceModal opens.
 */

export const TOS_CURRENT_VERSION = '2026.1.0' as const;
export type TosVersion = typeof TOS_CURRENT_VERSION;
