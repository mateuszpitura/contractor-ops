import { act, renderHook, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useIsMobile } from '../use-mobile';

describe('useIsMobile', () => {
  let innerWidth = 1024;
  let mediaChangeHandler: (() => void) | undefined;

  beforeEach(() => {
    innerWidth = 1024;
    mediaChangeHandler = undefined;
    vi.stubGlobal(
      'matchMedia',
      vi.fn((_query: string) => ({
        get matches() {
          return innerWidth < 768;
        },
        media: '',
        addEventListener: (_type: string, cb: () => void) => {
          mediaChangeHandler = cb;
        },
        removeEventListener: vi.fn(),
        dispatchEvent: vi.fn(),
      })),
    );
    Object.defineProperty(window, 'innerWidth', {
      configurable: true,
      get: () => innerWidth,
    });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('returns true when viewport width is below 768px', async () => {
    innerWidth = 320;
    const { result } = renderHook(() => useIsMobile());
    await waitFor(() => {
      expect(result.current).toBe(true);
    });
  });

  it('returns false when viewport width is at or above 768px', async () => {
    innerWidth = 1024;
    const { result } = renderHook(() => useIsMobile());
    await waitFor(() => {
      expect(result.current).toBe(false);
    });
  });

  it('updates when matchMedia change fires after resize', async () => {
    innerWidth = 1024;
    const { result } = renderHook(() => useIsMobile());
    await waitFor(() => expect(result.current).toBe(false));

    innerWidth = 400;
    act(() => {
      mediaChangeHandler?.();
    });

    await waitFor(() => {
      expect(result.current).toBe(true);
    });
  });

  it('calls removeEventListener on unmount', async () => {
    const removeEventListener = vi.fn();
    vi.stubGlobal(
      'matchMedia',
      vi.fn((_query: string) => ({
        get matches() {
          return innerWidth < 768;
        },
        media: '',
        addEventListener: (_type: string, cb: () => void) => {
          mediaChangeHandler = cb;
        },
        removeEventListener,
        dispatchEvent: vi.fn(),
      })),
    );

    const { unmount } = renderHook(() => useIsMobile());
    unmount();

    expect(removeEventListener).toHaveBeenCalledWith('change', expect.any(Function));
  });
});
