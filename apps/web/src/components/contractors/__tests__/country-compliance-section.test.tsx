// Plan 06 — CountryComplianceSection dispatch (FOUND-01/-02 + D-14).
//
// Verifies the section extension in place (no new tab, no abstraction refactor):
//   * countryCode='GB' renders UkComplianceFields
//   * countryCode='DE' renders DeComplianceFields
//   * countryCode='AE' / 'SA' branches still dispatch their legacy inline
//     field sets — ensuring Phase 47 behaviour is not regressed.

import { describe, expect, it, vi } from 'vitest';

import { render, screen } from '@/test/test-utils';

// Default tRPC stub — individual tests override getCountryFieldsConfig data.
const mockConfigData: {
  value: { hasCountryFields: boolean; countryCode?: string; fields?: string[] };
} = { value: { hasCountryFields: true, countryCode: 'GB', fields: [] } };

vi.mock('@/trpc/init', () => ({
  trpc: {
    contractor: {
      getCountryFieldsConfig: {
        useQuery: () => ({ isLoading: false, data: mockConfigData.value }),
      },
      getCountryFields: {
        useQuery: () => ({
          isLoading: false,
          data: {},
          refetch: vi.fn(),
        }),
      },
      updateCountryFields: {
        useMutation: () => ({ mutate: vi.fn(), isPending: false }),
      },
    },
  },
}));

vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

// Import after the mock so `trpc` is the mocked module.
import { CountryComplianceSection } from '../country-compliance-section';

describe('CountryComplianceSection — GB/DE dispatch (Plan 06)', () => {
  it('renders the UK field group when countryCode=GB', () => {
    mockConfigData.value = { hasCountryFields: true, countryCode: 'GB' };
    render(<CountryComplianceSection contractorId="contractor-1" />);
    // UK-specific legend and UTR input exist
    expect(screen.getByLabelText(/UTR/i)).toBeInTheDocument();
    expect(screen.getByText(/United Kingdom/i)).toBeInTheDocument();
  });

  it('renders the DE field group when countryCode=DE', () => {
    mockConfigData.value = { hasCountryFields: true, countryCode: 'DE' };
    render(<CountryComplianceSection contractorId="contractor-1" />);
    expect(screen.getByRole('combobox', { name: /Bundesland/i })).toBeInTheDocument();
    expect(screen.getByText(/Deutschland/)).toBeInTheDocument();
  });

  it('keeps the legacy AE branch intact', () => {
    mockConfigData.value = { hasCountryFields: true, countryCode: 'AE' };
    render(<CountryComplianceSection contractorId="contractor-1" />);
    expect(screen.getByLabelText(/Freelance Permit Number/i)).toBeInTheDocument();
    expect(screen.getByText(/UAE/)).toBeInTheDocument();
  });

  it('keeps the legacy SA branch intact', () => {
    mockConfigData.value = { hasCountryFields: true, countryCode: 'SA' };
    render(<CountryComplianceSection contractorId="contractor-1" />);
    expect(screen.getByLabelText(/Freelance\.sa License/i)).toBeInTheDocument();
    expect(screen.getByText(/Saudi Arabia/)).toBeInTheDocument();
  });

  it('returns nothing when org has no country fields', () => {
    mockConfigData.value = { hasCountryFields: false };
    const { container } = render(<CountryComplianceSection contractorId="contractor-1" />);
    expect(container.textContent).toBe('');
  });
});
