import { render, screen } from '@/test/test-utils';
import { ImportWizard } from '../import-wizard';

vi.mock('@/i18n/navigation', () => ({
  Link: ({
    children,
    href,
    ...props
  }: {
    children: React.ReactNode;
    href: string;
    [key: string]: unknown;
  }) => (
    <a href={href} {...(props as React.AnchorHTMLAttributes<HTMLAnchorElement>)}>
      {children}
    </a>
  ),
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), back: vi.fn() }),
  usePathname: () => '/test',
}));

vi.mock('@/components/billing/feature-gate', () => ({
  FeatureGate: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

vi.mock('@/components/onboarding/source-selection-step', () => ({
  SourceSelectionStep: () => <div data-testid="step-1">SourceSelectionStep</div>,
}));

vi.mock('@/components/onboarding/people-review-step', () => ({
  PeopleReviewStep: () => <div data-testid="step-2">PeopleReviewStep</div>,
}));

vi.mock('@/components/onboarding/project-import-step', () => ({
  ProjectImportStep: () => <div data-testid="step-3">ProjectImportStep</div>,
}));

vi.mock('@/components/onboarding/confirm-import-step', () => ({
  ConfirmImportStep: () => <div data-testid="step-4">ConfirmImportStep</div>,
}));

describe('ImportWizard', () => {
  it('renders page title and step 1 by default', () => {
    render(<ImportWizard />);
    expect(screen.getByText('Import Your Team')).toBeInTheDocument();
    expect(screen.getByTestId('step-1')).toBeInTheDocument();
  });

  it('renders step indicator with 4 steps', () => {
    render(<ImportWizard />);
    expect(screen.getByText('Select Sources')).toBeInTheDocument();
    expect(screen.getByText('Review People')).toBeInTheDocument();
  });

  it('shows continue button disabled when no sources selected', () => {
    render(<ImportWizard />);
    const continueBtn = screen.getByText('Continue');
    expect(continueBtn.closest('button')).toBeDisabled();
  });

  it('does not show back button on step 1', () => {
    render(<ImportWizard />);
    expect(screen.queryByText('Back')).not.toBeInTheDocument();
  });

  it('renders page subtitle', () => {
    render(<ImportWizard />);
    expect(screen.getByText(/pull in team members/i)).toBeInTheDocument();
  });

  it('renders progress bar', () => {
    const { container } = render(<ImportWizard />);
    expect(container.querySelector("[role='progressbar']")).toBeTruthy();
  });

  it('renders all 4 step labels', () => {
    render(<ImportWizard />);
    expect(screen.getByText('Select Sources')).toBeInTheDocument();
    expect(screen.getByText('Review People')).toBeInTheDocument();
    expect(screen.getByText('Import Projects')).toBeInTheDocument();
    expect(screen.getByText('Confirm & Import')).toBeInTheDocument();
  });

  it('renders step 1 number indicator', () => {
    render(<ImportWizard />);
    // Step 1 should be current, step 2-4 should be numbers
    expect(screen.getByText('2')).toBeInTheDocument();
    expect(screen.getByText('3')).toBeInTheDocument();
    expect(screen.getByText('4')).toBeInTheDocument();
  });

  it('renders wizard step navigation with aria label', () => {
    render(<ImportWizard />);
    expect(screen.getByRole('navigation', { name: /wizard steps/i })).toBeInTheDocument();
  });

  it('renders step 1 content as SourceSelectionStep', () => {
    render(<ImportWizard />);
    expect(screen.getByTestId('step-1')).toBeInTheDocument();
    expect(screen.queryByTestId('step-2')).not.toBeInTheDocument();
  });
});
