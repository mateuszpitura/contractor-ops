import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen } from '@/test/test-utils';
import type { InvoiceTabData } from '../types';

// ---------------------------------------------------------------------------
// Mock tRPC + react-query so tests exercise UI logic without network.
// ---------------------------------------------------------------------------

const finalizeMutate = vi.fn();
const revalidateMutate = vi.fn();
const downloadXmlMutate = vi.fn();
const downloadReportMutate = vi.fn();
const sendMutate = vi.fn();

vi.mock('@tanstack/react-query', async () => {
  const actual =
    await vi.importActual<typeof import('@tanstack/react-query')>('@tanstack/react-query');
  return {
    ...actual,
    useQuery: () => ({ data: undefined, isLoading: false }),
    useMutation: (options: {
      mutationFn?: unknown;
      onSuccess?: (r: unknown) => void;
      onError?: (e: unknown) => void;
    }) => {
      // Return a distinct mutate per call site so tests can assert independently.
      const mutate = vi.fn();
      return {
        mutate,
        mutateAsync: mutate,
        isPending: false,
        reset: vi.fn(),
        options,
      };
    },
    useQueryClient: () => ({ invalidateQueries: vi.fn() }),
  };
});

vi.mock('@/trpc/init', () => ({
  trpc: {
    invoice: {
      getById: {
        queryOptions: () => ({ queryKey: ['invoice', 'getById'] }),
        queryKey: () => ['invoice', 'getById'],
      },
    },
    einvoice: {
      finalize: {
        mutationOptions: (opts: unknown) => ({ mutationFn: finalizeMutate, ...(opts ?? {}) }),
      },
      revalidate: {
        mutationOptions: (opts: unknown) => ({ mutationFn: revalidateMutate, ...(opts ?? {}) }),
      },
      downloadXml: {
        queryOptions: () => ({ queryKey: ['einvoice', 'downloadXml'], queryFn: downloadXmlMutate }),
      },
      downloadReport: {
        queryOptions: () => ({
          queryKey: ['einvoice', 'downloadReport'],
          queryFn: downloadReportMutate,
        }),
      },
      send: {
        mutationOptions: (opts: unknown) => ({ mutationFn: sendMutate, ...(opts ?? {}) }),
      },
      generateZugferdPdf: {
        mutationOptions: (opts: unknown) => ({ mutationFn: vi.fn(), ...(opts ?? {}) }),
      },
    },
  },
}));

vi.mock('sonner', () => ({
  toast: { success: vi.fn(), error: vi.fn() },
}));

// Import after mocks so the module picks them up.
import { EInvoiceTab } from '../einvoice-tab';

beforeEach(() => {
  finalizeMutate.mockReset();
  revalidateMutate.mockReset();
  downloadXmlMutate.mockReset();
  downloadReportMutate.mockReset();
  sendMutate.mockReset();
});

function baseData(overrides: Partial<InvoiceTabData> = {}): InvoiceTabData {
  return {
    invoiceId: 'inv_1',
    lifecycle: null,
    peppolParticipant: null,
    receiverAcceptsXRechnungCii: false,
    leitwegIdValue: null,
    leitwegIdSource: null,
    isPublicSectorBuyer: false,
    ...overrides,
  };
}

