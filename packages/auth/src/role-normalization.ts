import type { RoleName } from './roles.js';

export const memberRoles = [
  'owner',
  'admin',
  'finance_admin',
  'ops_manager',
  'team_manager',
  'legal_compliance_viewer',
  'it_admin',
  'external_accountant',
  'readonly',
  'platform_operator',
] as const satisfies readonly RoleName[];

export type MemberRole = (typeof memberRoles)[number];

const MEMBER_ROLE_SET = new Set<string>(memberRoles);

/**
 * Authorization predicate: parses a raw role string against the canonical
 * member role allow-list. Performs an EXACT match — whitespace-padded inputs
 * are rejected. Trim/normalize once at the input boundary (e.g. when parsing
 * API payloads), never inside this parser.
 */
export function parseMemberRole(role: string | null | undefined): MemberRole | null {
  if (!role) return null;

  if (MEMBER_ROLE_SET.has(role)) {
    return role as MemberRole;
  }

  return null;
}

export function eligibleMemberRolesForApproval(role: string | null | undefined): MemberRole[] {
  const parsed = parseMemberRole(role);
  if (!parsed) return [];

  if (parsed === 'admin') {
    return ['owner', 'admin'];
  }

  return [parsed];
}

export function isAdminLikeRole(role: string | null | undefined): boolean {
  const parsed = parseMemberRole(role);
  return parsed === 'owner' || parsed === 'admin';
}
