// Worker-keyed WorkflowRun start.
//
// Pins the contract: a single exported
// `startWorkflowRun(tx, input, { organizationId, actorUserId })` helper owns the
// ONE `tx.workflowRun.create`, and an `{ subjectType: 'EMPLOYEE', workerId }`
// input instantiates a run through the reused v1.0 engine with
// `entityType='EMPLOYEE'`, `entityId=worker.id`, `workerId=worker.id`, and
// `contractorId=null`. The contractor path stays byte-identical (regression).

import { describe, expect, it, vi } from 'vitest';

// biome-ignore lint/correctness/noUnusedImports: the symbol does not exist yet (RED)
import { startWorkflowRun } from '../workflow-execution-runs';

const ORG = 'clorgaaaaaaaaaaaaaaaaaaaaaa';
const ACTOR = 'cluseraaaaaaaaaaaaaaaaaaaaa';
const WORKER = 'clworkeraaaaaaaaaaaaaaaaaaa';
const CONTRACTOR = 'clcontraaaaaaaaaaaaaaaaaaaa';
const TEMPLATE = 'cltmplaaaaaaaaaaaaaaaaaaaaa';

/**
 * Structural transaction double: only the surface `startWorkflowRun` touches
 * when the template has zero tasks (so instantiateTaskRuns / progress calc are
 * no-ops). `create` captures the payload for assertion.
 */
function makeTx() {
  const create = vi.fn(async ({ data }: { data: Record<string, unknown> }) => ({
    id: 'clrunaaaaaaaaaaaaaaaaaaaaaa',
    ...data,
  }));
  const tx = {
    workflowTemplate: {
      findFirst: vi.fn(async () => ({
        id: TEMPLATE,
        organizationId: ORG,
        type: 'ONBOARDING',
        name: 'Test Template',
        status: 'ACTIVE',
        tasks: [],
      })),
    },
    worker: {
      findFirst: vi.fn(async () => ({
        id: WORKER,
        organizationId: ORG,
        workerType: 'EMPLOYEE',
        displayName: 'Jan Kowalski',
        email: 'jan@example.com',
      })),
    },
    contractor: {
      findFirst: vi.fn(async () => ({
        id: CONTRACTOR,
        organizationId: ORG,
        legalName: 'Acme LLC',
        displayName: 'Acme',
        internalOwnerUserId: null,
      })),
    },
    contract: { findFirst: vi.fn(async () => null) },
    workflowRun: {
      create,
      update: vi.fn(async () => ({
        id: 'clrunaaaaaaaaaaaaaaaaaaaaaa',
        tasks: [],
        workflowTemplate: { name: 'Test Template', type: 'ONBOARDING' },
      })),
    },
    workflowTaskRun: { findMany: vi.fn(async () => []) },
    auditLog: { create: vi.fn(async () => ({ id: 'clauditaaaaaaaaaaaaaaaaaaaa' })) },
  };
  return { tx, create };
}

describe('startWorkflowRun — EMPLOYEE subject (EMP-OFF-02)', () => {
  it('creates a WorkflowRun with entityType EMPLOYEE, workerId set, contractorId null', async () => {
    const { tx, create } = makeTx();

    await startWorkflowRun(
      tx as never,
      { subjectType: 'EMPLOYEE', templateId: TEMPLATE, workerId: WORKER } as never,
      { organizationId: ORG, actorUserId: ACTOR },
    );

    expect(create).toHaveBeenCalledTimes(1);
    const payload = create.mock.calls[0]?.[0] as { data: Record<string, unknown> };
    expect(payload.data).toMatchObject({
      organizationId: ORG,
      entityType: 'EMPLOYEE',
      entityId: WORKER,
      workerId: WORKER,
      contractorId: null,
    });
  });

  it('reads the worker via workerType EMPLOYEE (never a contractor)', async () => {
    const { tx } = makeTx();

    await startWorkflowRun(
      tx as never,
      { subjectType: 'EMPLOYEE', templateId: TEMPLATE, workerId: WORKER } as never,
      { organizationId: ORG, actorUserId: ACTOR },
    );

    expect(tx.worker.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          id: WORKER,
          organizationId: ORG,
          workerType: 'EMPLOYEE',
        }),
      }),
    );
    expect(tx.contractor.findFirst).not.toHaveBeenCalled();
  });
});

describe('startWorkflowRun — CONTRACTOR subject (regression)', () => {
  it('keeps the contractor path: entityType CONTRACTOR, contractorId set, workerId null-or-absent', async () => {
    const { tx, create } = makeTx();

    await startWorkflowRun(
      tx as never,
      { subjectType: 'CONTRACTOR', templateId: TEMPLATE, contractorId: CONTRACTOR } as never,
      { organizationId: ORG, actorUserId: ACTOR },
    );

    const payload = create.mock.calls[0]?.[0] as { data: Record<string, unknown> };
    expect(payload.data).toMatchObject({
      entityType: 'CONTRACTOR',
      entityId: CONTRACTOR,
      contractorId: CONTRACTOR,
    });
    expect(payload.data.workerId ?? null).toBeNull();
  });
});
