// Per-section access decision for the personnel file ("akta osobowe").
//
// The four file sections (A..D) map 1:1 to the Better-Auth access-control
// resources employeeFileA..D. A section is UNLOCKED for a caller only when their
// role grants `read` on that section's resource — the same access-control
// statements requirePermission enforces, evaluated here as a boolean so the read
// procedure can decide which sections to query BEFORE touching the document
// store. Deciding the lock at the permission layer (rather than fetching every
// section and hiding some) is what closes the broken-function-level-authorization
// hole: a role without a section's grant never causes that section's rows to be
// read into a response.
//
// Session callers are resolved from the server-side session role (never a
// client-supplied value); API-key callers are checked against the key's scopes,
// mirroring the two branches of requirePermission.

import { roles } from '@contractor-ops/auth';
import type { PersonnelFileSection } from '@contractor-ops/compliance-policy';
import type { AuthMode } from '../../../context';
import { permissionToScopes } from '../../../lib/scope-utils';

/** Section enum → Better-Auth access-control resource (A→A … D→D). */
export const sectionToResource = {
  SECTION_A: 'employeeFileA',
  SECTION_B: 'employeeFileB',
  SECTION_C: 'employeeFileC',
  SECTION_D: 'employeeFileD',
} as const satisfies Record<PersonnelFileSection, string>;

/** Section enum → short display code surfaced to the client (A..D). */
export const sectionToShortCode = {
  SECTION_A: 'A',
  SECTION_B: 'B',
  SECTION_C: 'C',
  SECTION_D: 'D',
} as const satisfies Record<PersonnelFileSection, string>;

/** Server-fixed section order — the read procedure never accepts a client list. */
export const PERSONNEL_FILE_SECTIONS = [
  'SECTION_A',
  'SECTION_B',
  'SECTION_C',
  'SECTION_D',
] as const satisfies readonly PersonnelFileSection[];

/** Minimal context shape the section gate needs — the tenant procedure ctx satisfies it. */
interface SectionAccessContext {
  authMode?: AuthMode;
  apiKeyScopes?: readonly string[] | null;
  session?: { activeRole?: string | null; user?: { role?: string | null } | null } | null;
}

/**
 * Whether the caller may READ the given personnel-file section. Returns a
 * boolean and never throws — the caller turns `false` into a `{ status: 'locked' }`
 * section with no document payload.
 *
 * - API-key auth: the section resource's `read` scope must be present on the key.
 * - Session auth: the server-side session role must grant `read` on the section
 *   resource in its access-control statements (client cannot override the role
 *   used for the lookup).
 */
export function hasSectionPermission(
  ctx: SectionAccessContext,
  section: PersonnelFileSection,
): boolean {
  const resource = sectionToResource[section];

  if (ctx.authMode === 'apiKey') {
    const granted = new Set(ctx.apiKeyScopes ?? []);
    return permissionToScopes({ [resource]: ['read'] }).every(scope => granted.has(scope));
  }

  const roleName = (ctx.session?.activeRole ?? ctx.session?.user?.role) as
    | keyof typeof roles
    | null
    | undefined;
  if (!roleName) return false;

  const role = roles[roleName];
  const statements = role?.statements as Record<string, readonly string[]> | undefined;
  return statements?.[resource]?.includes('read') ?? false;
}
