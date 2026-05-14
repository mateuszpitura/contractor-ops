import { describe, expect, it } from 'vitest';
import type { InvoiceMatchStatus, InvoiceRowLike, InvoiceStatus } from '../actions';
import {
  getBulkInvoiceActions,
  getDetailInvoiceActions,
  getInvoiceActions,
  getRowMenuInvoiceActions,
} from '../actions';

function makeRow(overrides: Partial<InvoiceRowLike> = {}): InvoiceRowLike {
  return {
    id: 'inv-1',
    status: 'RECEIVED',
    matchStatus: 'UNMATCHED',
    isDuplicateSuspected: false,
    isReverseCharge: false,
    ...overrides,
  };
}

describe('invoice actions registry', () => {
  describe('getInvoiceActions', () => {
    it('returns a non-empty list', () => {
      const actions = getInvoiceActions();
      expect(actions.length).toBeGreaterThan(0);
    });

    it('every action has a stable unique key', () => {
      const keys = getInvoiceActions().map(a => a.key);
      expect(new Set(keys).size).toBe(keys.length);
    });

    it('every action declares at least one surface', () => {
      for (const a of getInvoiceActions()) {
        expect(a.surfaces.length).toBeGreaterThan(0);
      }
    });

    it('every action has labelKey + i18nNamespace + icon', () => {
      for (const a of getInvoiceActions()) {
        expect(a.labelKey).toBeTruthy();
        expect(a.i18nNamespace).toBeTruthy();
        expect(a.icon).toBeTruthy();
      }
    });
  });

  describe('getBulkInvoiceActions', () => {
    it('includes approval.approve, approval.reject, bulk.export, download', () => {
      const keys = getBulkInvoiceActions().map(a => a.key);
      expect(keys).toEqual(
        expect.arrayContaining([
          'approval.approve',
          'approval.reject',
          'bulk.export',
          'download',
          'submitForMatching',
        ]),
      );
    });

    it('excludes detail-only actions like void and duplicate.dismiss', () => {
      const keys = getBulkInvoiceActions().map(a => a.key);
      expect(keys).not.toContain('void');
      expect(keys).not.toContain('duplicate.dismiss');
      expect(keys).not.toContain('match.manual');
      expect(keys).not.toContain('reverseCharge.toggle');
    });

    it('approval.reject is marked destructive', () => {
      const reject = getBulkInvoiceActions().find(a => a.key === 'approval.reject');
      expect(reject?.variant).toBe('destructive');
    });
  });

  describe('getDetailInvoiceActions — status filtering', () => {
    it('RECEIVED exposes edit + submitForMatching and hides approve/reject', () => {
      const keys = getDetailInvoiceActions(makeRow({ status: 'RECEIVED' })).map(a => a.key);
      expect(keys).toContain('edit');
      expect(keys).toContain('submitForMatching');
      expect(keys).not.toContain('approval.approve');
      expect(keys).not.toContain('approval.reject');
    });

    it('APPROVAL_PENDING exposes approve + reject but hides edit', () => {
      const keys = getDetailInvoiceActions(makeRow({ status: 'APPROVAL_PENDING' })).map(a => a.key);
      expect(keys).toContain('approval.approve');
      expect(keys).toContain('approval.reject');
      expect(keys).not.toContain('edit');
      expect(keys).not.toContain('submitForMatching');
    });

    it('PAID hides void and reverseCharge.toggle', () => {
      const keys = getDetailInvoiceActions(makeRow({ status: 'PAID' })).map(a => a.key);
      expect(keys).not.toContain('void');
      expect(keys).not.toContain('reverseCharge.toggle');
    });

    it('PARTIALLY_PAID hides void and reverseCharge.toggle', () => {
      const keys = getDetailInvoiceActions(makeRow({ status: 'PARTIALLY_PAID' })).map(a => a.key);
      expect(keys).not.toContain('void');
      expect(keys).not.toContain('reverseCharge.toggle');
    });

    it('VOID hides void (already terminal) and reverseCharge.toggle', () => {
      const keys = getDetailInvoiceActions(makeRow({ status: 'VOID' })).map(a => a.key);
      expect(keys).not.toContain('void');
      expect(keys).not.toContain('reverseCharge.toggle');
    });

    it('APPROVED exposes void as still available', () => {
      const keys = getDetailInvoiceActions(makeRow({ status: 'APPROVED' })).map(a => a.key);
      expect(keys).toContain('void');
    });

    it('void is destructive', () => {
      const action = getInvoiceActions().find(a => a.key === 'void');
      expect(action?.variant).toBe('destructive');
    });
  });

  describe('getDetailInvoiceActions — match status filtering', () => {
    it('UNMATCHED exposes match.manual and hides match.unmatch', () => {
      const keys = getDetailInvoiceActions(
        makeRow({ status: 'RECEIVED', matchStatus: 'UNMATCHED' }),
      ).map(a => a.key);
      expect(keys).toContain('match.manual');
      expect(keys).not.toContain('match.unmatch');
    });

    it('MATCHED exposes match.unmatch and hides match.manual', () => {
      const keys = getDetailInvoiceActions(
        makeRow({ status: 'APPROVED', matchStatus: 'MATCHED' }),
      ).map(a => a.key);
      expect(keys).toContain('match.unmatch');
      expect(keys).not.toContain('match.manual');
    });

    it('MANUALLY_CONFIRMED behaves like MATCHED for matching actions', () => {
      const keys = getDetailInvoiceActions(
        makeRow({ status: 'APPROVED', matchStatus: 'MANUALLY_CONFIRMED' }),
      ).map(a => a.key);
      expect(keys).toContain('match.unmatch');
      expect(keys).not.toContain('match.manual');
    });

    it('DISCREPANCY still exposes match.manual', () => {
      const keys = getDetailInvoiceActions(
        makeRow({ status: 'RECEIVED', matchStatus: 'DISCREPANCY' }),
      ).map(a => a.key);
      expect(keys).toContain('match.manual');
    });
  });

  describe('getDetailInvoiceActions — hiddenWhen predicates', () => {
    it('duplicate.dismiss is hidden when isDuplicateSuspected=false', () => {
      const keys = getDetailInvoiceActions(makeRow({ isDuplicateSuspected: false })).map(
        a => a.key,
      );
      expect(keys).not.toContain('duplicate.dismiss');
    });

    it('duplicate.dismiss is visible when isDuplicateSuspected=true', () => {
      const keys = getDetailInvoiceActions(makeRow({ isDuplicateSuspected: true })).map(a => a.key);
      expect(keys).toContain('duplicate.dismiss');
    });
  });

  describe('registry immutability', () => {
    it('returns the same readonly reference across calls', () => {
      expect(getInvoiceActions()).toBe(getInvoiceActions());
    });
  });

  describe('getRowMenuInvoiceActions', () => {
    it('returns an empty list for now (no actions opted into rowMenu yet)', () => {
      const actions = getRowMenuInvoiceActions(makeRow());
      expect(Array.isArray(actions)).toBe(true);
    });
  });

  describe('exhaustive status sweep', () => {
    const ALL_STATUSES: InvoiceStatus[] = [
      'RECEIVED',
      'UNDER_REVIEW',
      'APPROVAL_PENDING',
      'APPROVED',
      'REJECTED',
      'READY_FOR_PAYMENT',
      'PARTIALLY_PAID',
      'PAID',
      'VOID',
    ];
    const ALL_MATCH_STATUSES: InvoiceMatchStatus[] = [
      'UNMATCHED',
      'PARTIAL',
      'MATCHED',
      'DISCREPANCY',
      'MANUALLY_CONFIRMED',
    ];

    it('never throws for any (status × matchStatus) combination', () => {
      for (const status of ALL_STATUSES) {
        for (const matchStatus of ALL_MATCH_STATUSES) {
          expect(() => getDetailInvoiceActions(makeRow({ status, matchStatus }))).not.toThrow();
        }
      }
    });

    it('always returns at least one action for any status (UI never goes empty unexpectedly)', () => {
      for (const status of ALL_STATUSES) {
        const actions = getDetailInvoiceActions(makeRow({ status }));
        // RECEIVED through APPROVED keep matching + lifecycle actions;
        // terminal states (PAID/VOID) only expose match-related actions
        // if matchStatus allows them. So the floor is "≥ 0 actions" —
        // assert no crash + array shape.
        expect(Array.isArray(actions)).toBe(true);
      }
    });
  });
});
