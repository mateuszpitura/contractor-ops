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

/** Prisma `UserRole` enum values (UPPERCASE). */
export const userRoleValues = [
  'ADMIN',
  'FINANCE_ADMIN',
  'OPS_MANAGER',
  'TEAM_MANAGER',
  'LEGAL_COMPLIANCE_VIEWER',
  'IT_ADMIN',
  'EXTERNAL_ACCOUNTANT',
  'READONLY',
] as const;

export type UserRole = (typeof userRoleValues)[number];

const USER_ROLE_SET = new Set<string>(userRoleValues);

const MEMBER_TO_USER_ROLE: Record<Exclude<MemberRole, 'owner' | 'platform_operator'>, UserRole> = {
  admin: 'ADMIN',
  finance_admin: 'FINANCE_ADMIN',
  ops_manager: 'OPS_MANAGER',
  team_manager: 'TEAM_MANAGER',
  legal_compliance_viewer: 'LEGAL_COMPLIANCE_VIEWER',
  it_admin: 'IT_ADMIN',
  external_accountant: 'EXTERNAL_ACCOUNTANT',
  readonly: 'READONLY',
};

const USER_TO_MEMBER: Record<UserRole, MemberRole> = {
  ADMIN: 'admin',
  FINANCE_ADMIN: 'finance_admin',
  OPS_MANAGER: 'ops_manager',
  TEAM_MANAGER: 'team_manager',
  LEGAL_COMPLIANCE_VIEWER: 'legal_compliance_viewer',
  IT_ADMIN: 'it_admin',
  EXTERNAL_ACCOUNTANT: 'external_accountant',
  READONLY: 'readonly',
};

/** Pre-migration / stale cast aliases still present in some rows. */
const LEGACY_USER_ROLE_ALIASES: Record<string, UserRole> = {
  ORG_ADMIN: 'ADMIN',
  LEGAL_VIEWER: 'LEGAL_COMPLIANCE_VIEWER',
  ACCOUNTANT: 'EXTERNAL_ACCOUNTANT',
  READ_ONLY: 'READONLY',
};

function normalizeUserRole(role: string): UserRole | null {
  const legacy = LEGACY_USER_ROLE_ALIASES[role];
  if (legacy) return legacy;
  if (USER_ROLE_SET.has(role)) return role as UserRole;
  return null;
}

/** Maps Better Auth member role strings to Prisma `UserRole` for enum columns. */
export function memberRoleToUserRole(role: string | null | undefined): UserRole | null {
  if (!role) return null;

  const existing = normalizeUserRole(role);
  if (existing) return existing;

  const parsed = parseMemberRole(role);
  if (!parsed || parsed === 'platform_operator') return null;
  if (parsed === 'owner') return 'ADMIN';

  return MEMBER_TO_USER_ROLE[parsed];
}

/** Maps Prisma `UserRole` (or legacy alias) back to member.role lookup strings. */
export function userRoleToMemberRole(role: string | null | undefined): MemberRole | null {
  if (!role) return null;

  const normalized = normalizeUserRole(role) ?? role;
  const fromUserRole = USER_TO_MEMBER[normalized as UserRole];
  if (fromUserRole) return fromUserRole;

  return parseMemberRole(role);
}
