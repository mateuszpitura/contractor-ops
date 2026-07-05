import { prisma } from '@contractor-ops/db';
import { createLogger } from '@contractor-ops/logger';
import { PUBLIC_API_SCOPES } from '../lib/scope-utils';
import { generateApiKey } from './api-key-service';
import { writeAuditLog } from './audit-writer';

const log = createLogger({ service: 'sandbox-provisioning' });

// One free sandbox org per developer, keyed by a deterministic slug so
// provisioning is idempotent — re-invoking returns the same org.
const sandboxSlug = (userId: string): string => `sandbox-${userId}`;

// Read-only scopes: a sandbox org is demo read-only, so a co_test_ key never
// needs (and should never carry) a write scope.
const SANDBOX_KEY_SCOPES = PUBLIC_API_SCOPES.filter(s => s.endsWith(':read'));

/**
 * Provision (idempotently) a free-forever sandbox organization for a developer.
 *
 * The org is marked `isSandbox` — so it inherits the demo read-only isolation
 * (no real side-effects, mutations blocked) — and seeded with a small fixture
 * set (a contractor + its worker identity) so read endpoints return realistic
 * shapes. Re-invoking for the same user returns the existing sandbox org without
 * re-seeding.
 *
 * Uses the primary client (creating a brand-new tenant is a control-plane
 * operation, not a tenant-scoped write).
 */
export async function provisionSandboxOrg(input: {
  userId: string;
  userName?: string | null;
}): Promise<{ organizationId: string }> {
  const slug = sandboxSlug(input.userId);

  const existing = await prisma.organization.findUnique({
    where: { slug },
    select: { id: true, isSandbox: true },
  });
  if (existing) {
    return { organizationId: existing.id };
  }

  const displayName = input.userName?.trim() || 'Developer';

  const organizationId = await prisma.$transaction(async tx => {
    const org = await tx.organization.create({
      data: {
        name: `Sandbox — ${displayName}`,
        slug,
        isSandbox: true,
        status: 'ACTIVE',
        dataRegion: 'EU',
        countryCode: 'DE',
        defaultCurrency: 'EUR',
      },
      select: { id: true },
    });

    await tx.member.create({
      data: { organizationId: org.id, userId: input.userId, role: 'owner' },
    });

    const worker = await tx.worker.create({
      data: {
        organizationId: org.id,
        workerType: 'CONTRACTOR',
        displayName: 'Acme Consulting GmbH',
        email: 'billing@acme.example',
      },
      select: { id: true },
    });

    await tx.contractor.create({
      data: {
        organizationId: org.id,
        workerId: worker.id,
        type: 'COMPANY',
        legalName: 'Acme Consulting GmbH',
        displayName: 'Acme Consulting',
        countryCode: 'DE',
        currency: 'EUR',
        email: 'billing@acme.example',
      },
    });

    return org.id;
  });

  log.info({ organizationId, userId: input.userId }, 'provisioned sandbox org');
  return { organizationId };
}

/**
 * Provision the developer's sandbox org (if needed) and mint a `co_test_` API
 * key against it. Returns the plaintext exactly once. The key is read-only and
 * capped at the sandbox daily quota; it can NEVER resolve to a production org.
 */
export async function issueSandboxKey(input: {
  userId: string;
  userName?: string | null;
  name: string;
}): Promise<{
  id: string;
  name: string;
  prefix: string;
  scopes: string[];
  organizationId: string;
  plaintext: string;
}> {
  const { organizationId } = await provisionSandboxOrg({
    userId: input.userId,
    userName: input.userName,
  });

  const { plaintext, prefix, hash } = generateApiKey({ environment: 'SANDBOX' });

  const key = await prisma.organizationApiKey.create({
    data: {
      organizationId,
      name: input.name,
      prefix,
      hash,
      scopes: SANDBOX_KEY_SCOPES,
      environment: 'SANDBOX',
      createdByUserId: input.userId,
      actingUserId: input.userId,
    },
    select: { id: true, name: true, prefix: true, scopes: true },
  });

  await writeAuditLog({
    organizationId,
    actorType: 'USER',
    actorId: input.userId,
    action: 'API_KEY_CREATE',
    resourceType: 'ORGANIZATION',
    resourceId: organizationId,
    newValues: {
      apiKeyId: key.id,
      name: key.name,
      prefix: key.prefix,
      scopes: key.scopes,
      environment: 'SANDBOX',
    },
    metadata: { apiKeyId: key.id, environment: 'SANDBOX' },
  });

  return { ...key, organizationId, plaintext };
}
