import { act, renderHook } from '@testing-library/react';
import {
  BreadcrumbProvider,
  useBreadcrumbContext,
  useBreadcrumbOverride,
} from '../breadcrumb-context';

describe('BreadcrumbProvider', () => {
  it('provides default empty overrides', () => {
    const { result } = renderHook(() => useBreadcrumbContext(), {
      wrapper: BreadcrumbProvider,
    });
    expect(result.current.overrides.size).toBe(0);
  });

  it('allows setting overrides', () => {
    const { result } = renderHook(() => useBreadcrumbContext(), {
      wrapper: BreadcrumbProvider,
    });
    act(() => {
      result.current.setOverride({ segment: 'abc123', label: 'Acme Corp' });
    });
    expect(result.current.overrides.get('abc123')?.label).toBe('Acme Corp');
  });

  it('does not update if same label is set', () => {
    const { result } = renderHook(() => useBreadcrumbContext(), {
      wrapper: BreadcrumbProvider,
    });
    act(() => {
      result.current.setOverride({ segment: 'abc', label: 'Test' });
    });
    const overrides1 = result.current.overrides;
    act(() => {
      result.current.setOverride({ segment: 'abc', label: 'Test' });
    });
    expect(result.current.overrides).toBe(overrides1);
  });
});

describe('useBreadcrumbOverride', () => {
  it('sets override on mount', () => {
    const { result } = renderHook(
      () => {
        const ctx = useBreadcrumbContext();
        useBreadcrumbOverride('seg1', 'Label 1');
        return ctx;
      },
      { wrapper: BreadcrumbProvider },
    );
    expect(result.current.overrides.get('seg1')?.label).toBe('Label 1');
  });

  it('does not set override when segment is undefined', () => {
    const { result } = renderHook(
      () => {
        const ctx = useBreadcrumbContext();
        useBreadcrumbOverride(undefined, 'Label');
        return ctx;
      },
      { wrapper: BreadcrumbProvider },
    );
    expect(result.current.overrides.size).toBe(0);
  });
});
