/**
 * Polish NIP (tax identification) mod-11 checksum validator.
 *
 * Lifted from apps/web/src/lib/nip-validator.ts unchanged. Step 11
 * codemod: zero swaps needed (pure logic, no Next imports).
 */

const NIP_WEIGHTS = [6, 5, 7, 2, 3, 4, 5, 6, 7] as const;

export function isValidNip(raw: string): boolean {
  const nip = raw.replace(/[\s-]/g, '');
  if (!/^\d{10}$/.test(nip)) return false;
  const digits = nip.split('').map(Number);
  const checksum = NIP_WEIGHTS.reduce((sum, w, i) => sum + w * (digits[i] ?? 0), 0) % 11;
  return checksum === digits[9];
}
