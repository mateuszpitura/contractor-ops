import { mutationOptions, queryOptions, trpcQueryKey } from '@/test/mocks/trpc';
import { render, screen, setup } from '@/test/test-utils';
import { ConsentManagementSection } from '../consent-management-section';

// ---------------------------------------------------------------------------
// Mock data
// ---------------------------------------------------------------------------

let noticeData: Record<string, unknown> | null = {
  jurisdiction: 'AE',
  legalReference: 'Federal Decree-Law No. 45/2021',
  controller: { name: 'Test Org', country: 'AE' },
  sections: [{ title: 'Processing Purposes', content: 'We process data for...' }],
};
let noticeLoading = false;
let consentLoading = false;

let currentConsentData: Record<string, unknown> = {
  CONTRACTOR_DATA_PROCESSING: { granted: true, version: 1, lastUpdated: '2026-04-11' },
  INVOICE_PAYMENT_PROCESSING: { granted: true, version: 1, lastUpdated: '2026-04-11' },
  COMMUNICATION_NOTIFICATIONS: { granted: true, version: 1, lastUpdated: '2026-04-11' },
  ANALYTICS_REPORTING: { granted: false, version: 0, lastUpdated: null },
};

let consentHistoryData: unknown[] = [
  {
    id: 'rec-1',
    purpose: 'CONTRACTOR_DATA_PROCESSING',
    granted: true,
    createdAt: '2026-04-11T10:00:00Z',
    version: 1,
  },
  {
    id: 'rec-2',
    purpose: 'INVOICE_PAYMENT_PROCESSING',
    granted: true,
    createdAt: '2026-04-11T10:01:00Z',
    version: 1,
  },
];

let crossBorderData: Record<string, unknown> = {
  detected: true,
  orgRegion: 'GCC',
  hostingRegion: 'EU',
};

const { mockGrantMutate, mockDownloadDPAMutate, mockDownloadSCCMutate } = vi.hoisted(() => ({
  mockGrantMutate: vi.fn(),
  mockDownloadDPAMutate: vi.fn(),
  mockDownloadSCCMutate: vi.fn(),
}));

function rqKey() {
  return '__rq_consent_management_section__';
}
function rq() {
  return (globalThis as any)[rqKey()] as ReturnType<
    typeof import('@/test/mocks/react-query').createReactQueryMockController
  >;
}

vi.mock('@tanstack/react-query', async () => {
  const { createReactQueryMockController } = await import('@/test/mocks/react-query');
  (globalThis as any)[rqKey()] ??= createReactQueryMockController();
  return rq().factory();
});

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

vi.mock('next-intl', async importOriginal => {
  const actual = await importOriginal<typeof import('next-intl')>();
  return {
    ...actual,
    useTranslations: () => (key: string, values?: Record<string, unknown>) => {
      if (values) return `${key} ${JSON.stringify(values)}`;
      return key;
    },
  };
});

vi.mock('@/trpc/init', () => ({
  trpc: {
    consent: {
      getPrivacyNotice: {
        queryOptions: () => queryOptions(trpcQueryKey(['consent', 'getPrivacyNotice'])),
      },
      getCurrentConsent: {
        queryOptions: () => queryOptions(trpcQueryKey(['consent', 'getCurrentConsent'])),
        queryKey: () => trpcQueryKey(['consent', 'getCurrentConsent']),
      },
      getConsentHistory: {
        queryOptions: (input: unknown) =>
          queryOptions(trpcQueryKey(['consent', 'getConsentHistory'], input)),
        queryKey: (input: unknown) => trpcQueryKey(['consent', 'getConsentHistory'], input),
      },
      getCrossBorderStatus: {
        queryOptions: () => queryOptions(trpcQueryKey(['consent', 'getCrossBorderStatus'])),
      },
      grant: {
        mutationOptions: (opts?: { onSuccess?: () => void; onError?: (e: Error) => void }) =>
          mutationOptions(opts),
      },
      downloadDPA: {
        mutationOptions: (opts?: {
          onSuccess?: (data: unknown) => void;
          onError?: (e: Error) => void;
        }) => mutationOptions({ __trpcProc: 'downloadDPA', ...(opts ?? {}) }),
      },
      downloadSCC: {
        mutationOptions: (opts?: {
          onSuccess?: (data: unknown) => void;
          onError?: (e: Error) => void;
        }) => mutationOptions({ __trpcProc: 'downloadSCC', ...(opts ?? {}) }),
      },
    },
  },
}));

