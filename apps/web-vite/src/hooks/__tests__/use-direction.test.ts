import { renderHook } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { useLocale } from '../../i18n/navigation.js';
import { useDirection } from '../use-direction.js';

vi.mock('../../i18n/navigation.js', () => ({
  useLocale: vi.fn(),
}));

describe('useDirection', () => {
  it('returns rtl for ar locale', () => {
    vi.mocked(useLocale).mockReturnValue('ar');
    const { result } = renderHook(() => useDirection());
    expect(result.current).toBe('rtl');
  });

  it('returns ltr for en locale', () => {
    vi.mocked(useLocale).mockReturnValue('en');
    const { result } = renderHook(() => useDirection());
    expect(result.current).toBe('ltr');
  });
});
