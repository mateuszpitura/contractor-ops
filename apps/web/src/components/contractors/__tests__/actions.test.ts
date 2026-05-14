import { describe, expect, it } from 'vitest';
import type { ContractorLifecycleStage, ContractorRowLike } from '../actions';
import {
  getBulkContractorActions,
  getContractorActions,
  getProfileContractorActions,
  getRowMenuContractorActions,
} from '../actions';

function makeRow(stage: ContractorLifecycleStage): ContractorRowLike {
  return { id: 'c1', lifecycleStage: stage };
}

describe('contractor actions registry', () => {
  describe('getContractorActions', () => {
    it('returns a non-empty list', () => {
      const actions = getContractorActions();
      expect(actions.length).toBeGreaterThan(0);
    });

    it('every action has a stable unique key', () => {
      const keys = getContractorActions().map(a => a.key);
      expect(new Set(keys).size).toBe(keys.length);
    });

    it('every action declares at least one surface', () => {
      for (const a of getContractorActions()) {
        expect(a.surfaces.length).toBeGreaterThan(0);
      }
    });

    it('every action has labelKey + i18nNamespace + icon', () => {
      for (const a of getContractorActions()) {
        expect(a.labelKey).toBeTruthy();
        expect(a.i18nNamespace).toBeTruthy();
        expect(a.icon).toBeTruthy();
      }
    });
  });

  describe('getBulkContractorActions', () => {
    it('includes archive, export, assign owner, launch workflow', () => {
      const keys = getBulkContractorActions().map(a => a.key);
      expect(keys).toEqual(
        expect.arrayContaining(['archive', 'bulk.export', 'bulk.assignOwner', 'launchWorkflow']),
      );
    });

    it('excludes single-row-only actions like edit', () => {
      const keys = getBulkContractorActions().map(a => a.key);
      expect(keys).not.toContain('edit');
      expect(keys).not.toContain('profile.archive');
    });

    it('archive bulk action is marked destructive', () => {
      const archive = getBulkContractorActions().find(a => a.key === 'archive');
      expect(archive?.variant).toBe('destructive');
    });
  });

  describe('getProfileContractorActions — lifecycle filtering', () => {
    it('DRAFT exposes startOnboarding and hides activate/offboarding', () => {
      const keys = getProfileContractorActions(makeRow('DRAFT')).map(a => a.key);
      expect(keys).toContain('lifecycle.startOnboarding');
      expect(keys).not.toContain('lifecycle.activate');
      expect(keys).not.toContain('lifecycle.startOffboarding');
      expect(keys).not.toContain('lifecycle.completeOffboarding');
      expect(keys).not.toContain('lifecycle.markInactive');
    });

    it('ONBOARDING exposes activate only (of lifecycle transitions)', () => {
      const keys = getProfileContractorActions(makeRow('ONBOARDING')).map(a => a.key);
      expect(keys).toContain('lifecycle.activate');
      expect(keys).not.toContain('lifecycle.startOnboarding');
      expect(keys).not.toContain('lifecycle.startOffboarding');
    });

    it('ACTIVE exposes startOffboarding + markInactive', () => {
      const keys = getProfileContractorActions(makeRow('ACTIVE')).map(a => a.key);
      expect(keys).toContain('lifecycle.startOffboarding');
      expect(keys).toContain('lifecycle.markInactive');
      expect(keys).not.toContain('lifecycle.activate');
    });

    it('OFFBOARDING exposes completeOffboarding', () => {
      const keys = getProfileContractorActions(makeRow('OFFBOARDING')).map(a => a.key);
      expect(keys).toContain('lifecycle.completeOffboarding');
      expect(keys).not.toContain('lifecycle.startOffboarding');
    });

    it('ENDED is the only stage that exposes the profile archive action', () => {
      for (const stage of ['DRAFT', 'ONBOARDING', 'ACTIVE', 'OFFBOARDING'] as const) {
        const keys = getProfileContractorActions(makeRow(stage)).map(a => a.key);
        expect(keys).not.toContain('profile.archive');
      }
      const endedKeys = getProfileContractorActions(makeRow('ENDED')).map(a => a.key);
      expect(endedKeys).toContain('profile.archive');
    });

    it('edit + addContract are always visible regardless of stage', () => {
      for (const stage of ['DRAFT', 'ONBOARDING', 'ACTIVE', 'OFFBOARDING', 'ENDED'] as const) {
        const keys = getProfileContractorActions(makeRow(stage)).map(a => a.key);
        expect(keys).toContain('edit');
        expect(keys).toContain('addContract');
      }
    });

    it('excludes bulk-only actions on profile surface', () => {
      const keys = getProfileContractorActions(makeRow('ACTIVE')).map(a => a.key);
      expect(keys).not.toContain('bulk.assignOwner');
      expect(keys).not.toContain('bulk.export');
      expect(keys).not.toContain('archive'); // bulk archive
    });
  });

  describe('getRowMenuContractorActions', () => {
    it('mirrors profile filtering (stage-aware)', () => {
      const profileKeys = getProfileContractorActions(makeRow('ACTIVE')).map(a => a.key);
      const rowMenuKeys = getRowMenuContractorActions(makeRow('ACTIVE')).map(a => a.key);
      // Both surfaces share the same stage-gated single-row actions.
      for (const key of profileKeys) {
        expect(rowMenuKeys).toContain(key);
      }
    });
  });
});
