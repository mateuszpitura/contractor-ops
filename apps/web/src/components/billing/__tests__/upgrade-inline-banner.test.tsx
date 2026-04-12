import { render, screen } from '@/test/test-utils';
import { UpgradeInlineBanner } from '../upgrade-inline-banner';

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

vi.mock('@/i18n/navigation', () => ({
  Link: ({ children, href, ...props }: any) => (
    <a href={href} {...props}>
      {children}
    </a>
  ),
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), back: vi.fn() }),
  usePathname: () => '/test',
}));

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('UpgradeInlineBanner', () => {
  it('renders with status role and aria-live', () => {
    render(<UpgradeInlineBanner featureName="OCR" requiredTier="Pro" />);
    const banner = screen.getByRole('status');
    expect(banner).toHaveAttribute('aria-live', 'polite');
  });

  it('displays the feature requirement message', () => {
    render(<UpgradeInlineBanner featureName="OCR" requiredTier="Pro" />);
    expect(screen.getByText('OCR requires Pro.')).toBeInTheDocument();
  });

  it('displays the upgrade button with link to billing', () => {
    render(<UpgradeInlineBanner featureName="API access" requiredTier="Enterprise" />);
    expect(screen.getByText('Upgrade Plan')).toBeInTheDocument();
  });

  it('shows correct message for Enterprise tier', () => {
    render(<UpgradeInlineBanner featureName="Audit log export" requiredTier="Enterprise" />);
    expect(screen.getByText('Audit log export requires Enterprise.')).toBeInTheDocument();
  });
});
