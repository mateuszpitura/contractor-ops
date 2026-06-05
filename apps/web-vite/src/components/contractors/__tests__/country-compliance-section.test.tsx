/**
 * `CountryComplianceSectionView` takes the two hook returns
 * (`useCountryCompliance`, `useContractorEngagements`) as props. We mock
 * the two tRPC-bound child containers (classification tile, revalidate-vat)
 * and supply shaped stubs for the hook returns — verifies the
 * dispatch logic (GB/DE/AE/SA branches + engagement filtering).
 */

import { describe, expect, it, vi } from 'vitest';

vi.mock('../classification/classification-tile-container.js', () => ({
  ClassificationTileContainer: ({ engagement }: { engagement: { id: string } }) => (
    <div data-testid="classification-tile" data-engagement={engagement.id} />
  ),
}));

vi.mock('../revalidate-vat-button-container.js', () => ({
  RevalidateVatButtonContainer: () => <div data-testid="revalidate-vat" />,
}));

// The AE branch now mounts the tRPC-bound free-zone assignment surface (D-02);
// stub it like the other child containers so the dispatch test stays unit-scoped.
vi.mock('../free-zone/free-zone-assignment-container.js', () => ({
  FreeZoneAssignmentContainer: ({ contractorId }: { contractorId: string }) => (
    <div data-testid="free-zone-assignment" data-contractor={contractorId} />
  ),
}));

import { render, screen } from '../../../test/test-utils.js';
import { CountryComplianceSectionView } from '../country-compliance-section.js';
import type {
  useContractorEngagements,
  useCountryCompliance,
} from '../hooks/use-country-compliance.js';

type Compliance = ReturnType<typeof useCountryCompliance>;
type Engagements = ReturnType<typeof useContractorEngagements>;

interface ConfigShape {
  hasCountryFields: boolean;
  countryCode?: string;
  fields?: string[];
}

interface ComplianceOverrides {
  config?: ConfigShape;
  fields?: Record<string, unknown>;
  contractor?: { latestVatValidationStatus?: string | null; latestVatValidatedAt?: string | null };
  isLoading?: boolean;
  isPending?: boolean;
  saveFields?: ReturnType<typeof vi.fn>;
}

function buildCompliance(over: ComplianceOverrides = {}): Compliance {
  const saveFields = over.saveFields ?? vi.fn();
  const compliance = {
    configQuery: { data: over.config ?? { hasCountryFields: true, countryCode: 'GB', fields: [] } },
    fieldsQuery: { data: over.fields ?? {}, refetch: vi.fn() },
    contractorQuery: { data: over.contractor ?? null },
    updateMutation: { isPending: over.isPending ?? false, mutate: vi.fn() },
    saveFields,
    isLoading: over.isLoading ?? false,
  };
  return compliance as unknown as Compliance;
}

function buildEngagements(items: unknown[] = [], isLoading = false): Engagements {
  return {
    engagementsQuery: { data: items, isLoading },
    engagements: items,
    isLoading,
  } as unknown as Engagements;
}

describe('CountryComplianceSectionView — country dispatch', () => {
  it('renders nothing when org has no country fields', () => {
    const { container } = render(
      <CountryComplianceSectionView
        contractorId="contractor-1"
        compliance={buildCompliance({ config: { hasCountryFields: false } })}
        engagements={buildEngagements()}
        formData={{}}
        onFormDataChange={vi.fn()}
      />,
    );
    expect(container.textContent).toBe('');
  });

  it('renders a loader while compliance.isLoading=true', () => {
    const { container } = render(
      <CountryComplianceSectionView
        contractorId="contractor-1"
        compliance={buildCompliance({ isLoading: true })}
        engagements={buildEngagements()}
        formData={{}}
        onFormDataChange={vi.fn()}
      />,
    );
    expect(container.querySelector('.animate-spin')).toBeTruthy();
  });

  it('renders the GB field group when countryCode=GB', () => {
    render(
      <CountryComplianceSectionView
        contractorId="contractor-1"
        compliance={buildCompliance({ config: { hasCountryFields: true, countryCode: 'GB' } })}
        engagements={buildEngagements()}
        formData={{}}
        onFormDataChange={vi.fn()}
      />,
    );
    expect(screen.getByLabelText(/UTR/i)).toBeInTheDocument();
    expect(screen.getByText(/United Kingdom/i)).toBeInTheDocument();
  });

  it('renders the DE field group when countryCode=DE', () => {
    render(
      <CountryComplianceSectionView
        contractorId="contractor-1"
        compliance={buildCompliance({ config: { hasCountryFields: true, countryCode: 'DE' } })}
        engagements={buildEngagements()}
        formData={{}}
        onFormDataChange={vi.fn()}
      />,
    );
    expect(screen.getByText(/Germany/i)).toBeInTheDocument();
  });

  it('renders the AE field group when countryCode=AE', () => {
    render(
      <CountryComplianceSectionView
        contractorId="contractor-1"
        compliance={buildCompliance({ config: { hasCountryFields: true, countryCode: 'AE' } })}
        engagements={buildEngagements()}
        formData={{}}
        onFormDataChange={vi.fn()}
      />,
    );
    expect(screen.getByLabelText(/Freelance Permit Number/i)).toBeInTheDocument();
    expect(screen.getByText(/UAE/)).toBeInTheDocument();
    // D-02: the structured free-zone surface replaces the old freeform UAE inputs.
    expect(screen.getByTestId('free-zone-assignment')).toBeInTheDocument();
    expect(screen.queryByLabelText(/Trade License Number/i)).toBeNull();
  });

  it('renders the SA field group when countryCode=SA', () => {
    render(
      <CountryComplianceSectionView
        contractorId="contractor-1"
        compliance={buildCompliance({ config: { hasCountryFields: true, countryCode: 'SA' } })}
        engagements={buildEngagements()}
        formData={{}}
        onFormDataChange={vi.fn()}
      />,
    );
    expect(screen.getByLabelText(/Freelance\.sa License/i)).toBeInTheDocument();
    expect(screen.getByText(/Saudi Arabia/)).toBeInTheDocument();
  });

  it('renders the VAT validation section for GB', () => {
    render(
      <CountryComplianceSectionView
        contractorId="contractor-1"
        compliance={buildCompliance({ config: { hasCountryFields: true, countryCode: 'GB' } })}
        engagements={buildEngagements()}
        formData={{}}
        onFormDataChange={vi.fn()}
      />,
    );
    expect(screen.getByTestId('vat-validation-section')).toBeInTheDocument();
    expect(screen.getByTestId('revalidate-vat')).toBeInTheDocument();
  });

  it('does not render the VAT validation section for AE', () => {
    render(
      <CountryComplianceSectionView
        contractorId="contractor-1"
        compliance={buildCompliance({ config: { hasCountryFields: true, countryCode: 'AE' } })}
        engagements={buildEngagements()}
        formData={{}}
        onFormDataChange={vi.fn()}
      />,
    );
    expect(screen.queryByTestId('vat-validation-section')).toBeNull();
  });

  it('renders the missing-fields badge when configured fields are absent', () => {
    render(
      <CountryComplianceSectionView
        contractorId="contractor-1"
        compliance={buildCompliance({
          config: { hasCountryFields: true, countryCode: 'GB', fields: ['utr', 'companyNumber'] },
        })}
        engagements={buildEngagements()}
        formData={{}}
        onFormDataChange={vi.fn()}
      />,
    );
    expect(screen.getByText(/2 incomplete/)).toBeInTheDocument();
  });

  it('calls compliance.saveFields(countryCode, merged) when Save is clicked', () => {
    const saveFields = vi.fn();
    render(
      <CountryComplianceSectionView
        contractorId="contractor-1"
        compliance={buildCompliance({
          config: { hasCountryFields: true, countryCode: 'GB' },
          saveFields,
        })}
        engagements={buildEngagements()}
        formData={{ utr: '1234567890' }}
        onFormDataChange={vi.fn()}
      />,
    );
    screen.getByRole('button', { name: /Save Compliance Fields/i }).click();
    expect(saveFields).toHaveBeenCalledWith('GB', expect.objectContaining({ utr: '1234567890' }));
  });
});

