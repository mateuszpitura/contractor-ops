import { describe, expect, it, vi } from 'vitest';
import { deriveRunStatus, recomputeRunStatus } from '../run-status';

describe('deriveRunStatus (Phase 76 D-02)', () => {
  it('all SUCCEEDED → COMPLETED', () => {
    expect(
      deriveRunStatus([
        { status: 'SUCCEEDED', attempts: 1 },
        { status: 'SUCCEEDED', attempts: 1 },
      ]),
    ).toBe('COMPLETED');
  });
  it('all FAILED at MAX_ATTEMPTS → FAILED', () => {
    expect(
      deriveRunStatus([
        { status: 'FAILED', attempts: 3 },
        { status: 'FAILED', attempts: 3 },
      ]),
    ).toBe('FAILED');
  });
  it('mix of SUCCEEDED + FAILED-at-max → PARTIAL_FAILURE', () => {
    expect(
      deriveRunStatus([
        { status: 'SUCCEEDED', attempts: 1 },
        { status: 'FAILED', attempts: 3 },
      ]),
    ).toBe('PARTIAL_FAILURE');
  });
  it('any IN_PROGRESS → IN_PROGRESS', () => {
    expect(
      deriveRunStatus([
        { status: 'SUCCEEDED', attempts: 1 },
        { status: 'IN_PROGRESS', attempts: 0 },
      ]),
    ).toBe('IN_PROGRESS');
  });
  it('FAILED below MAX_ATTEMPTS → IN_PROGRESS (still retrying)', () => {
    expect(
      deriveRunStatus([
        { status: 'SUCCEEDED', attempts: 1 },
        { status: 'FAILED', attempts: 1 },
      ]),
    ).toBe('IN_PROGRESS');
  });
  it('empty steps → PENDING', () => {
    expect(deriveRunStatus([])).toBe('PENDING');
  });
});

describe('recomputeRunStatus (Phase 76 D-02 async wrapper)', () => {
  it('reads steps + UPDATEs run.status + sets finishedAt when terminal', async () => {
    const findManyMock = vi.fn().mockResolvedValue([
      { status: 'SUCCEEDED', attempts: 1 },
      { status: 'SUCCEEDED', attempts: 1 },
    ]);
    const updateMock = vi.fn().mockResolvedValue({});
    const db = {
      deprovisioningStep: { findMany: findManyMock },
      deprovisioningRun: { update: updateMock },
    } as unknown as Parameters<typeof recomputeRunStatus>[0];

    const result = await recomputeRunStatus(db, 'run-1');
    expect(result).toBe('COMPLETED');
    expect(updateMock).toHaveBeenCalledWith({
      where: { id: 'run-1' },
      data: { status: 'COMPLETED', finishedAt: expect.any(Date) },
    });
  });

  it('does NOT set finishedAt when status is IN_PROGRESS', async () => {
    const updateMock = vi.fn().mockResolvedValue({});
    const db = {
      deprovisioningStep: {
        findMany: vi.fn().mockResolvedValue([{ status: 'IN_PROGRESS', attempts: 0 }]),
      },
      deprovisioningRun: { update: updateMock },
    } as unknown as Parameters<typeof recomputeRunStatus>[0];

    await recomputeRunStatus(db, 'run-2');
    expect(updateMock).toHaveBeenCalledWith({
      where: { id: 'run-2' },
      data: { status: 'IN_PROGRESS', finishedAt: null },
    });
  });
});
