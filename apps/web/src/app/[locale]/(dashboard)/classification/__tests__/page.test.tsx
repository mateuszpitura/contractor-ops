// ---------------------------------------------------------------------------
// Phase 60 · CLASS-10 — classification dashboard page smoke tests.
// ---------------------------------------------------------------------------
//
// Covers VALIDATION.md 60-04-07 (page composition):
//   - page renders two market cards + 4 tiles each per UI-SPEC D-13
//   - global header renders totals + lastScannedAt
//   - refresh button invalidates classificationDashboard React Query caches
//   - download CSV triggers exportMarketCsv mutation + opens signed URL.

import { describe, it } from 'vitest';

describe('Classification dashboard page — composition (60-04-07)', () => {
  it.todo('renders two market cards (UK — IR35 + Germany — Scheinselbständigkeit) with 4 tiles each');
  it.todo('renders global header with totalContractors + totalActiveEngagements + lastScannedAt');
  it.todo('refresh button click invalidates classificationDashboard React Query caches');
  it.todo('download CSV click triggers exportMarketCsv mutation + initiates signed URL download');
  it.todo('renders empty state when there are zero active engagements');
});
