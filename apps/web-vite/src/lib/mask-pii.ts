/**
 * PII masking helpers. The role-normalization helper lives in
 * `@contractor-ops/auth/role-normalization`, exposed as a workspace
 * sub-path.
 */

import { parseMemberRole } from '@contractor-ops/auth/role-normalization';

export function maskTaxId(taxId: string | null | undefined): string | null {
  if (!taxId) return null;
  const cleaned = taxId.replace(/\s/g, '');
  if (cleaned.length <= 4) return '••••';
  return `${cleaned.slice(0, 2)}${'•'.repeat(cleaned.length - 4)}${cleaned.slice(-2)}`;
}

/** Masks IBAN / bank account numbers — shows last 4 digits only (server parity). */
export function maskBankAccount(account: string | null | undefined): string | null {
  if (!account) return null;
  const cleaned = account.replace(/\s/g, '');
  if (cleaned.length <= 4) return '****';
  return `****${cleaned.slice(-4)}`;
}

/** Masks UK sort codes — e.g. `123456` → `XX-XX-56` (BACS submitter parity). */
export function maskSortCode(sortCode: string | null | undefined): string | null {
  if (!sortCode) return null;
  const cleaned = sortCode.replace(/\D/g, '');
  if (cleaned.length < 2) return 'XX-XX-**';
  return `XX-XX-${cleaned.slice(-2)}`;
}

const PII_PERMITTED_ROLES = new Set([
  'owner',
  'admin',
  'finance_admin',
  'ops_manager',
  'external_accountant',
]);

export function canViewSensitivePii(role: string | undefined): boolean {
  const parsed = parseMemberRole(role);
  return parsed ? PII_PERMITTED_ROLES.has(parsed) : false;
}
