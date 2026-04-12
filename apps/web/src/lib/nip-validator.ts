/**
 * Validates a Polish NIP (tax identification number) using the mod-11 checksum algorithm.
 */

const NIP_WEIGHTS = [6, 5, 7, 2, 3, 4, 5, 6, 7] as const;

export function isValidNip(raw: string): boolean {
  const nip = raw.replace(/[\s-]/g, '');
  if (!/^\d{10}$/.test(nip)) return false;
  const digits = nip.split('').map(Number);
  const checksum = NIP_WEIGHTS.reduce((sum, w, i) => sum + w * digits[i]!, 0) % 11;
  return checksum === digits[9];
}
