import { beforeEach, describe, expect, it, vi } from 'vitest';

// The demo predicate reads only DEMO_MODE / DEMO_ORG_IDS from the validated
// server env. Mock getServerEnv so each case controls the signal without
// populating the full required-env surface.
const env = { DEMO_MODE: false as boolean, DEMO_ORG_IDS: [] as string[] };

vi.mock('@contractor-ops/validators', async importOriginal => {
  const actual = await importOriginal<Record<string, unknown>>();
  return {
    ...actual,
    getServerEnv: vi.fn(() => env),
  };
});

import { isDemoContext, isDemoOrg, resolveDemoOrgId } from '../demo';

beforeEach(() => {
  env.DEMO_MODE = false;
  env.DEMO_ORG_IDS = [];
});

describe('isDemoOrg', () => {
  it('is true for every org when DEMO_MODE is on (incl. null org)', () => {
    env.DEMO_MODE = true;
    expect(isDemoOrg('org_anything')).toBe(true);
    expect(isDemoOrg(null)).toBe(true);
    expect(isDemoOrg(undefined)).toBe(true);
  });

  it('is true only for listed orgs when DEMO_MODE is off', () => {
    env.DEMO_ORG_IDS = ['org_demo_1', 'org_demo_2'];
    expect(isDemoOrg('org_demo_1')).toBe(true);
    expect(isDemoOrg('org_demo_2')).toBe(true);
    expect(isDemoOrg('org_real')).toBe(false);
  });

  it('is false for a null/undefined org when only a list is configured', () => {
    env.DEMO_ORG_IDS = ['org_demo_1'];
    expect(isDemoOrg(null)).toBe(false);
    expect(isDemoOrg(undefined)).toBe(false);
  });

  it('is false when neither signal is set', () => {
    expect(isDemoOrg('org_real')).toBe(false);
  });
});

describe('resolveDemoOrgId', () => {
  it('prefers ctx.organizationId', () => {
    expect(
      resolveDemoOrgId({
        organizationId: 'org_resolved',
        session: { session: { activeOrganizationId: 'org_session' } },
      }),
    ).toBe('org_resolved');
  });

  it('falls back to the session active org', () => {
    expect(
      resolveDemoOrgId({ session: { session: { activeOrganizationId: 'org_session' } } }),
    ).toBe('org_session');
  });

  it('returns null when neither is present', () => {
    expect(resolveDemoOrgId({})).toBeNull();
    expect(resolveDemoOrgId({ session: null })).toBeNull();
  });
});

describe('isDemoContext', () => {
  it('uses the resolved org id against DEMO_ORG_IDS', () => {
    env.DEMO_ORG_IDS = ['org_session'];
    expect(isDemoContext({ session: { session: { activeOrganizationId: 'org_session' } } })).toBe(
      true,
    );
    expect(isDemoContext({ organizationId: 'org_real' })).toBe(false);
  });

  it('is true under global DEMO_MODE even with no resolvable org', () => {
    env.DEMO_MODE = true;
    expect(isDemoContext({})).toBe(true);
  });
});
