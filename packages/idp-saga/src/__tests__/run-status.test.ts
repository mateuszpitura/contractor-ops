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
  // Phase 77 D-11 — MANUAL_COMPLETED counts as terminal-success.
  it('all MANUAL_COMPLETED → COMPLETED', () => {
    expect(
      deriveRunStatus([
        { status: 'MANUAL_COMPLETED', attempts: 3 },
        { status: 'MANUAL_COMPLETED', attempts: 3 },
      ]),
    ).toBe('COMPLETED');
  });
  it('mix of SUCCEEDED + MANUAL_COMPLETED → COMPLETED', () => {
    expect(
      deriveRunStatus([
        { status: 'SUCCEEDED', attempts: 1 },
        { status: 'MANUAL_COMPLETED', attempts: 3 },
      ]),
    ).toBe('COMPLETED');
  });
  it('mix of MANUAL_COMPLETED + FAILED-at-max → PARTIAL_FAILURE', () => {
    expect(
      deriveRunStatus([
        { status: 'MANUAL_COMPLETED', attempts: 3 },
        { status: 'FAILED', attempts: 3 },
      ]),
    ).toBe('PARTIAL_FAILURE');
  });
});

describe('recomputeRunStatus (Phase 76 D-02 async wrapper)', () => {
  const makeDb = (
    steps: { status: string; attempts: number }[],
    existingFinishedAt: Date | null = null,
  ) =>
    ({
      deprovisioningStep: { findMany: vi.fn().mockResolvedValue(steps) },
      deprovisioningRun: {
        findUnique: vi.fn().mockResolvedValue({ finishedAt: existingFinishedAt }),
        update: vi.fn().mockResolvedValue({}),
      },
    }) as unknown as Parameters<typeof recomputeRunStatus>[0];

  it('reads steps + UPDATEs run.status + sets finishedAt when terminal', async () => {
    const db = makeDb([
      { status: 'SUCCEEDED', attempts: 1 },
      { status: 'SUCCEEDED', attempts: 1 },
    ]);
    const result = await recomputeRunStatus(db, 'run-1');
    expect(result).toBe('COMPLETED');
    expect(
      (db.deprovisioningRun as { update: ReturnType<typeof vi.fn> }).update,
    ).toHaveBeenCalledWith({
      where: { id: 'run-1' },
      data: { status: 'COMPLETED', finishedAt: expect.any(Date) },
    });
  });

  it('does NOT set finishedAt when status is IN_PROGRESS', async () => {
    const db = makeDb([{ status: 'IN_PROGRESS', attempts: 0 }]);
    await recomputeRunStatus(db, 'run-2');
    expect(
      (db.deprovisioningRun as { update: ReturnType<typeof vi.fn> }).update,
    ).toHaveBeenCalledWith({
      where: { id: 'run-2' },
      data: { status: 'IN_PROGRESS', finishedAt: null },
    });
  });

  it('preserves existing finishedAt on concurrent re-derivation (set-once)', async () => {
    const existingFinishedAt = new Date('2026-05-01T10:00:00Z');
    const db = makeDb([{ status: 'SUCCEEDED', attempts: 1 }], existingFinishedAt);
    await recomputeRunStatus(db, 'run-3');
    expect(
      (db.deprovisioningRun as { update: ReturnType<typeof vi.fn> }).update,
    ).toHaveBeenCalledWith({
      where: { id: 'run-3' },
      data: { status: 'COMPLETED', finishedAt: existingFinishedAt },
    });
  });
});
