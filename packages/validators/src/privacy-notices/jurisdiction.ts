// Phase 56 · Plan 07 — Pure jurisdiction resolver.
//
// Isolated from the tRPC/Prisma service so it can be imported from client
// components (jurisdiction picker, footer links) and from tests without
// pulling in the Node-only privacy-notice service. The service in
// `packages/api/src/services/privacy-notice.ts` re-exports this function
// for backward compatibility.

export type SupportedJurisdiction = 'AE' | 'SA' | 'GB' | 'DE' | 'EU';

/**
 * Map an ISO-3166 alpha-2 countryCode to the jurisdiction whose privacy
 * notice applies. D-09 fallback rule: unknown / missing -> 'EU'.
 *
 * Pure and synchronous — safe to call in server components, client
 * components, tRPC handlers, and test mocks alike.
 */
export function resolveJurisdiction(countryCode: string | null | undefined): SupportedJurisdiction {
  if (!countryCode) return 'EU';
  const upper = countryCode.toUpperCase();
  if (upper === 'GB' || upper === 'DE' || upper === 'AE' || upper === 'SA') {
    return upper;
  }
  return 'EU';
}
