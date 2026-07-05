import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@contractor-ops/logger', () => ({
  createLogger: () => ({ info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() }),
}));

const { mockAudit } = vi.hoisted(() => ({ mockAudit: vi.fn(async () => undefined) }));
vi.mock('../../audit-writer', () => ({ writeAuditLog: mockAudit }));

import { applyPatchToWorker } from '../apply-patch';
import type { HrisWritableEmployeePatch } from '../field-partition';

// A tenant-scoped db double. `externalLink.findFirst` only returns a row when
// the query's organizationId matches the link's owning org — modelling the
// withTenantScope predicate. A record for org B therefore never resolves a
// worker when the pull runs under org A.
function buildTenantDb(
  link: { organizationId: string; externalId: string; entityId: string } | null,
) {
  const workerUpdate = vi.fn(async () => ({}));
  const profileUpsert = vi.fn(async () => ({}));
  const fileUpdate = vi.fn(async () => ({}));
  const db = {
    externalLink: {
      findFirst: vi.fn(
        async ({ where }: { where: { organizationId: string; externalId: string } }) => {
          if (!link) return null;
          if (where.organizationId !== link.organizationId) return null;
          if (where.externalId !== link.externalId) return null;
          return { id: 'link-1', entityId: link.entityId };
        },
      ),
    },
    worker: { update: workerUpdate },
    employeeProfile: {
      findFirst: vi.fn(async () => ({ countryFields: {} })),
      update: profileUpsert,
    },
    personnelFile: { update: fileUpdate },
    $transaction: vi.fn(async (fn: (tx: unknown) => unknown) => fn(db)),
  };
  return { db, workerUpdate, profileUpsert };
}

const patch: HrisWritableEmployeePatch = { displayName: 'New Name', employmentStatus: 'ACTIVE' };

beforeEach(() => vi.clearAllMocks());

describe('applyPatchToWorker cross-org isolation (IDOR)', () => {
  it('does NOT write when a Personio record resolves to another org’s worker', async () => {
    // The link belongs to org B; the pull runs under org A.
    const { db, workerUpdate } = buildTenantDb({
      organizationId: 'org-B',
      externalId: 'p-1001',
      entityId: 'worker-B',
    });
    const res = await applyPatchToWorker(db as never, 'org-A', 'p-1001', patch, {
      origin: 'HRIS_PULL',
    });
    expect(res.applied).toBe(false);
    expect(workerUpdate).not.toHaveBeenCalled();
    expect(mockAudit).not.toHaveBeenCalled();
  });

  it('writes + audits when the record resolves to a worker in the SAME org', async () => {
    const { db, workerUpdate } = buildTenantDb({
      organizationId: 'org-A',
      externalId: 'p-1001',
      entityId: 'worker-A',
    });
    const res = await applyPatchToWorker(db as never, 'org-A', 'p-1001', patch, {
      origin: 'HRIS_PULL',
    });
    expect(res.applied).toBe(true);
    expect(workerUpdate).toHaveBeenCalledTimes(1);
    expect(mockAudit).toHaveBeenCalledTimes(1);
  });

  it('skips (does not auto-provision) when no ExternalLink exists', async () => {
    const { db, workerUpdate } = buildTenantDb(null);
    const res = await applyPatchToWorker(db as never, 'org-A', 'p-9999', patch, {
      origin: 'HRIS_PULL',
    });
    expect(res.applied).toBe(false);
    expect(workerUpdate).not.toHaveBeenCalled();
  });
});