vi.mock('sonner', () => ({
  toast: { success: vi.fn(), error: vi.fn(), info: vi.fn() },
}));

beforeEach(() => {
  rq().setQueryResult(trpcQueryKey(['consent', 'getPrivacyNotice']), {
    get data() {
      return noticeData;
    },
    get isLoading() {
      return noticeLoading;
    },
  });
  rq().setQueryResult(trpcQueryKey(['consent', 'getCurrentConsent']), {
    get data() {
      return currentConsentData;
    },
    get isLoading() {
      return consentLoading;
    },
  });
  rq().setQueryResult(trpcQueryKey(['consent', 'getConsentHistory'], {}), {
    get data() {
      return consentHistoryData;
    },
  });
  rq().setQueryResult(trpcQueryKey(['consent', 'getCrossBorderStatus']), {
    get data() {
      return crossBorderData;
    },
  });

  rq().setUseMutationImpl((options?: object) => {
    return {
      mutate: (args?: unknown) => {
        const onSuccess = (options as any)?.onSuccess as ((data?: any) => void) | undefined;
        const proc = (options as any)?.__trpcProc as string | undefined;

        if ((options as any)?.onError && args === '__force_error__') {
          (options as any).onError(new Error('err'));
          return;
        }

        // Heuristic: grant has args, downloads don't.
        if (args && typeof args === 'object' && 'purpose' in (args as any)) {
          mockGrantMutate(args);
          onSuccess?.();
          return;
        }

        if (proc === 'downloadDPA') {
          mockDownloadDPAMutate();
          onSuccess?.({ content: '<html>DPA</html>', filename: 'DPA.html' });
          return;
        }

        if (proc === 'downloadSCC') {
          mockDownloadSCCMutate();
          onSuccess?.({ content: '<html>SCC</html>', filename: 'SCC.html' });
          return;
        }

        if (options && typeof options === 'object' && 'onSuccess' in (options as any)) {
          // DPA / SCC success payload
          if (mockDownloadDPAMutate.mock.calls.length === 0) {
            mockDownloadDPAMutate();
            onSuccess?.({ content: '<html>DPA</html>', filename: 'DPA.html' });
          } else {
            mockDownloadSCCMutate();
            onSuccess?.({ content: '<html>SCC</html>', filename: 'SCC.html' });
          }
        }
      },
      isPending: false,
      status: 'idle' as const,
      ...(options ?? {}),
    } as any;
  });
});

// Mock child components
vi.mock('../privacy-notice-display', () => ({
  PrivacyNoticeDisplay: ({ notice }: { notice: { jurisdiction: string } }) => (
    <div data-testid="privacy-notice">{notice.jurisdiction}</div>
  ),
}));

