import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render } from '@/test/test-utils';

// ---------------------------------------------------------------------------
// Client-boundary composition test. Stubs the four panes + the actions bar
// to the bare-minimum data-slot markers so this suite only exercises the
// layout / conditional-banner logic of the client boundary itself.
// ---------------------------------------------------------------------------

vi.mock('@tanstack/react-query', async () => {
  const actual = await vi.importActual<typeof import('@tanstack/react-query')>(
    '@tanstack/react-query',
  );
  return {
    ...actual,
    useQuery: () => ({ data: undefined, isLoading: false }),
    useMutation: () => ({
      mutate: vi.fn(),
      mutateAsync: vi.fn(),
      isPending: false,
      reset: vi.fn(),
    }),
    useQueryClient: () => ({ invalidateQueries: vi.fn() }),
  };
});

vi.mock('@/trpc/init', () => ({
  trpc: {
    invoiceIntake: {
      downloadRawFile: { queryOptions: () => ({}) },
      getMatchCandidates: { queryOptions: () => ({}) },
      getById: { queryKey: () => ['invoiceIntake', 'getById'] },
      confirmMatch: { mutationOptions: () => ({}) },
      convertToInvoice: { mutationOptions: () => ({}) },
      acknowledgeValidation: { mutationOptions: () => ({}) },
      reject: { mutationOptions: () => ({}) },
      downloadValidationReport: { queryOptions: () => ({}) },
    },
  },
}));

vi.mock('@/i18n/navigation', () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn() }),
  Link: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

vi.mock('sonner', () => ({
  toast: { success: vi.fn(), error: vi.fn() },
}));

import { IntakeDetailClient } from '../intake-detail-client';

beforeEach(() => {
  vi.clearAllMocks();
});

describe('IntakeDetailClient (client boundary)', () => {
  it('renders the EXTENDED best-effort banner when profileLevel === EXTENDED', () => {
    render(
      <IntakeDetailClient
        pageTitle="Invoice imports"
        intake={{
          id: 'ck_extended',
          sourceKind: 'UPLOAD_PDF',
          status: 'NEEDS_REVIEW',
          validationStatus: 'WARNINGS',
          validationAcknowledgedAt: null,
          profileLevel: 'EXTENDED',
          extractedSupplierName: 'Supplier Extended',
          extractedSupplierVatId: 'DE123456789',
          extractedSupplierLeitwegId: null,
          extractedInvoiceNumber: 'EXT-001',
          extractedInvoiceDate: null,
          extractedCurrency: 'EUR',
          extractedTotalMinor: 50000,
          parsedInvoiceJson: { lines: [{}] },
          unmappedFieldsJson: { custom: 'x' },
        }}
      />,
    );
    const banner = document.querySelector('[data-slot="intake-extended-banner"]');
    expect(banner).not.toBeNull();
    expect(banner?.textContent ?? '').toContain('EXTENDED');
    expect(banner?.textContent ?? '').toContain('sender-specific fields');
  });

  it('does NOT render the EXTENDED banner for COMFORT profile intakes', () => {
    render(
      <IntakeDetailClient
        pageTitle="Invoice imports"
        intake={{
          id: 'ck_comfort',
          sourceKind: 'UPLOAD_XML',
          status: 'PARSED',
          validationStatus: 'VALID',
          validationAcknowledgedAt: null,
          profileLevel: 'COMFORT',
          extractedSupplierName: 'Comfort Co',
          extractedSupplierVatId: null,
          extractedSupplierLeitwegId: null,
          extractedInvoiceNumber: 'CMF-01',
          extractedInvoiceDate: null,
          extractedCurrency: 'EUR',
          extractedTotalMinor: 100,
          parsedInvoiceJson: { lines: [] },
          unmappedFieldsJson: null,
        }}
      />,
    );
    expect(document.querySelector('[data-slot="intake-extended-banner"]')).toBeNull();
  });

  it('renders all 4 detail panes + the actions bar', () => {
    render(
      <IntakeDetailClient
        pageTitle="Invoice imports"
        intake={{
          id: 'ck_all',
          sourceKind: 'UPLOAD_XML',
          status: 'PARSED',
          validationStatus: 'VALID',
          validationAcknowledgedAt: null,
          profileLevel: 'COMFORT',
          extractedSupplierName: 'Example Co',
          extractedSupplierVatId: null,
          extractedSupplierLeitwegId: null,
          extractedInvoiceNumber: 'INV-01',
          extractedInvoiceDate: null,
          extractedCurrency: 'EUR',
          extractedTotalMinor: 1,
          parsedInvoiceJson: { lines: [] },
          unmappedFieldsJson: null,
        }}
      />,
    );
    expect(document.querySelector('[data-slot="intake-detail-pdf-pane"]')).not.toBeNull();
    expect(document.querySelector('[data-slot="intake-detail-fields-pane"]')).not.toBeNull();
    expect(document.querySelector('[data-slot="intake-detail-validation-pane"]')).not.toBeNull();
    expect(document.querySelector('[data-slot="intake-detail-match-pane"]')).not.toBeNull();
    expect(document.querySelector('[data-slot="intake-detail-actions-bar"]')).not.toBeNull();
  });
});
