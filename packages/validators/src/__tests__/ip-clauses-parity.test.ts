import { describe, expect, it } from 'vitest';
import signoffRegistry from '../legal/signoff-registry.json' with { type: 'json' };

// IMPORT TARGETS — these modules ship in Plan 75-04. The .todo blocks become
// real `it(...)` blocks once those modules export their consts.
// import { IP_CLAUSES_UK } from '../legal/ip-clauses-uk.js';
// import { IP_CLAUSES_DE } from '../legal/ip-clauses-de.js';
// ... etc

describe('IP-clauses ↔ signoff-registry parity (Phase 75 D-14 + D-16)', () => {
  it('every signoff entry under legal-signoff.ip_clauses.* is a known phrase ID', () => {
    const ipClauseKeys = Object.keys(signoffRegistry).filter(k =>
      k.startsWith('legal-signoff.ip_clauses.'),
    );
    expect(ipClauseKeys.length).toBeGreaterThanOrEqual(17);

    // After Plan 75-04 ships, replace this with the actual cross-check:
    // const allConstKeys = [
    //   ...Object.keys(IP_CLAUSES_UK),
    //   ...Object.keys(IP_CLAUSES_DE),
    //   ...Object.keys(IP_CLAUSES_PL),
    //   ...Object.keys(IP_CLAUSES_US),
    //   ...Object.keys(IP_CLAUSES_KSA),
    //   ...Object.keys(IP_CLAUSES_UAE),
    // ];
    // for (const key of ipClauseKeys) {
    //   const phraseId = key.replace(/^legal-signoff\.ip_clauses\./, '');
    //   expect(allConstKeys).toContain(phraseId);
    // }

    // Until then, the placeholder assertion below RED-tags the file:
    expect.fail(
      'IP_CLAUSES_* modules not yet shipped (Plan 75-04). Replace placeholder with real cross-check.',
    );
  });

  it.todo('every IP_CLAUSES_* phraseId has a corresponding signoff-registry entry');
  it.todo('every IP_CLAUSES entry carries a non-empty `regex` field');
  it.todo('every IP_CLAUSES entry carries a `legalBasisRef` field');
  it.todo(
    'every IP_CLAUSES entry has matching `jurisdiction` and key prefix (uk.* lives in IP_CLAUSES_UK)',
  );
});
