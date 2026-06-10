import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

describe('signoff-registry-flags.json — compliance-policy-engine entries', () => {
  const Dirname = dirname(fileURLToPath(import.meta.url));
  const jsonPath = resolve(Dirname, '../signoff-registry-flags.json');
  const raw = JSON.parse(readFileSync(jsonPath, 'utf8')) as Record<string, { status: string }>;

  const EXPECTED_KEYS = [
    'compliance-policy-engine.uk.right_to_work',
    'compliance-policy-engine.uk.utr',
    'compliance-policy-engine.uk.business_registration',
    'compliance-policy-engine.uk.sds',
    'compliance-policy-engine.de.a1',
    'compliance-policy-engine.de.aufenthaltstitel',
    'compliance-policy-engine.de.eight_b_estg',
    'compliance-policy-engine.pl.zus_a1',
    'compliance-policy-engine.pl.udt',
    'compliance-policy-engine.ksa.iqama',
    'compliance-policy-engine.ksa.work_permit_qiwa',
    'compliance-policy-engine.uae.emirates_id',
    'compliance-policy-engine.uae.free_zone_license',
  ];

  it('contains all 13 compliance-policy-engine entries', () => {
    const actual = Object.keys(raw).filter(k => k.startsWith('compliance-policy-engine.'));
    expect(actual.sort()).toEqual([...EXPECTED_KEYS].sort());
  });

  it('every compliance-policy-engine entry has status PENDING', () => {
    for (const key of EXPECTED_KEYS) {
      expect(
        raw[key]?.status,
        `${key} must be PENDING per Standing Constraint (legal review DEFERRED)`,
      ).toBe('PENDING');
    }
  });

  it('does NOT register any of these as runtime FLAGS (they are signoff-only)', async () => {
    // The boot gate iterates FLAG_KEYS; if these keys appear in the runtime registry
    // AND match the gated namespace prefix `compliance-`, the boot gate trips for missing approval.
    // We assert that compliance-policy-engine.* keys are NOT in FLAGS to avoid that trip.
    const { FLAGS } = await import('../registry');
    const flagKeys = Object.keys(FLAGS);
    for (const key of EXPECTED_KEYS) {
      expect(
        flagKeys,
        `${key} must NOT be a runtime flag — it is a legal-text signoff entry only`,
      ).not.toContain(key);
    }
  });
});
