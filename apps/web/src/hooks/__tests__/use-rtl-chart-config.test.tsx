import { renderHook } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

const mockUseLocale = vi.fn();

vi.mock('next-intl', () => ({
  useLocale: () => mockUseLocale(),
}));

import { useRtlChartConfig } from '../use-rtl-chart-config';

describe('useRtlChartConfig', () => {
  describe('LTR locale (en)', () => {
    it('returns isRtl as false', () => {
      mockUseLocale.mockReturnValue('en');
      const { result } = renderHook(() => useRtlChartConfig());
      expect(result.current.isRtl).toBe(false);
    });

    it('returns empty xAxisProps', () => {
      mockUseLocale.mockReturnValue('en');
      const { result } = renderHook(() => useRtlChartConfig());
      expect(result.current.xAxisProps).toEqual({});
    });

    it('returns empty yAxisProps', () => {
      mockUseLocale.mockReturnValue('en');
      const { result } = renderHook(() => useRtlChartConfig());
      expect(result.current.yAxisProps).toEqual({});
    });

    it('returns empty legendProps', () => {
      mockUseLocale.mockReturnValue('en');
      const { result } = renderHook(() => useRtlChartConfig());
      expect(result.current.legendProps).toEqual({});
    });

    it('returns empty chartStyle', () => {
      mockUseLocale.mockReturnValue('en');
      const { result } = renderHook(() => useRtlChartConfig());
      expect(result.current.chartStyle).toEqual({});
    });

    it('returns empty gridProps', () => {
      mockUseLocale.mockReturnValue('en');
      const { result } = renderHook(() => useRtlChartConfig());
      expect(result.current.gridProps).toEqual({});
    });

    it('returns empty tooltipProps', () => {
      mockUseLocale.mockReturnValue('en');
      const { result } = renderHook(() => useRtlChartConfig());
      expect(result.current.tooltipProps).toEqual({});
    });
  });

  describe('RTL locale (ar)', () => {
    it('returns isRtl as true', () => {
      mockUseLocale.mockReturnValue('ar');
      const { result } = renderHook(() => useRtlChartConfig());
      expect(result.current.isRtl).toBe(true);
    });

    it('returns reversed xAxisProps', () => {
      mockUseLocale.mockReturnValue('ar');
      const { result } = renderHook(() => useRtlChartConfig());
      expect(result.current.xAxisProps).toEqual({ reversed: true });
    });

    it('returns right-oriented yAxisProps', () => {
      mockUseLocale.mockReturnValue('ar');
      const { result } = renderHook(() => useRtlChartConfig());
      expect(result.current.yAxisProps).toEqual({ orientation: 'right' });
    });

    it('returns RTL legendProps with horizontal layout and right align', () => {
      mockUseLocale.mockReturnValue('ar');
      const { result } = renderHook(() => useRtlChartConfig());
      expect(result.current.legendProps).toEqual({
        layout: 'horizontal',
        align: 'right',
      });
    });

    it('returns RTL chartStyle with direction rtl', () => {
      mockUseLocale.mockReturnValue('ar');
      const { result } = renderHook(() => useRtlChartConfig());
      expect(result.current.chartStyle).toEqual({ direction: 'rtl' });
    });

    it('returns empty gridProps even for RTL', () => {
      mockUseLocale.mockReturnValue('ar');
      const { result } = renderHook(() => useRtlChartConfig());
      expect(result.current.gridProps).toEqual({});
    });

    it('returns empty tooltipProps even for RTL', () => {
      mockUseLocale.mockReturnValue('ar');
      const { result } = renderHook(() => useRtlChartConfig());
      expect(result.current.tooltipProps).toEqual({});
    });
  });

  describe('other LTR locales', () => {
    it.each(['de', 'pl', 'fr', 'es'])('returns LTR config for %s', (locale) => {
      mockUseLocale.mockReturnValue(locale);
      const { result } = renderHook(() => useRtlChartConfig());
      expect(result.current.isRtl).toBe(false);
      expect(result.current.xAxisProps).toEqual({});
      expect(result.current.yAxisProps).toEqual({});
      expect(result.current.chartStyle).toEqual({});
    });
  });
});
