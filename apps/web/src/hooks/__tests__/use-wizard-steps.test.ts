import { act, renderHook } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { useWizardSteps } from '../use-wizard-steps';

describe('useWizardSteps', () => {
  it('starts at step 0 with isFirst=true', () => {
    const { result } = renderHook(() => useWizardSteps(3));
    expect(result.current.currentStep).toBe(0);
    expect(result.current.isFirst).toBe(true);
    expect(result.current.isLast).toBe(false);
  });

  it('goNext advances the step', () => {
    const { result } = renderHook(() => useWizardSteps(3));

    act(() => {
      result.current.goNext();
    });
    expect(result.current.currentStep).toBe(1);
    expect(result.current.isFirst).toBe(false);
    expect(result.current.isLast).toBe(false);
  });

  it('goNext clamps at the last step', () => {
    const { result } = renderHook(() => useWizardSteps(2));

    act(() => {
      result.current.goNext();
    });
    expect(result.current.currentStep).toBe(1);
    expect(result.current.isLast).toBe(true);

    act(() => {
      result.current.goNext();
    });
    expect(result.current.currentStep).toBe(1);
  });

  it('goBack decrements the step', () => {
    const { result } = renderHook(() => useWizardSteps(3));

    act(() => {
      result.current.goNext();
      result.current.goNext();
    });
    expect(result.current.currentStep).toBe(2);

    act(() => {
      result.current.goBack();
    });
    expect(result.current.currentStep).toBe(1);
  });

  it('goBack clamps at 0', () => {
    const { result } = renderHook(() => useWizardSteps(3));

    act(() => {
      result.current.goBack();
    });
    expect(result.current.currentStep).toBe(0);
    expect(result.current.isFirst).toBe(true);
  });

  it('goTo jumps to a specific step within bounds', () => {
    const { result } = renderHook(() => useWizardSteps(5));

    act(() => {
      result.current.goTo(3);
    });
    expect(result.current.currentStep).toBe(3);
  });

  it('goTo clamps out-of-range values', () => {
    const { result } = renderHook(() => useWizardSteps(3));

    act(() => {
      result.current.goTo(10);
    });
    expect(result.current.currentStep).toBe(2);

    act(() => {
      result.current.goTo(-5);
    });
    expect(result.current.currentStep).toBe(0);
  });

  it('reset returns to step 0', () => {
    const { result } = renderHook(() => useWizardSteps(3));

    act(() => {
      result.current.goTo(2);
    });
    expect(result.current.currentStep).toBe(2);

    act(() => {
      result.current.reset();
    });
    expect(result.current.currentStep).toBe(0);
    expect(result.current.isFirst).toBe(true);
  });

  it('handles single-step wizard', () => {
    const { result } = renderHook(() => useWizardSteps(1));
    expect(result.current.isFirst).toBe(true);
    expect(result.current.isLast).toBe(true);

    act(() => {
      result.current.goNext();
    });
    expect(result.current.currentStep).toBe(0);
  });
});
