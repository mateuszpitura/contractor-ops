/**
 * Step 10 port of apps/web/src/components/contracts/__tests__/actions.test.ts.
 *
 * The contract actions registry is the gate that decides when
 * "Send for Signature" (e-sign initiation), supersede, terminate, and
 * delete appear on each surface — the canonical source of truth for the
 * detail header, bulk toolbar, and row menu. Pure logic, no rendering.
 */

import { describe, expect, it } from 'vitest';
import type { ContractRowLike, ContractStatus } from '../actions.js';
import {
  getBulkContractActions,
  getContractActions,
  getDetailContractActions,
  getRowMenuContractActions,
} from '../actions.js';

function makeRow(status: ContractStatus | string): ContractRowLike {
  return { id: 'k1', status };
}

describe('contract actions registry', () => {
  describe('getContractActions', () => {
    it('returns a non-empty list', () => {
      expect(getContractActions().length).toBeGreaterThan(0);
    });

    it('every action has a stable unique key', () => {
      const keys = getContractActions().map(a => a.key);
      expect(new Set(keys).size).toBe(keys.length);
    });

    it('every action declares at least one surface', () => {
      for (const a of getContractActions()) {
        expect(a.surfaces.length).toBeGreaterThan(0);
      }
    });

    it('every action has labelKey + i18nNamespace + icon', () => {
      for (const a of getContractActions()) {
        expect(a.labelKey).toBeTruthy();
        expect(a.i18nNamespace).toBeTruthy();
        expect(a.icon).toBeTruthy();
      }
    });
  });

  describe('getBulkContractActions', () => {
    it('includes export and terminate', () => {
      const keys = getBulkContractActions().map(a => a.key);
      expect(keys).toEqual(expect.arrayContaining(['bulk.export', 'bulk.terminate']));
    });

    it('excludes single-row-only actions like edit', () => {
      const keys = getBulkContractActions().map(a => a.key);
      expect(keys).not.toContain('edit');
      expect(keys).not.toContain('terminate');
      expect(keys).not.toContain('sendForSignature');
      expect(keys).not.toContain('delete');
    });

    it('bulk terminate is marked destructive', () => {
      const action = getBulkContractActions().find(a => a.key === 'bulk.terminate');
      expect(action?.variant).toBe('destructive');
    });
  });

  describe('getDetailContractActions — status filtering', () => {
    it('DRAFT exposes sendForSignature + terminate + edit but hides supersede/addAmendment', () => {
      const keys = getDetailContractActions(makeRow('DRAFT')).map(a => a.key);
      expect(keys).toContain('edit');
      expect(keys).toContain('sendForSignature');
      expect(keys).toContain('terminate');
      expect(keys).not.toContain('supersede');
      expect(keys).not.toContain('addAmendment');
    });

    it('PENDING_SIGNATURE exposes terminate but hides sendForSignature/supersede/addAmendment', () => {
      const keys = getDetailContractActions(makeRow('PENDING_SIGNATURE')).map(a => a.key);
      expect(keys).toContain('terminate');
      expect(keys).not.toContain('sendForSignature');
      expect(keys).not.toContain('supersede');
      expect(keys).not.toContain('addAmendment');
    });

    it('ACTIVE exposes addAmendment + terminate + supersede; hides sendForSignature', () => {
      const keys = getDetailContractActions(makeRow('ACTIVE')).map(a => a.key);
      expect(keys).toContain('addAmendment');
      expect(keys).toContain('terminate');
      expect(keys).toContain('supersede');
      expect(keys).not.toContain('sendForSignature');
    });

    it('EXPIRING exposes addAmendment + terminate + supersede', () => {
      const keys = getDetailContractActions(makeRow('EXPIRING')).map(a => a.key);
      expect(keys).toContain('addAmendment');
      expect(keys).toContain('terminate');
      expect(keys).toContain('supersede');
    });

    it('EXPIRED exposes terminate + supersede; hides addAmendment', () => {
      const keys = getDetailContractActions(makeRow('EXPIRED')).map(a => a.key);
      expect(keys).toContain('terminate');
      expect(keys).toContain('supersede');
      expect(keys).not.toContain('addAmendment');
    });

    it('TERMINATED exposes neither terminate nor supersede', () => {
      const keys = getDetailContractActions(makeRow('TERMINATED')).map(a => a.key);
      expect(keys).not.toContain('terminate');
      expect(keys).not.toContain('supersede');
      expect(keys).not.toContain('sendForSignature');
    });

    it('edit + uploadDocument are always visible regardless of status', () => {
      const statuses: readonly ContractStatus[] = [
        'DRAFT',
        'PENDING_SIGNATURE',
        'ACTIVE',
        'EXPIRING',
        'EXPIRED',
        'TERMINATED',
        'SUPERSEDED',
        'ARCHIVED',
      ];
      for (const status of statuses) {
        const keys = getDetailContractActions(makeRow(status)).map(a => a.key);
        expect(keys).toContain('edit');
        expect(keys).toContain('uploadDocument');
      }
    });

    it('excludes bulk-only actions on detail surface', () => {
      const keys = getDetailContractActions(makeRow('ACTIVE')).map(a => a.key);
      expect(keys).not.toContain('bulk.export');
      expect(keys).not.toContain('bulk.terminate');
    });

    it('row with unknown status hides stage-gated actions but keeps unconditional ones', () => {
      const keys = getDetailContractActions(makeRow('UNKNOWN_STATUS_FOO')).map(a => a.key);
      expect(keys).toContain('edit');
      expect(keys).toContain('uploadDocument');
      expect(keys).not.toContain('terminate');
      expect(keys).not.toContain('supersede');
      expect(keys).not.toContain('addAmendment');
      expect(keys).not.toContain('sendForSignature');
    });
  });

  describe('getRowMenuContractActions', () => {
    it('DRAFT exposes the delete row-menu action', () => {
      const keys = getRowMenuContractActions(makeRow('DRAFT')).map(a => a.key);
      expect(keys).toContain('delete');
    });

    it('non-DRAFT statuses hide the delete row-menu action', () => {
      for (const status of ['PENDING_SIGNATURE', 'ACTIVE', 'EXPIRED', 'TERMINATED'] as const) {
        const keys = getRowMenuContractActions(makeRow(status)).map(a => a.key);
        expect(keys).not.toContain('delete');
      }
    });

    it('excludes detail-only actions like sendForSignature', () => {
      const keys = getRowMenuContractActions(makeRow('DRAFT')).map(a => a.key);
      expect(keys).not.toContain('sendForSignature');
    });
  });
});
