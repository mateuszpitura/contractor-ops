/**
 * `formatFileSize` produces the human-readable size string for the
 * uploaded-file info. That helper is the only piece of the upload flow
 * that is testable without React testing-library, which apps/web-vite
 * does not yet wire.
 * Locks the thresholds (1 KB = 1024 B, 1 MB = 1024 KB) the dropzone
 * banner depends on.
 */

import { describe, expect, it } from 'vitest';

import type { LooseTranslator } from '../../../i18n/typed-keys.js';
import { formatFileSize } from '../invoice-submit-upload.js';

// Lightweight translator stub that returns the ICU template inlined with
// the provided `size` value. Mirrors the production behaviour for the
// three keys the helper uses, without booting i18next.
function makeT(suffix: Record<'bytes' | 'kilobytes' | 'megabytes', string>): LooseTranslator {
  return (key: string, values?: Record<string, unknown>) => {
    const size = String(values?.size ?? '');
    if (key === 'bytes') return `${size}${suffix.bytes}`;
    if (key === 'kilobytes') return `${size}${suffix.kilobytes}`;
    if (key === 'megabytes') return `${size}${suffix.megabytes}`;
    return key;
  };
}

const suffix = { bytes: ' B', kilobytes: ' KB', megabytes: ' MB' } as const;

describe('formatFileSize', () => {
  it('renders bytes when below 1 KiB threshold', () => {
    const t = makeT(suffix);
    expect(formatFileSize(0, t)).toBe('0 B');
    expect(formatFileSize(512, t)).toBe('512 B');
    expect(formatFileSize(1023, t)).toBe('1023 B');
  });

  it('rolls over to kilobytes at 1024 bytes with one decimal place', () => {
    const t = makeT(suffix);
    expect(formatFileSize(1024, t)).toBe('1.0 KB');
    expect(formatFileSize(1536, t)).toBe('1.5 KB');
  });

  it('rolls over to megabytes at 1 MiB with two decimal places', () => {
    const t = makeT(suffix);
    expect(formatFileSize(1024 * 1024, t)).toBe('1.00 MB');
    // 25 MB is the portal upload cap the form advertises.
    expect(formatFileSize(25 * 1024 * 1024, t)).toBe('25.00 MB');
  });

  it('routes the size through the translator so locale formatting can intercept', () => {
    // Polish locale uses a non-breaking space between value and unit.
    const polishT = makeT({ bytes: ' B', kilobytes: ' KB', megabytes: ' MB' });
    expect(formatFileSize(2048, polishT)).toBe(`2.0 KB`);
  });

  it('clamps boundary values to the correct bucket', () => {
    const t = makeT(suffix);
    // Exactly at 1024 falls into the kilobyte bucket per the source
    // (`bytes < 1024` is strict — 1024 is not "bytes").
    expect(formatFileSize(1024, t).endsWith(' KB')).toBe(true);
    // Exactly at 1 MiB falls into the megabyte bucket for the same reason.
    expect(formatFileSize(1024 * 1024, t).endsWith(' MB')).toBe(true);
  });
});
