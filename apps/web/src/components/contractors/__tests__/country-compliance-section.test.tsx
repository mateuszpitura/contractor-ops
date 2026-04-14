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

type EngagementRow = {
  id: string;
  contractorId: string;
  activeFrom: Date | null;
  activeTo: Date | null;
  status: string;
  contractor: { id: string; displayName: string; countryCode: string };
  project: { id: string; name: string };
};
const mockEngagements: { value: EngagementRow[] } = { value: [] };

vi.mock('@/trpc/init', () => ({
  trpc: {
    useUtils: () => ({
      contractor: {
        getById: { invalidate: vi.fn() },
      },
    }),
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
      getById: {
        useQuery: () => ({ isLoading: false, data: null }),
      },
      listEngagements: {
        useQuery: () => ({ isLoading: false, data: mockEngagements.value }),
      },
      updateCountryFields: {
        useMutation: () => ({ mutate: vi.fn(), isPending: false }),
      },
      revalidateVat: {
        useMutation: () => ({ mutate: vi.fn(), isPending: false }),
      },
    },
    classification: {
      getLatest: {
        useQuery: () => ({ isPending: false, data: null }),
        queryOptions: (input: { contractorAssignmentId: string }) => ({
          queryKey: [['classification', 'getLatest'], input],
          queryFn: async () => null,
        }),
      },
    },
  },
}));

vi.mock('@/i18n/navigation', () => ({
  useRouter: () => ({ push: vi.fn() }),
  Link: ({ href, children, ...rest }: { href: string; children: React.ReactNode }) => (
    <a href={href} {...rest}>
      {children}
    </a>
  ),
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

describe('CountryComplianceSection — Phase 58 classification extension (CCS-1..4)', () => {
  it('CCS-1 GB dispatch: renders 2 ClassificationTile for 2 GB engagements', () => {
    mockConfigData.value = { hasCountryFields: true, countryCode: 'GB' };
    mockEngagements.value = [
      {
        id: 'e1',
        contractorId: 'contractor-1',
        activeFrom: new Date(),
        activeTo: null,
        status: 'active',
        contractor: { id: 'contractor-1', displayName: 'Alice', countryCode: 'GB' },
        project: { id: 'p1', name: 'Widgets' },
      },
      {
        id: 'e2',
        contractorId: 'contractor-1',
        activeFrom: new Date(),
        activeTo: null,
        status: 'active',
        contractor: { id: 'contractor-1', displayName: 'Alice', countryCode: 'GB' },
        project: { id: 'p2', name: 'Gadgets' },
      },
    ];
    render(<CountryComplianceSection contractorId="contractor-1" />);
    expect(screen.getAllByTestId('classification-tile')).toHaveLength(2);
  });

  it('CCS-2 DE dispatch: renders 2 ClassificationTile for 2 DE engagements', () => {
    mockConfigData.value = { hasCountryFields: true, countryCode: 'DE' };
    mockEngagements.value = [
      {
        id: 'e1',
        contractorId: 'contractor-1',
        activeFrom: new Date(),
        activeTo: null,
        status: 'active',
        contractor: { id: 'contractor-1', displayName: 'Bob', countryCode: 'DE' },
        project: { id: 'p1', name: 'Lager' },
      },
      {
        id: 'e2',
        contractorId: 'contractor-1',
        activeFrom: new Date(),
        activeTo: null,
        status: 'active',
        contractor: { id: 'contractor-1', displayName: 'Bob', countryCode: 'DE' },
        project: { id: 'p2', name: 'Werkstatt' },
      },
    ];
    render(<CountryComplianceSection contractorId="contractor-1" />);
    expect(screen.getAllByTestId('classification-tile')).toHaveLength(2);
  });

  it('CCS-3 non-GB/DE: engagements with FR countryCode render no ClassificationTile', () => {
    mockConfigData.value = { hasCountryFields: true, countryCode: 'GB' };
    mockEngagements.value = [
      {
        id: 'e1',
        contractorId: 'contractor-1',
        activeFrom: new Date(),
        activeTo: null,
        status: 'active',
        contractor: { id: 'contractor-1', displayName: 'Carol', countryCode: 'FR' },
        project: { id: 'p1', name: 'Something' },
      },
    ];
    render(<CountryComplianceSection contractorId="contractor-1" />);
    expect(screen.queryByTestId('classification-tile')).toBeNull();
    // Regression guard — existing Phase 56 UK input still renders.
    expect(screen.getByLabelText(/UTR/i)).toBeInTheDocument();
  });

  it('CCS-4 mixed: one GB + one FR engagement → exactly 1 ClassificationTile', () => {
    mockConfigData.value = { hasCountryFields: true, countryCode: 'GB' };
    mockEngagements.value = [
      {
        id: 'e1',
        contractorId: 'contractor-1',
        activeFrom: new Date(),
        activeTo: null,
        status: 'active',
        contractor: { id: 'contractor-1', displayName: 'Dana', countryCode: 'GB' },
        project: { id: 'p1', name: 'One' },
      },
      {
        id: 'e2',
        contractorId: 'contractor-1',
        activeFrom: new Date(),
        activeTo: null,
        status: 'active',
        contractor: { id: 'contractor-1', displayName: 'Dana', countryCode: 'FR' },
        project: { id: 'p2', name: 'Two' },
      },
    ];
    render(<CountryComplianceSection contractorId="contractor-1" />);
    expect(screen.getAllByTestId('classification-tile')).toHaveLength(1);
  });
});
