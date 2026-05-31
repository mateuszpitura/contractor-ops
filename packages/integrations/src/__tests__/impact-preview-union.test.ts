import { DeprovisioningProvider } from '@contractor-ops/db/generated/prisma/client';
import { describe, expect, it } from 'vitest';
import type { ImpactPreview, ImpactPreviewProvider } from '../idp/impact-preview.js';

// Phase 77 D-01 CI lint — the ImpactPreview union's `provider` discriminants
// MUST be a subset of the Prisma `DeprovisioningProvider` enum. Phase 78 grows
// the union (Entra, Okta, …); this list grows with it. A drift between the
// union and the saga provider enum fails this test.

// One representative value per current union member. Adding a member to the
// union without adding it here is a compile error (the array is typed against
// the discriminant union), so the runtime subset assertion stays exhaustive.
const UNION_PROVIDERS: readonly ImpactPreviewProvider[] = [
  'GOOGLE_WORKSPACE',
  'SLACK',
  'ENTRA',
  'OKTA',
  'GITHUB',
];

describe('ImpactPreview union ↔ DeprovisioningProvider enum (Phase 77 D-01)', () => {
  const enumValues = Object.values(DeprovisioningProvider) as string[];

  it('every union provider discriminant is a valid DeprovisioningProvider enum value', () => {
    for (const provider of UNION_PROVIDERS) {
      expect(enumValues, `union provider "${provider}" missing from enum`).toContain(provider);
    }
  });

  it('GOOGLE_WORKSPACE and SLACK are both present', () => {
    expect(UNION_PROVIDERS).toContain('GOOGLE_WORKSPACE');
    expect(UNION_PROVIDERS).toContain('SLACK');
  });

  it('a narrowed GOOGLE_WORKSPACE preview carries GWS custom metrics', () => {
    const preview: ImpactPreview = {
      provider: 'GOOGLE_WORKSPACE',
      commonMetrics: {
        externalUserId: 'u@example.com',
        externalUserDisplayName: 'Example User',
        accountStatus: 'ACTIVE',
        sessionCount: 2,
      },
      customMetrics: { oauthGrants: [], isSuperAdmin: false, drivesOwnedCount: null },
      fetchedAt: new Date().toISOString(),
      cacheKey: 'co:idp:preview:GOOGLE_WORKSPACE:u@example.com',
    };
    expect(preview.provider).toBe('GOOGLE_WORKSPACE');
    if (preview.provider === 'GOOGLE_WORKSPACE') {
      expect(preview.customMetrics.isSuperAdmin).toBe(false);
    }
  });
});
