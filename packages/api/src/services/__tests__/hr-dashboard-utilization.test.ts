import { describe, expect, it } from 'vitest';
import type { LeaveBalanceRow } from '../hr-dashboard-utilization';
import { deriveVacationUtilization, isWithinYearEndWindow } from '../hr-dashboard-utilization';

// 8h working day → 480 minutes; 20 days = 9600, 5 used = 2400.
const IN_WINDOW = new Date('2026-12-01T09:00:00Z'); // <60 days to year end
const OUT_WINDOW = new Date('2026-06-01T09:00:00Z'); // far from year end

describe('deriveVacationUtilization — taken/entitled from the LeaveBalance cache', () => {
  it('computes taken = usedMinutes, entitled = entitled + carryover, per worker-year', () => {
    const balances: LeaveBalanceRow[] = [
      {
        workerId: 'w1',
        year: 2026,
        entitledMinutes: 9600,
        usedMinutes: 2400,
        carryoverMinutes: 480,
      },
    ];
    const { items } = deriveVacationUtilization(balances, IN_WINDOW);
    expect(items).toHaveLength(1);
    expect(items[0]?.takenDays).toBe(5); // 2400 / 480
    expect(items[0]?.entitledDays).toBe(21); // (9600 + 480) / 480
    expect(items[0]?.unusedDays).toBe(16); // 21 - 5
  });

  it('flags under-utilization (>10 unused days) ONLY inside the year-end window', () => {
    const balances: LeaveBalanceRow[] = [
      // 20 unused days → over the 10-day threshold.
      { workerId: 'w1', year: 2026, entitledMinutes: 9600, usedMinutes: 0, carryoverMinutes: 0 },
    ];
    expect(deriveVacationUtilization(balances, IN_WINDOW).underUtilizedCount).toBe(1);
    expect(deriveVacationUtilization(balances, OUT_WINDOW).underUtilizedCount).toBe(0);
    expect(deriveVacationUtilization(balances, IN_WINDOW).items[0]?.underUtilized).toBe(true);
    expect(deriveVacationUtilization(balances, OUT_WINDOW).items[0]?.underUtilized).toBe(false);
  });

  it('does not flag a worker at or below the 10-day threshold', () => {
    const balances: LeaveBalanceRow[] = [
      // exactly 10 unused days → not flagged (strictly greater than 10).
      { workerId: 'w1', year: 2026, entitledMinutes: 4800, usedMinutes: 0, carryoverMinutes: 0 },
    ];
    expect(deriveVacationUtilization(balances, IN_WINDOW).underUtilizedCount).toBe(0);
  });

  it('aggregates multiple leave-type rows into one worker-year', () => {
    const balances: LeaveBalanceRow[] = [
      { workerId: 'w1', year: 2026, entitledMinutes: 4800, usedMinutes: 480, carryoverMinutes: 0 },
      { workerId: 'w1', year: 2026, entitledMinutes: 4800, usedMinutes: 480, carryoverMinutes: 0 },
    ];
    const { items } = deriveVacationUtilization(balances, IN_WINDOW);
    expect(items).toHaveLength(1);
    expect(items[0]?.entitledDays).toBe(20);
    expect(items[0]?.takenDays).toBe(2);
  });

  it('isWithinYearEndWindow is true near 31 Dec and false mid-year', () => {
    expect(isWithinYearEndWindow(IN_WINDOW)).toBe(true);
    expect(isWithinYearEndWindow(OUT_WINDOW)).toBe(false);
  });
});
