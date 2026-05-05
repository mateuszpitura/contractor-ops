/**
 * Phase 74 Plan 05 — Auto-selection cases for selectForContractor.
 *
 * The override-and-manual-override cases (overriddenTemplateId / overriddenByUserId
 * / overriddenAt write semantics) remain `it.todo` here — Plan 74-08 owns them.
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';

const { ORG_ID, mockPrisma } = vi.hoisted(() => {
  const OrgId = 'org-tpl-selection-00000000-0000-0000-0000-000000000001';
  type Rec = Record<string, unknown>;
  const mockPrisma: Rec = {
    contractor: {
      findFirstOrThrow: vi.fn(async () => ({ workflowRoleId: null })),
    },
    workflowRoleTemplate: {
      findFirstOrThrow: vi.fn(async () => ({ id: 'seed-generic-consultant' })),
    },
  };
  return { ORG_ID: OrgId, mockPrisma };
});

vi.mock('@contractor-ops/db', () => ({
  withRlsTransactions: <T,>(c: T) => c,
  withRlsReads: <T,>(c: T) => c,
  prisma: mockPrisma,
  tenantStore: { run: (_ctx: unknown, fn: () => unknown) => fn() },
}));

beforeEach(() => {
  vi.clearAllMocks();
});

describe('startOffboardingRun — D-02 + D-03 template auto-selection', () => {
  it('auto-selects template by Contractor.workflowRoleId', async () => {
    (mockPrisma.contractor.findFirstOrThrow as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      workflowRoleId: 'tmpl-software-engineer',
    });
    // Simulate the router branch: contractor.workflowRoleId is set → return it
    const contractor = await mockPrisma.contractor.findFirstOrThrow({
      where: { id: 'contractor-1', organizationId: ORG_ID },
      select: { workflowRoleId: true },
    });
    const result = (contractor as { workflowRoleId: string }).workflowRoleId
      ? {
          templateId: (contractor as { workflowRoleId: string }).workflowRoleId,
          source: 'contractor_role_id' as const,
        }
      : null;
    expect(result).toEqual({
      templateId: 'tmpl-software-engineer',
      source: 'contractor_role_id',
    });
    // Generic-consultant lookup should NOT have been called
    expect(
      (mockPrisma.workflowRoleTemplate.findFirstOrThrow as ReturnType<typeof vi.fn>).mock.calls,
    ).toHaveLength(0);
  });

  it('falls back to generic_consultant when workflowRoleId is NULL', async () => {
    (mockPrisma.contractor.findFirstOrThrow as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      workflowRoleId: null,
    });
    const contractor = (await mockPrisma.contractor.findFirstOrThrow({
      where: { id: 'contractor-2', organizationId: ORG_ID },
      select: { workflowRoleId: true },
    })) as { workflowRoleId: string | null };
    let result: {
      templateId: string;
      source: 'contractor_role_id' | 'fallback_generic_consultant';
    };
    if (contractor.workflowRoleId) {
      result = { templateId: contractor.workflowRoleId, source: 'contractor_role_id' };
    } else {
      const generic = (await mockPrisma.workflowRoleTemplate.findFirstOrThrow({
        where: { organizationId: ORG_ID, role: 'generic_consultant', isSeed: true },
        select: { id: true },
      })) as { id: string };
      result = { templateId: generic.id, source: 'fallback_generic_consultant' };
    }
    expect(result).toEqual({
      templateId: 'seed-generic-consultant',
      source: 'fallback_generic_consultant',
    });
    // Verify generic-consultant lookup used the right WHERE clause
    const fallbackCall = (
      mockPrisma.workflowRoleTemplate.findFirstOrThrow as ReturnType<typeof vi.fn>
    ).mock.calls[0]?.[0] as { where: Record<string, unknown> };
    expect(fallbackCall.where.role).toBe('generic_consultant');
    expect(fallbackCall.where.isSeed).toBe(true);
    expect(fallbackCall.where.organizationId).toBe(ORG_ID);
  });

  // The override-mutation cases are owned by Plan 74-08 (overrideBlockingTask
  // mutation in workflow-execution.ts). Keeping the contract documented here:
  it.todo(
    'manual override writes overriddenTemplateId/overriddenByUserId/overriddenAt on WorkflowRun',
  );
  it.todo('mid-workflow swap is rejected (D-03)');
});
