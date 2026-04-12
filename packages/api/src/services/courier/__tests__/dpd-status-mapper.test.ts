import { describe, expect, it, vi } from 'vitest';

import { DPD_STATUS_MAP, mapDpdStatus } from '../dpd-status-mapper';

// ---------------------------------------------------------------------------
// DPD Status Mapper Tests
// ---------------------------------------------------------------------------

describe('DPD Status Mapper', () => {
  describe('DPD_STATUS_MAP', () => {
    it('covers at least 8 DPD statuses', () => {
      expect(Object.keys(DPD_STATUS_MAP).length).toBeGreaterThanOrEqual(8);
    });

    it('maps DEP_DELIVERED to DELIVERED', () => {
      expect(DPD_STATUS_MAP.DEP_DELIVERED).toBe('DELIVERED');
    });

    it('maps DEP_IN_DELIVERY to OUT_FOR_DELIVERY', () => {
      expect(DPD_STATUS_MAP.DEP_IN_DELIVERY).toBe('OUT_FOR_DELIVERY');
    });

    it('maps DEP_IN_TRANSIT to IN_TRANSIT', () => {
      expect(DPD_STATUS_MAP.DEP_IN_TRANSIT).toBe('IN_TRANSIT');
    });

    it('maps DEP_COLLECTED to PICKED_UP', () => {
      expect(DPD_STATUS_MAP.DEP_COLLECTED).toBe('PICKED_UP');
    });

    it('maps DEP_ACCEPTED to CREATED', () => {
      expect(DPD_STATUS_MAP.DEP_ACCEPTED).toBe('CREATED');
    });

    it('maps DEP_RETURNED to RETURNED', () => {
      expect(DPD_STATUS_MAP.DEP_RETURNED).toBe('RETURNED');
    });

    it('maps DEP_REFUSED to FAILED', () => {
      expect(DPD_STATUS_MAP.DEP_REFUSED).toBe('FAILED');
    });

    it('maps DEP_LOST to FAILED', () => {
      expect(DPD_STATUS_MAP.DEP_LOST).toBe('FAILED');
    });

    it('maps DEP_PICKUP_ARRANGED to LABEL_GENERATED', () => {
      expect(DPD_STATUS_MAP.DEP_PICKUP_ARRANGED).toBe('LABEL_GENERATED');
    });
  });

  describe('mapDpdStatus', () => {
    it('returns mapped status for known DPD status', () => {
      expect(mapDpdStatus('DEP_DELIVERED')).toBe('DELIVERED');
    });

    it('returns null for unknown status and logs warning', () => {
      const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
      const result = mapDpdStatus('UNKNOWN_STATUS');
      expect(result).toBeNull();
      expect(warnSpy).toHaveBeenCalledWith(expect.stringContaining('Unknown DPD status'));
      warnSpy.mockRestore();
    });
  });
});
