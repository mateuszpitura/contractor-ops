import type { Permission } from '@contractor-ops/auth';

// ---------------------------------------------------------------------------
// Permission ↔ Scope string conversion
// ---------------------------------------------------------------------------

/**
 * Converts a Permission object into an array of `resource:action` scope strings.
 *
 * @example permissionToScopes({ contractor: ["read", "update"] })
 *          // → ["contractor:read", "contractor:update"]
 */
export function permissionToScopes(permission: Permission): string[] {
  const scopes: string[] = [];
  for (const [resource, actions] of Object.entries(permission)) {
    if (actions) {
      for (const action of actions) {
        scopes.push(`${resource}:${action}`);
      }
    }
  }
  return scopes;
}

// ---------------------------------------------------------------------------
// Available scopes for the public API
// ---------------------------------------------------------------------------

/**
 * Scopes available for Enterprise API keys.
 * Kept intentionally narrow — expand as new endpoints are added.
 */
export const PUBLIC_API_SCOPES = [
  'contractor:read',
  'contract:read',
  'invoice:read',
  'document:read',
] as const;

export type PublicApiScope = (typeof PUBLIC_API_SCOPES)[number];
