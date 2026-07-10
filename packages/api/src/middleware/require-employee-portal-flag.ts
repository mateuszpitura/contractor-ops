// Boot-time registration gate for the employee self-service portal.
//
// The portalEmployee / portalManager namespaces ship dark behind
// `module.employee-portal`. Two enforcement layers protect them:
//   1. This module-level check — the namespaces are absent from portalAppRouter
//      at boot when the flag is unregistered (clients get METHOD_NOT_FOUND).
//   2. The per-request re-assertion inside portalEmployeeAuthMiddleware, which
//      re-evaluates the flag for the caller's org/region and throws FORBIDDEN
//      before any handler runs.
//
// Mirrors isWorkforceRegistered / isUsExpansionRegistered.

import { evaluate } from '@contractor-ops/feature-flags';
import { hasQaDefaultOrg } from './raw-env';

/**
 * Decides whether the portalEmployee / portalManager namespaces are spread into
 * portalAppRouter at boot. A QA walk org (QA_DEFAULT_ORG_ID) force-registers
 * them so the seeded org can exercise the gated surface; production never sets
 * QA_DEFAULT_ORG_ID.
 */
export function isEmployeePortalRegistered(): boolean {
  const base = evaluate('module.employee-portal', { organizationId: 'ROOT', region: 'EU' });
  return base.enabled || hasQaDefaultOrg();
}