vi.mock('../consent-purpose-toggle', () => ({
  ConsentPurposeToggle: ({
    purpose,
    required,
    granted,
    onToggle,
    disabled,
  }: {
    purpose: string;
    required: boolean;
    granted: boolean;
    onToggle: (purpose: string, granted: boolean) => void;
    disabled: boolean;
  }) => (
    <div data-testid={`toggle-${purpose}`}>
      <button
        type="button"
        data-testid={`switch-${purpose}`}
        role="switch"
        aria-checked={granted}
        aria-label={`${purpose} consent toggle`}
        aria-disabled={disabled}
        disabled={disabled}
        // biome-ignore lint/nursery/noJsxPropsBind: callback in JSX prop
        onClick={() => onToggle(purpose, !granted)}>
        {purpose} {required ? '(required/locked)' : '(optional)'}
      </button>
    </div>
  ),
}));

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('ConsentManagementSection', () => {
  beforeEach(() => {
    mockGrantMutate.mockClear();
    mockDownloadDPAMutate.mockClear();
    mockDownloadSCCMutate.mockClear();
    noticeLoading = false;
    consentLoading = false;
    noticeData = {
      jurisdiction: 'AE',
      legalReference: 'Federal Decree-Law No. 45/2021',
      controller: { name: 'Test Org', country: 'AE' },
      sections: [],
    };
    currentConsentData = {
      CONTRACTOR_DATA_PROCESSING: { granted: true, version: 1, lastUpdated: '2026-04-11' },
      INVOICE_PAYMENT_PROCESSING: { granted: true, version: 1, lastUpdated: '2026-04-11' },
      COMMUNICATION_NOTIFICATIONS: { granted: true, version: 1, lastUpdated: '2026-04-11' },
    };
    consentHistoryData = [
      {
        id: 'rec-1',
        purpose: 'CONTRACTOR_DATA_PROCESSING',
        granted: true,
        createdAt: '2026-04-11T10:00:00Z',
        version: 1,
      },
    ];
    crossBorderData = { detected: true, orgRegion: 'GCC', hostingRegion: 'EU' };
  });

  it('renders consent toggles for each purpose', () => {
    render(<ConsentManagementSection />);

    expect(screen.getByTestId('toggle-CONTRACTOR_DATA_PROCESSING')).toBeInTheDocument();
    expect(screen.getByTestId('toggle-INVOICE_PAYMENT_PROCESSING')).toBeInTheDocument();
    expect(screen.getByTestId('toggle-COMMUNICATION_NOTIFICATIONS')).toBeInTheDocument();
    expect(screen.getByTestId('toggle-ANALYTICS_REPORTING')).toBeInTheDocument();
    expect(screen.getByTestId('toggle-CROSS_BORDER_TRANSFER')).toBeInTheDocument();
    expect(screen.getByTestId('toggle-INTEGRATION_DATA_SHARING')).toBeInTheDocument();
  });

  it('renders required consent toggles with required prop', () => {
    render(<ConsentManagementSection />);

    // Required purposes should have "(required/locked)" text
    expect(screen.getByTestId('switch-CONTRACTOR_DATA_PROCESSING')).toHaveTextContent(
      '(required/locked)',
    );
    expect(screen.getByTestId('switch-INVOICE_PAYMENT_PROCESSING')).toHaveTextContent(
      '(required/locked)',
    );
    expect(screen.getByTestId('switch-COMMUNICATION_NOTIFICATIONS')).toHaveTextContent(
      '(required/locked)',
    );

    // Optional purposes should have "(optional)" text
    expect(screen.getByTestId('switch-ANALYTICS_REPORTING')).toHaveTextContent('(optional)');
  });

  it('renders privacy notice display', () => {
    render(<ConsentManagementSection />);
    expect(screen.getByTestId('privacy-notice')).toBeInTheDocument();
  });

  it('calls grant mutation when consent toggle is clicked', async () => {
    const { user } = setup(<ConsentManagementSection />);

    await user.click(screen.getByTestId('switch-ANALYTICS_REPORTING'));

    expect(mockGrantMutate).toHaveBeenCalledWith({
      purpose: 'ANALYTICS_REPORTING',
      granted: true,
    });
  });

  it('Download DPA button triggers download mutation', async () => {
    const { user } = setup(<ConsentManagementSection />);

    const dpaBtn = screen.getByRole('button', { name: /downloadDPA/i });
    await user.click(dpaBtn);

    expect(mockDownloadDPAMutate).toHaveBeenCalledTimes(1);
  });

  it('Download SCC button triggers download mutation', async () => {
    const { user } = setup(<ConsentManagementSection />);

    const sccBtn = screen.getByRole('button', { name: /downloadSCC/i });
    await user.click(sccBtn);

    expect(mockDownloadSCCMutate).toHaveBeenCalledTimes(1);
  });

  it('consent history section renders records', () => {
    render(<ConsentManagementSection />);

    // History table should show purpose text
    expect(screen.getByText('contractor data processing')).toBeInTheDocument();
  });

  it('shows not-required message when notice is null (non-PDPL org)', () => {
    noticeData = null;
    render(<ConsentManagementSection />);

    expect(screen.getByText('settings.notRequired')).toBeInTheDocument();
  });

  it('renders cross-border transfer status', () => {
    render(<ConsentManagementSection />);

    expect(screen.getByText('settings.crossBorderDetected')).toBeInTheDocument();
  });

  it('shows no cross-border message when not detected', () => {
    crossBorderData = { detected: false, orgRegion: 'EU', hostingRegion: 'EU' };
    render(<ConsentManagementSection />);

    expect(screen.getByText('settings.noCrossBorder')).toBeInTheDocument();
  });
});
