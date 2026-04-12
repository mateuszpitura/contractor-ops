import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useDoubleConfirmation } from '../use-double-confirmation';

describe('useDoubleConfirmation', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('starts with isConfirming = false', () => {
    const onConfirm = vi.fn();
    const { result } = renderHook(() => useDoubleConfirmation(onConfirm));
    expect(result.current.isConfirming).toBe(false);
  });

  it('first click sets isConfirming to true without calling onConfirm', () => {
    const onConfirm = vi.fn();
    const { result } = renderHook(() => useDoubleConfirmation(onConfirm));

    act(() => {
      result.current.handleClick();
    });

    expect(result.current.isConfirming).toBe(true);
    expect(onConfirm).not.toHaveBeenCalled();
  });

  it('second click within timeout calls onConfirm and resets', () => {
    const onConfirm = vi.fn();
    const { result } = renderHook(() => useDoubleConfirmation(onConfirm));

    act(() => {
      result.current.handleClick();
    });
    act(() => {
      result.current.handleClick();
    });

    expect(onConfirm).toHaveBeenCalledOnce();
    expect(result.current.isConfirming).toBe(false);
  });

  it('resets isConfirming after timeout expires', () => {
    const onConfirm = vi.fn();
    const { result } = renderHook(() => useDoubleConfirmation(onConfirm, 2000));

    act(() => {
      result.current.handleClick();
    });
    expect(result.current.isConfirming).toBe(true);

    act(() => {
      vi.advanceTimersByTime(2000);
    });

    expect(result.current.isConfirming).toBe(false);
    expect(onConfirm).not.toHaveBeenCalled();
  });

  it('cancel resets isConfirming immediately', () => {
    const onConfirm = vi.fn();
    const { result } = renderHook(() => useDoubleConfirmation(onConfirm));

    act(() => {
      result.current.handleClick();
    });
    expect(result.current.isConfirming).toBe(true);

    act(() => {
      result.current.cancel();
    });

    expect(result.current.isConfirming).toBe(false);
    expect(onConfirm).not.toHaveBeenCalled();
  });

  it('uses default delay of 3000ms', () => {
    const onConfirm = vi.fn();
    const { result } = renderHook(() => useDoubleConfirmation(onConfirm));

    act(() => {
      result.current.handleClick();
    });

    act(() => {
      vi.advanceTimersByTime(2999);
    });
    expect(result.current.isConfirming).toBe(true);

    act(() => {
      vi.advanceTimersByTime(1);
    });
    expect(result.current.isConfirming).toBe(false);
  });
});
