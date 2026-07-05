// TIME-EMP-03 builder contract: buildEwidencjaSnapshot freezes the KP §149
// field set (hours + start/end, night, overtime, days-off-with-type, dyżur
// place, zwolnienia, absences) from Σ EmployeeTimeRecord + leave; supersession
// is INSERT-only (a new version row + previousSnapshotId back-pointer) so the
// append-only trigger never conflicts with a supersede. Wave-0: RED until the
// builder lands. Uses a mock tx — no live DB.

import { describe, expect, it, vi } from 'vitest';

import { buildEwidencjaSnapshot, supersedeAndInsertEwidencja } from '../ewidencja-builder';

const ORG = 'org-ewi-0001';
const WORKER = 'worker-ewi-0001';

function makeTx(overrides: Record<string, unknown> = {}) {
  return {
    employeeTimeRecord: {
      findMany: vi.fn(async () => [
        {
          workDate: new Date('2026-01-05'),
          startTime: new Date('2026-01-05T08:00:00Z'),
          endTime: new Date('2026-01-05T17:00:00Z'),
          workedMinutes: 480,
          nightMinutes: 0,
          overtimeMinutes50: 60,
          overtimeMinutes100: 0,
          weekendHolidayMinutes: 0,
          onCallMinutes: 120,
          onCallLocation: 'Zakład',
          absenceKind: null,
        },
        {
          workDate: new Date('2026-01-06'),
          startTime: null,
          endTime: null,
          workedMinutes: 0,
          nightMinutes: 0,
          overtimeMinutes50: 0,
          overtimeMinutes100: 0,
          weekendHolidayMinutes: 0,
          onCallMinutes: 0,
          onCallLocation: null,
          absenceKind: 'SICK',
        },
      ]),
    },
    leaveLedgerEntry: {
      findMany: vi.fn(async () => [
        { entryType: 'DEDUCTION', minutes: -480, leaveTypeId: 'lt-annual' },
      ]),
    },
    ewidencjaSnapshot: {
      findFirst: vi.fn(async () => null),
      create: vi.fn(async (args: { data: Record<string, unknown> }) => ({
        id: 'ewi-new',
        ...args.data,
      })),
      update: vi.fn(),
      updateMany: vi.fn(),
    },
    ...overrides,
  };
}

describe('buildEwidencjaSnapshot', () => {
  it('assembles the KP §149 field set from the period time records + leave', async () => {
    const tx = makeTx();
    const snapshot = await buildEwidencjaSnapshot({
      // biome-ignore lint/suspicious/noExplicitAny: mock tx delegate subset
      tx: tx as any,
      organizationId: ORG,
      workerId: WORKER,
      periodStart: new Date('2026-01-01'),
      periodEnd: new Date('2026-01-31'),
    });

    expect(snapshot.periodKey).toBe('2026-01');
    expect(snapshot.totals.workedMinutes).toBe(480);
    expect(snapshot.totals.overtimeMinutes50).toBe(60);
    expect(snapshot.totals.onCallMinutes).toBe(120);
    expect(Array.isArray(snapshot.days)).toBe(true);
    // per-day dyżur place + absence type must survive into the frozen snapshot
    expect(snapshot.days[0]?.onCallLocation).toBe('Zakład');
    expect(snapshot.days[1]?.absenceKind).toBe('SICK');
    expect(snapshot.absences.sick).toBeGreaterThanOrEqual(1);
  });
});

describe('supersedeAndInsertEwidencja (INSERT-only)', () => {
  it('inserts a new version row + previousSnapshotId; never updates a prior row', async () => {
    const tx = makeTx({
      ewidencjaSnapshot: {
        findFirst: vi.fn(async () => ({ id: 'ewi-prior', version: 2 })),
        create: vi.fn(async (args: { data: Record<string, unknown> }) => ({
          id: 'ewi-new',
          ...args.data,
        })),
        update: vi.fn(),
        updateMany: vi.fn(),
      },
    });

    const row = await supersedeAndInsertEwidencja(
      // biome-ignore lint/suspicious/noExplicitAny: mock tx delegate subset
      tx as any,
      {
        organizationId: ORG,
        workerId: WORKER,
        periodStart: new Date('2026-01-01'),
        periodEnd: new Date('2026-01-31'),
        periodKey: '2026-01',
        // biome-ignore lint/suspicious/noExplicitAny: opaque frozen snapshot
        snapshotJson: {} as any,
        generatedByUserId: 'user-1',
      },
    );

    // biome-ignore lint/suspicious/noExplicitAny: mock delegate
    const delegate = tx.ewidencjaSnapshot as any;
    expect(delegate.create).toHaveBeenCalledTimes(1);
    expect(delegate.update).not.toHaveBeenCalled();
    expect(delegate.updateMany).not.toHaveBeenCalled();
    const created = delegate.create.mock.calls[0][0].data;
    expect(created.version).toBe(3);
    expect(created.previousSnapshotId).toBe('ewi-prior');
    expect(row.id).toBe('ewi-new');
  });
});
