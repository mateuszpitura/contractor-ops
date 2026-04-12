/**
 * Masks a tax ID (NIP) for display to non-privileged roles.
 * Shows first 2 and last 2 digits, replacing the rest with bullets.
 *
 * Example: "1234567890" → "12••••••90"
 */
export function maskTaxId(taxId: string | null | undefined): string | null {
  if (!taxId) return null;
  const cleaned = taxId.replace(/\s/g, '');
  if (cleaned.length <= 4) return '••••';
  return `${cleaned.slice(0, 2)}${'•'.repeat(cleaned.length - 4)}${cleaned.slice(-2)}`;
}

/** Roles that are permitted to see unmasked PII (tax IDs, etc.) */
const PII_PERMITTED_ROLES = new Set([
  'owner',
  'admin',
  'finance_admin',
  'ops_manager',
  'external_accountant',
]);

/**
 * Returns true if the given role is allowed to see unmasked PII fields
 * like tax IDs and bank account numbers.
 */
export function canViewSensitivePii(role: string | undefined): boolean {
  if (!role) return false;
  return PII_PERMITTED_ROLES.has(role);
}