describe('CountryComplianceSectionView — classification engagements block', () => {
  const sampleEngagement = (id: string, countryCode: string, projectName: string) => ({
    id,
    contractorId: 'contractor-1',
    activeFrom: new Date(),
    activeTo: null,
    status: 'active',
    contractor: { id: 'contractor-1', displayName: 'Alice', countryCode },
    project: { id: `p-${id}`, name: projectName },
  });

  it('renders a loading state while engagements.isLoading=true', () => {
    render(
      <CountryComplianceSectionView
        contractorId="contractor-1"
        compliance={buildCompliance()}
        engagements={buildEngagements([], true)}
        formData={{}}
        onFormDataChange={vi.fn()}
      />,
    );
    expect(screen.getByTestId('classification-engagements-loading')).toBeInTheDocument();
  });

  it('GB dispatch — renders 2 ClassificationTile for 2 GB engagements', () => {
    render(
      <CountryComplianceSectionView
        contractorId="contractor-1"
        compliance={buildCompliance({ config: { hasCountryFields: true, countryCode: 'GB' } })}
        engagements={buildEngagements([
          sampleEngagement('e1', 'GB', 'Widgets'),
          sampleEngagement('e2', 'GB', 'Gadgets'),
        ])}
        formData={{}}
        onFormDataChange={vi.fn()}
      />,
    );
    expect(screen.getAllByTestId('classification-tile')).toHaveLength(2);
  });

  it('DE dispatch — renders 2 ClassificationTile for 2 DE engagements', () => {
    render(
      <CountryComplianceSectionView
        contractorId="contractor-1"
        compliance={buildCompliance({ config: { hasCountryFields: true, countryCode: 'DE' } })}
        engagements={buildEngagements([
          sampleEngagement('e1', 'DE', 'Lager'),
          sampleEngagement('e2', 'DE', 'Werkstatt'),
        ])}
        formData={{}}
        onFormDataChange={vi.fn()}
      />,
    );
    expect(screen.getAllByTestId('classification-tile')).toHaveLength(2);
  });

  it('Non-GB/DE engagements (FR) render no ClassificationTile', () => {
    render(
      <CountryComplianceSectionView
        contractorId="contractor-1"
        compliance={buildCompliance({ config: { hasCountryFields: true, countryCode: 'GB' } })}
        engagements={buildEngagements([sampleEngagement('e1', 'FR', 'Something')])}
        formData={{}}
        onFormDataChange={vi.fn()}
      />,
    );
    expect(screen.queryByTestId('classification-tile')).toBeNull();
    expect(screen.getByLabelText(/UTR/i)).toBeInTheDocument();
  });

  it('Mixed (GB + FR) renders exactly 1 ClassificationTile', () => {
    render(
      <CountryComplianceSectionView
        contractorId="contractor-1"
        compliance={buildCompliance({ config: { hasCountryFields: true, countryCode: 'GB' } })}
        engagements={buildEngagements([
          sampleEngagement('e1', 'GB', 'One'),
          sampleEngagement('e2', 'FR', 'Two'),
        ])}
        formData={{}}
        onFormDataChange={vi.fn()}
      />,
    );
    expect(screen.getAllByTestId('classification-tile')).toHaveLength(1);
  });
});
