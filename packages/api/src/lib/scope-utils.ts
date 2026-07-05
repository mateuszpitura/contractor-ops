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
 * Scopes available for Enterprise API keys — granular `resource:action` strings
 * that MUST equal exactly what `permissionToScopes(permission)` computes for the
 * matching `requirePermission(...)` gate (no singular/plural drift). The plural
 * `entity:read|write` labels in the Phase-99 taxonomy are scope-picker DISPLAY
 * BUNDLES that expand to these granular strings — they are NOT stored on the key.
 *
 * Read scopes cover the 9 public entities (payment_runs → payment:*,
 * workflow_tasks → workflow:*, compliance_documents → document:*); write scopes
 * cover the 7 write entities. classifications + audit_log are read-only.
 * Kept alphabetized — expand as new endpoints are added.
 */
export const PUBLIC_API_SCOPES = [
  'auditLog:read',
  'classification:read',
  'contractor:create',
  'contractor:read',
  'contractor:update',
  'contract:read',
  'document:create',
  'document:read',
  'document:update',
  'invoice:create',
  'invoice:read',
  'invoice:update',
  'payment:create',
  'payment:export',
  'payment:read',
  'payment:update',
  'workflow:create',
  'workflow:execute',
  'workflow:read',
  'workflow:update',
  'webhooks:manage',
] as const;

export type PublicApiScope = (typeof PUBLIC_API_SCOPES)[number];
