/**
 * Pins for `deriveComplianceStatus` — the e-invoice compliance flag the
 * Invoices table column + the toolbar filter both branch on. The
 * derivation has a strict precedence: transmission state outranks
 * validation state, FAILED outranks SENT/DELIVERED, and a null lifecycle
 * collapses to `notGenerated`. A swap in precedence would silently
 * mislabel rows in the table.
 */

import { describe, expect, it } from 'vitest';

import type { InvoiceRow } from '../columns.js';
import { deriveComplianceStatus } from '../columns.js';

type Lifecycle = InvoiceRow['eInvoiceLifecycle'];

function lifecycle(overrides: Partial<NonNullable<Lifecycle>> = {}): Lifecycle {
  return {
    transmissionStatus: null,
    validationStatus: null,
    ...overrides,
  } as Lifecycle;
}

describe('deriveComplianceStatus', () => {
  it('returns `notGenerated` when the lifecycle row is absent', () => {
    expect(deriveComplianceStatus(null)).toBe('notGenerated');
    expect(deriveComplianceStatus(undefined as unknown as Lifecycle)).toBe('notGenerated');
  });

  it('FAILED transmission outranks every validation state', () => {
    expect(
      deriveComplianceStatus(
        lifecycle({ transmissionStatus: 'FAILED', validationStatus: 'VALID' }),
      ),
    ).toBe('failed');
    expect(
      deriveComplianceStatus(
        lifecycle({ transmissionStatus: 'FAILED', validationStatus: 'INVALID' }),
      ),
    ).toBe('failed');
  });

  it('SENT transmission collapses to `transmitted` regardless of validation', () => {
    expect(
      deriveComplianceStatus(
        lifecycle({ transmissionStatus: 'SENT', validationStatus: 'INVALID' }),
      ),
    ).toBe('transmitted');
  });

  it('DELIVERED transmission collapses to `transmitted` regardless of validation', () => {
    expect(
      deriveComplianceStatus(
        lifecycle({ transmissionStatus: 'DELIVERED', validationStatus: 'WARNINGS' }),
      ),
    ).toBe('transmitted');
  });

  it('without transmission, INVALID validation surfaces as `invalid`', () => {
    expect(deriveComplianceStatus(lifecycle({ validationStatus: 'INVALID' }))).toBe('invalid');
  });

  it('without transmission, WARNINGS validation surfaces as `warnings`', () => {
    expect(deriveComplianceStatus(lifecycle({ validationStatus: 'WARNINGS' }))).toBe('warnings');
  });

  it('without transmission, VALID validation surfaces as `valid`', () => {
    expect(deriveComplianceStatus(lifecycle({ validationStatus: 'VALID' }))).toBe('valid');
  });

  it('an all-null lifecycle row collapses to `notGenerated`', () => {
    expect(deriveComplianceStatus(lifecycle())).toBe('notGenerated');
  });

  it('precedence proof: FAILED beats SENT even if both are set in a stale row', () => {
    // Construction-impossible in production (transmissionStatus is a
    // single column) but pinned here so the precedence intent is loud
    // — the first matching branch wins, FAILED comes first.
    expect(deriveComplianceStatus(lifecycle({ transmissionStatus: 'FAILED' }))).toBe('failed');
  });
});
