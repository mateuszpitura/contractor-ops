import { describe, expect, it } from 'vitest';

import { isOneHrisPerOrgViolation, ONE_HRIS_PER_ORG_INDEX } from '../mapping';

// The one-HRIS-per-org invariant is a raw-SQL PARTIAL unique index
// (`WHERE provider IN ('PERSONIO','BAMBOOHR')`), authored in the migration —
// Prisma `@@unique` cannot express a filtered index. Connecting a second HRIS
// to an org already connected to the other raises P2002 on that index, which
// the connect procedure maps to a typed CONFLICT. This unit pins the
// error-recognition helper the router relies on; the constraint itself is
// exercised against a migrated test DB.

function prismaP2002(constraint: string): Error & { code: string; meta: Record<string, unknown> } {
  const err = new Error('Unique constraint failed') as Error & {
    code: string;
    meta: Record<string, unknown>;
  };
  err.code = 'P2002';
  err.meta = { target: constraint };
  return err;
}

describe('one-HRIS-per-org constraint recognition', () => {
  it('exposes the partial-index name the migration creates', () => {
    expect(ONE_HRIS_PER_ORG_INDEX).toBe('integration_connection_one_hris_per_org');
  });

  it('recognizes a P2002 raised by the one-HRIS-per-org partial index', () => {
    expect(isOneHrisPerOrgViolation(prismaP2002('integration_connection_one_hris_per_org'))).toBe(
      true,
    );
  });

  it('does not misfire on an unrelated unique-constraint violation', () => {
    expect(
      isOneHrisPerOrgViolation(prismaP2002('integration_connection_org_provider_user_uniq')),
    ).toBe(false);
  });

  it('does not misfire on a non-P2002 error', () => {
    expect(isOneHrisPerOrgViolation(new Error('boom'))).toBe(false);
  });
});
