/**
 * Hook spec for `useCountryComplianceForm` — the local-form-state hook the
 * country-compliance container delegates to. Pure react `useState` boundary,
 * no React Query, no tRPC. Renders via @testing-library/react's
 * `renderHook` (no provider needed).
 */

import { act, renderHook } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { useCountryComplianceForm } from '../use-country-compliance.js';

describe('useCountryComplianceForm', () => {
  it('initialises with an empty form-data object (loading / empty parity)', () => {
    const { result } = renderHook(() => useCountryComplianceForm());

    expect(result.current.formData).toEqual({});
    expect(typeof result.current.setFormData).toBe('function');
  });

  it('accepts a partial patch via the setter (success path)', () => {
    const { result } = renderHook(() => useCountryComplianceForm());

    act(() => {
      result.current.setFormData(prev => ({ ...prev, vatNumber: 'DE123456789' }));
    });

    expect(result.current.formData).toEqual({ vatNumber: 'DE123456789' });
  });

  it('merges successive patches without dropping earlier keys (compound edit)', () => {
    const { result } = renderHook(() => useCountryComplianceForm());

    act(() => {
      result.current.setFormData(prev => ({ ...prev, vatNumber: 'DE1' }));
    });
    act(() => {
      result.current.setFormData(prev => ({ ...prev, taxId: 'TX9' }));
    });

    expect(result.current.formData).toEqual({ vatNumber: 'DE1', taxId: 'TX9' });
  });

  it('replaces state when the setter passes a fresh object (error/reset path)', () => {
    const { result } = renderHook(() => useCountryComplianceForm());

    act(() => {
      result.current.setFormData({ vatNumber: 'DE1' });
    });
    act(() => {
      result.current.setFormData({});
    });

    expect(result.current.formData).toEqual({});
  });
});
