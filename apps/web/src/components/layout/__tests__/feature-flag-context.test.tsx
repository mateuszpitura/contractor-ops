import { renderHook } from '@testing-library/react';
import type { ReactNode } from 'react';
import { FeatureFlagProvider, useFlag, useFlagBag } from '../feature-flag-context';

vi.mock('@contractor-ops/feature-flags', () => ({
  // Minimal type stubs
}));

const mockBag = {
  enablePeppol: true,
  enableKsef: false,
  enablePortalInvoiceSubmit: true,
} as Record<string, boolean>;

function createWrapper() {
  return function Wrapper({ children }: { children: ReactNode }) {
    return <FeatureFlagProvider bag={mockBag as never}>{children}</FeatureFlagProvider>;
  };
}

describe('FeatureFlagProvider', () => {
  it('provides flag bag to consumers', () => {
    const { result } = renderHook(() => useFlagBag(), {
      wrapper: createWrapper(),
    });
    expect(result.current).toEqual(mockBag);
  });

  it('useFlag returns correct value for enabled flag', () => {
    const { result } = renderHook(() => useFlag('enablePeppol' as never), {
      wrapper: createWrapper(),
    });
    expect(result.current).toBe(true);
  });

  it('useFlag returns correct value for disabled flag', () => {
    const { result } = renderHook(() => useFlag('enableKsef' as never), {
      wrapper: createWrapper(),
    });
    expect(result.current).toBe(false);
  });

  it('useFlagBag throws when used outside provider', () => {
    expect(() => {
      renderHook(() => useFlagBag());
    }).toThrow('useFlagBag must be used within a FeatureFlagProvider');
  });

  it('useFlag throws when used outside provider', () => {
    expect(() => {
      renderHook(() => useFlag('enablePeppol' as never));
    }).toThrow('useFlagBag must be used within a FeatureFlagProvider');
  });
});
