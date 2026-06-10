// Test scaffold for the multi-tenant schema guard (`runSchemaGuard`).

import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { runSchemaGuard } from '../schema-guard/run-guard';

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
