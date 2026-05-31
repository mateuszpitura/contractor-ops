import type { GcResult } from './types';

/**
 * D-12 — 90-day retention GC. Stubbed in Plan 76-01; implemented in Plan 76-04.
 */
export async function gcExpiredProvenance(
  _db: unknown,
  _now: Date = new Date(),
): Promise<GcResult> {
  throw new Error('Not implemented — Phase 76 Plan 76-04');
}
