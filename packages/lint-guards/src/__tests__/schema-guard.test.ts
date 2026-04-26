// Phase 70-01 · FOUND6-01 — failing test scaffold for the multi-tenant schema guard.
// Plan 70-02 implements `runSchemaGuard`. Until then this suite fails with a
// resolve error, proving Wave 1 has implementation work to do.

import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
// biome-ignore lint/correctness/noUnresolvedImports: target of Plan 70-02
import { runSchemaGuard } from '../schema-guard/run-guard.js';

const FX = join(__dirname, '..', '__fixtures__');
const ALLOWLIST = ['Country'] as const;

describe('schema-guard (FOUND6-01)', () => {
  it('returns 0 offences for a clean multi-tenant model', async () => {
    const offences = await runSchemaGuard({
      files: [join(FX, 'clean.prisma')],
      allowlist: ALLOWLIST,
    });
    expect(offences).toEqual([]);
  });

  it('flags a multi-tenant model missing organizationId', async () => {
    const offences = await runSchemaGuard({
      files: [join(FX, 'missing-org-id.prisma')],
      allowlist: ALLOWLIST,
    });
    expect(offences).toHaveLength(1);
    expect(offences[0]?.model).toBe('SecretLeak');
    expect(offences[0]?.kind).toBe('missing-organization-id');
  });

  it('does not flag an allowlisted global-lookup model', async () => {
    const offences = await runSchemaGuard({
      files: [join(FX, 'allowlisted-global.prisma')],
      allowlist: ALLOWLIST,
    });
    expect(offences).toEqual([]);
  });
});
