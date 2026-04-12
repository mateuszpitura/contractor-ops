import { render, screen, setup } from '@/test/test-utils';
import { OnboardingConsentStep } from '../onboarding-consent-step';

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

let noticeData: any = {
  jurisdiction: 'AE',
  legalReference: 'Federal Decree-Law No. 45/2021',
  controller: { name: 'Test Org', country: 'AE' },
  sections: [{ title: 'Processing Purposes', content: 'We process data for...' }],
};
let noticeLoading = false;

const mockBulkGrantMutate = vi.fn();
let bulkGrantPending = false;

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
        useQuery: () => ({ data: noticeData, isLoading: noticeLoading }),
      },
      bulkGrant: {
        useMutation: (opts?: { onSuccess?: () => void }) => ({
          mutate: (args: unknown) => {
            mockBulkGrantMutate(args);
            opts?.onSuccess?.();
          },
          isPending: bulkGrantPending,
        }),
      },
    },
  },
}));

vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

// Mock child components to isolate unit behavior
vi.mock('../privacy-notice-display', () => ({
  PrivacyNoticeDisplay: ({ notice }: any) => (
    <div data-testid="privacy-notice">{notice.jurisdiction}</div>
  ),
}));

vi.mock('../consent-purpose-toggle', () => ({
  ConsentPurposeToggle: ({ purpose, required, granted, onToggle }: any) => (
    <div data-testid={`toggle-${purpose}`}>
      <button
        data-testid={`switch-${purpose}`}
        role="switch"
        aria-checked={granted}
        aria-label={`${purpose} consent toggle`}
        onClick={() => onToggle(purpose, !granted)}>
        {purpose} {required ? '(required)' : '(optional)'}
      </button>
    </div>
  ),
}));

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('OnboardingConsentStep', () => {
  const onComplete = vi.fn();

  beforeEach(() => {
    onComplete.mockClear();
    mockBulkGrantMutate.mockClear();
    noticeData = {
      jurisdiction: 'AE',
      legalReference: 'Federal Decree-Law No. 45/2021',
      controller: { name: 'Test Org', country: 'AE' },
      sections: [],
    };
    noticeLoading = false;
    bulkGrantPending = false;
  });

  it('renders nothing for non-PDPL jurisdiction', () => {
    const { container } = render(
      <OnboardingConsentStep orgCountryCode="PL" onComplete={onComplete} />,
    );
    expect(container.innerHTML).toBe('');
  });

  it('renders nothing for null country code', () => {
    const { container } = render(
      <OnboardingConsentStep orgCountryCode={null} onComplete={onComplete} />,
    );
    expect(container.innerHTML).toBe('');
  });

  it('renders consent toggles for AE org', () => {
    render(<OnboardingConsentStep orgCountryCode="AE" onComplete={onComplete} />);

    // 3 required + 3 optional = 6 toggles
    expect(screen.getByTestId('toggle-CONTRACTOR_DATA_PROCESSING')).toBeInTheDocument();
    expect(screen.getByTestId('toggle-INVOICE_PAYMENT_PROCESSING')).toBeInTheDocument();
    expect(screen.getByTestId('toggle-COMMUNICATION_NOTIFICATIONS')).toBeInTheDocument();
    expect(screen.getByTestId('toggle-ANALYTICS_REPORTING')).toBeInTheDocument();
    expect(screen.getByTestId('toggle-CROSS_BORDER_TRANSFER')).toBeInTheDocument();
    expect(screen.getByTestId('toggle-INTEGRATION_DATA_SHARING')).toBeInTheDocument();
  });

  it('renders consent toggles for SA org', () => {
    render(<OnboardingConsentStep orgCountryCode="SA" onComplete={onComplete} />);

    expect(screen.getByTestId('toggle-CONTRACTOR_DATA_PROCESSING')).toBeInTheDocument();
  });

  it('renders privacy notice display for PDPL jurisdiction', () => {
    render(<OnboardingConsentStep orgCountryCode="AE" onComplete={onComplete} />);

    expect(screen.getByTestId('privacy-notice')).toBeInTheDocument();
  });

  it('accept button is disabled when required purposes not granted', () => {
    render(<OnboardingConsentStep orgCountryCode="AE" onComplete={onComplete} />);

    const acceptBtn = screen.getByRole('button', { name: /acceptAndContinue/i });
    expect(acceptBtn).toBeDisabled();
  });

  it('accept button is enabled when all required purposes granted', async () => {
    const { user } = setup(<OnboardingConsentStep orgCountryCode="AE" onComplete={onComplete} />);

    // Toggle all 3 required purposes
    await user.click(screen.getByTestId('switch-CONTRACTOR_DATA_PROCESSING'));
    await user.click(screen.getByTestId('switch-INVOICE_PAYMENT_PROCESSING'));
    await user.click(screen.getByTestId('switch-COMMUNICATION_NOTIFICATIONS'));

    const acceptBtn = screen.getByRole('button', { name: /acceptAndContinue/i });
    expect(acceptBtn).not.toBeDisabled();
  });

  it('calls bulkGrant mutation with granted consents on accept', async () => {
    const { user } = setup(<OnboardingConsentStep orgCountryCode="AE" onComplete={onComplete} />);

    // Toggle all 3 required purposes
    await user.click(screen.getByTestId('switch-CONTRACTOR_DATA_PROCESSING'));
    await user.click(screen.getByTestId('switch-INVOICE_PAYMENT_PROCESSING'));
    await user.click(screen.getByTestId('switch-COMMUNICATION_NOTIFICATIONS'));

    const acceptBtn = screen.getByRole('button', { name: /acceptAndContinue/i });
    await user.click(acceptBtn);

    expect(mockBulkGrantMutate).toHaveBeenCalledTimes(1);
    const arg = mockBulkGrantMutate.mock.calls[0][0];
    expect(arg.consents).toEqual(
      expect.arrayContaining([
        { purpose: 'CONTRACTOR_DATA_PROCESSING', granted: true },
        { purpose: 'INVOICE_PAYMENT_PROCESSING', granted: true },
        { purpose: 'COMMUNICATION_NOTIFICATIONS', granted: true },
      ]),
    );
  });

  it('calls onComplete after successful bulkGrant', async () => {
    const { user } = setup(<OnboardingConsentStep orgCountryCode="AE" onComplete={onComplete} />);

    await user.click(screen.getByTestId('switch-CONTRACTOR_DATA_PROCESSING'));
    await user.click(screen.getByTestId('switch-INVOICE_PAYMENT_PROCESSING'));
    await user.click(screen.getByTestId('switch-COMMUNICATION_NOTIFICATIONS'));

    await user.click(screen.getByRole('button', { name: /acceptAndContinue/i }));

    expect(onComplete).toHaveBeenCalledTimes(1);
  });

  // -------------------------------------------------------------------------
  // Wave 0 scaffold — implemented in Plan 08 (GB + DE privacy acknowledgement)
  // Tests fail by design until Plan 08 either:
  //   - extends isPdplJurisdiction to include GB + DE, OR
  //   - introduces a new requiresPrivacyAcknowledgement(code) predicate.
  // Plan 08 must also render an acknowledgement checkbox + link-in-label to
  // /legal/privacy with target='_blank' and rel='noopener noreferrer'.
  // Covers FOUND-01..06 onboarding privacy acknowledgement flow.
  // -------------------------------------------------------------------------
  describe('privacy acknowledgement for GB + DE orgs (FOUND-01..06, Plan 08)', () => {
    it.each(['GB', 'DE'] as const)(
      'renders acknowledgement step for orgCountryCode=%s',
      countryCode => {
        const { container } = render(
          <OnboardingConsentStep orgCountryCode={countryCode} onComplete={onComplete} />,
        );
        // Wave 0: current isPdplJurisdiction returns false for GB/DE -> component
        // returns null. When Plan 08 extends the predicate, the step renders.
        expect(container.innerHTML).not.toBe('');
      },
    );

    it('acknowledgement checkbox is unchecked by default for GB org', () => {
      render(<OnboardingConsentStep orgCountryCode="GB" onComplete={onComplete} />);
      const checkbox = screen.getByRole('checkbox', { name: /acknowledge/i });
      expect(checkbox).not.toBeChecked();
    });

    it('Continue button is disabled until checkbox toggled on', () => {
      render(<OnboardingConsentStep orgCountryCode="DE" onComplete={onComplete} />);
      const continueBtn = screen.getByRole('button', { name: /continue|weiter/i });
      expect(continueBtn).toBeDisabled();
    });

    it('link in label points to /legal/privacy with safe rel + target', () => {
      render(<OnboardingConsentStep orgCountryCode="DE" onComplete={onComplete} />);
      const link = screen.getByRole('link', { name: /privacy|datenschutz/i });
      expect(link).toHaveAttribute('href', expect.stringContaining('/legal/privacy'));
      expect(link).toHaveAttribute('target', '_blank');
      expect(link).toHaveAttribute('rel', expect.stringContaining('noopener'));
      expect(link).toHaveAttribute('rel', expect.stringContaining('noreferrer'));
    });
  });
});