describe('EInvoiceTab', () => {
  it('renders NOT_GENERATED state with Generate CTA only', () => {
    render(<EInvoiceTab invoiceId="inv_1" data={baseData()} />);

    expect(screen.getByRole('heading', { name: 'Generation' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Generate XML' })).toBeInTheDocument();
    // Validate now CTA is visible (empty state) but Download XML is not.
    expect(screen.queryByRole('button', { name: 'Download XML' })).not.toBeInTheDocument();
  });

  it('renders GENERATED+VALID state with all CTAs + three layer rows PASS', () => {
    render(
      <EInvoiceTab
        invoiceId="inv_1"
        data={baseData({
          lifecycle: {
            id: 'lc_1',
            validationStatus: 'VALID',
            transmissionStatus: 'NOT_SENT',
            xmlSha256: 'abc123def456abc123def456abc123def456abc123def456',
            ruleSetVersion: '3.0.2',
            finalizedAt: new Date().toISOString(),
            events: [],
            validationReportSummary: {
              status: 'VALID',
              ruleSetVersion: '3.0.2',
              issues: [],
              perLayer: [
                { layer: '1', status: 'passed', errorCount: 0, warningCount: 0 },
                { layer: '2', status: 'passed', errorCount: 0, warningCount: 0 },
                { layer: '3', status: 'passed', errorCount: 0, warningCount: 0 },
              ],
            },
          },
        })}
      />,
    );

    expect(screen.getByRole('button', { name: 'Finalize + validate' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Download XML' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Download full report' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Transmission' })).toBeInTheDocument();

    // 3 validation layer rows rendered.
    const layerRows = document.querySelectorAll('[data-slot=validation-layer-row]');
    expect(layerRows).toHaveLength(3);
  });

  it('renders INVALID with SVRL issue list', () => {
    render(
      <EInvoiceTab
        invoiceId="inv_1"
        data={baseData({
          lifecycle: {
            id: 'lc_1',
            validationStatus: 'INVALID',
            transmissionStatus: 'NOT_SENT',
            xmlSha256: 'abc',
            ruleSetVersion: '3.0.2',
            finalizedAt: new Date().toISOString(),
            events: [],
            validationReportSummary: {
              status: 'INVALID',
              ruleSetVersion: '3.0.2',
              issues: [
                {
                  layer: 'Layer 2',
                  severity: 'error',
                  ruleId: 'BR-DE-17',
                  xpath: '/rsm:CrossIndustryInvoice/ram:BuyerReference',
                  message: 'BuyerReference is required for German public-sector buyers.',
                },
              ],
              perLayer: [
                { layer: '1', status: 'passed', errorCount: 0, warningCount: 0 },
                { layer: '2', status: 'failed', errorCount: 1, warningCount: 0 },
                { layer: '3', status: 'skipped', errorCount: 0, warningCount: 0 },
              ],
            },
          },
        })}
      />,
    );

    expect(screen.getByRole('heading', { name: 'Issues' })).toBeInTheDocument();
    expect(screen.getByText('BR-DE-17')).toBeInTheDocument();
  });

  it('Send button is disabled when Peppol participant is not ACTIVE', () => {
    render(
      <EInvoiceTab
        invoiceId="inv_1"
        data={baseData({
          lifecycle: {
            id: 'lc_1',
            validationStatus: 'VALID',
            transmissionStatus: 'NOT_SENT',
            xmlSha256: 'abc',
            ruleSetVersion: '3.0.2',
            finalizedAt: new Date().toISOString(),
            events: [],
            validationReportSummary: null,
          },
          peppolParticipant: { status: 'PENDING' },
          receiverAcceptsXRechnungCii: true,
        })}
      />,
    );

    const sendButton = document.querySelector<HTMLButtonElement>(
      'button[data-slot="einvoice-send-button"]',
    );
    expect(sendButton).toBeTruthy();
    expect(sendButton).toBeDisabled();
  });

  it('Send button is disabled when receiver capability lookup lacks XRechnung-CII', () => {
    render(
      <EInvoiceTab
        invoiceId="inv_1"
        data={baseData({
          lifecycle: {
            id: 'lc_1',
            validationStatus: 'VALID',
            transmissionStatus: 'NOT_SENT',
            xmlSha256: 'abc',
            ruleSetVersion: '3.0.2',
            finalizedAt: new Date().toISOString(),
            events: [],
            validationReportSummary: null,
          },
          peppolParticipant: { status: 'ACTIVE' },
          receiverAcceptsXRechnungCii: false,
        })}
      />,
    );

    const sendButton = document.querySelector<HTMLButtonElement>(
      'button[data-slot="einvoice-send-button"]',
    );
    expect(sendButton).toBeTruthy();
    expect(sendButton).toBeDisabled();
  });

  it('Send button is enabled when all gates pass', () => {
    render(
      <EInvoiceTab
        invoiceId="inv_1"
        data={baseData({
          lifecycle: {
            id: 'lc_1',
            validationStatus: 'VALID',
            transmissionStatus: 'NOT_SENT',
            xmlSha256: 'abc',
            ruleSetVersion: '3.0.2',
            finalizedAt: new Date().toISOString(),
            events: [],
            validationReportSummary: null,
          },
          peppolParticipant: { status: 'ACTIVE' },
          receiverAcceptsXRechnungCii: true,
        })}
      />,
    );

    const sendButton = document.querySelector<HTMLButtonElement>(
      'button[data-slot="einvoice-send-button"]',
    );
    expect(sendButton).toBeTruthy();
    expect(sendButton).toBeEnabled();
  });

  it('LeitwegIdResolvedInline shows warning when DE public-sector buyer lacks ID', () => {
    render(
      <EInvoiceTab
        invoiceId="inv_1"
        data={baseData({ isPublicSectorBuyer: true, leitwegIdValue: null })}
      />,
    );

    expect(
      screen.getByText('Leitweg-ID missing for German public-sector buyer'),
    ).toBeInTheDocument();
  });

  it('LeitwegIdResolvedInline shows resolved value when present', () => {
    render(
      <EInvoiceTab
        invoiceId="inv_1"
        data={baseData({
          isPublicSectorBuyer: true,
          leitwegIdValue: '991-33333TEST-33',
          leitwegIdSource: 'contract',
        })}
      />,
    );

    const resolvedNode = document.querySelector('[data-slot=leitweg-id-resolved-inline]');
    expect(resolvedNode?.textContent ?? '').toContain('991-33333TEST-33');
    expect(resolvedNode?.textContent ?? '').toContain('from contract override');
  });

  it('German locale renders formal-Sie strings on Generation heading', () => {
    render(<EInvoiceTab invoiceId="inv_1" data={baseData()} />, { locale: 'de' });

    expect(screen.getByRole('heading', { name: 'Erzeugung' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'XML erzeugen' })).toBeInTheDocument();
  });

  it('emits aria-live announcement region', () => {
    render(<EInvoiceTab invoiceId="inv_1" data={baseData()} />);
    const liveRegion = document.querySelector('[aria-live="polite"]');
    expect(liveRegion).toBeTruthy();
  });

  it('renders transmission event rows in order', () => {
    render(
      <EInvoiceTab
        invoiceId="inv_1"
        data={baseData({
          lifecycle: {
            id: 'lc_1',
            validationStatus: 'VALID',
            transmissionStatus: 'SENT',
            xmlSha256: 'abc',
            ruleSetVersion: '3.0.2',
            finalizedAt: new Date().toISOString(),
            transmittedAt: new Date().toISOString(),
            transmissionId: 'msg_abc123',
            events: [
              {
                id: 'e1',
                eventType: 'FINALIZED',
                createdAt: '2026-04-01T10:00:00Z',
              },
              {
                id: 'e2',
                eventType: 'SENT',
                createdAt: '2026-04-02T11:00:00Z',
                detailsJson: { messageId: 'msg_abc123defghijk' },
              },
            ],
            validationReportSummary: null,
          },
          peppolParticipant: { status: 'ACTIVE' },
          receiverAcceptsXRechnungCii: true,
        })}
      />,
    );

    expect(screen.getByRole('heading', { name: 'Transmission history' })).toBeInTheDocument();
    const rows = document.querySelectorAll('[data-slot=transmission-event-row]');
    expect(rows).toHaveLength(2);
  });
});
