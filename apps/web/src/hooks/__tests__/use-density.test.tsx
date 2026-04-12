import { act, renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

describe('useDensity', () => {
  beforeEach(() => {
    vi.resetModules();
    localStorage.clear();
    document.documentElement.classList.remove('density-compact');
  });

  it('setDensity(compact) adds density-compact on html', async () => {
    const { useDensity } = await import('../use-density');
    const { result } = renderHook(() => useDensity());
    act(() => result.current.setDensity('compact'));
    expect(document.documentElement.classList.contains('density-compact')).toBe(true);
  });

  it('setDensity(comfortable) removes density-compact', async () => {
    const { useDensity } = await import('../use-density');
    const { result } = renderHook(() => useDensity());
    act(() => result.current.setDensity('compact'));
    act(() => result.current.setDensity('comfortable'));
    expect(document.documentElement.classList.contains('density-compact')).toBe(false);
  });

  it('toggleDensity switches between comfortable and compact', async () => {
    const { useDensity } = await import('../use-density');
    const { result } = renderHook(() => useDensity());
    expect(result.current.density).toBe('comfortable');
    act(() => result.current.toggleDensity());
    expect(result.current.density).toBe('compact');
    act(() => result.current.toggleDensity());
    expect(result.current.density).toBe('comfortable');
  });
});
