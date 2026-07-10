import { describe, expect, it } from 'vitest';
import {
  addUtcDays,
  CONTRACT_EXPIRING_WINDOW_DAYS,
  isContractEndDatePast,
  isContractEndDateWithinExpiringWindow,
  utcCalendarDay,
} from '../services/contract-expiry-scan';

describe('contract-expiry-scan date helpers', () => {
  const today = utcCalendarDay(new Date('2026-07-10T15:30:00.000Z'));

  it('utcCalendarDay normalises to UTC midnight of the calendar day', () => {
    expect(utcCalendarDay(new Date('2026-07-10T23:59:59.999Z')).toISOString()).toBe(
      '2026-07-10T00:00:00.000Z',
    );
  });

  it('endDate before today is past', () => {
    const endDate = new Date('2026-07-09T00:00:00.000Z');
    expect(isContractEndDatePast(endDate, today)).toBe(true);
  });

  it('endDate equal to today is not past', () => {
    const endDate = new Date('2026-07-10T00:00:00.000Z');
    expect(isContractEndDatePast(endDate, today)).toBe(false);
  });

  it('endDate today is within the expiring window', () => {
    const endDate = new Date('2026-07-10T00:00:00.000Z');
    expect(
      isContractEndDateWithinExpiringWindow(endDate, today, CONTRACT_EXPIRING_WINDOW_DAYS),
    ).toBe(true);
  });

  it('endDate at window boundary is within the expiring window', () => {
    const endDate = addUtcDays(today, CONTRACT_EXPIRING_WINDOW_DAYS);
    expect(
      isContractEndDateWithinExpiringWindow(endDate, today, CONTRACT_EXPIRING_WINDOW_DAYS),
    ).toBe(true);
  });

  it('endDate beyond the window is not expiring', () => {
    const endDate = addUtcDays(today, CONTRACT_EXPIRING_WINDOW_DAYS + 1);
    expect(
      isContractEndDateWithinExpiringWindow(endDate, today, CONTRACT_EXPIRING_WINDOW_DAYS),
    ).toBe(false);
  });

  it('endDate already past is not expiring', () => {
    const endDate = new Date('2026-07-09T00:00:00.000Z');
    expect(
      isContractEndDateWithinExpiringWindow(endDate, today, CONTRACT_EXPIRING_WINDOW_DAYS),
    ).toBe(false);
  });
});
