import { render, screen } from '@/test/test-utils';
import { AppFooter } from '../app-footer';

vi.mock('@/i18n/navigation', () => ({
  Link: ({
    children,
    href,
    ...props
  }: {
    children: React.ReactNode;
    href: string;
    [k: string]: unknown;
  }) => (
    <a href={href} {...(props as React.AnchorHTMLAttributes<HTMLAnchorElement>)}>
      {children}
    </a>
  ),
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), back: vi.fn() }),
  usePathname: () => '/test',
}));

describe('AppFooter', () => {
  it('renders a footer element', () => {
    render(<AppFooter />);
    expect(screen.getByRole('contentinfo')).toBeInTheDocument();
  });

  it('renders privacy link', () => {
    render(<AppFooter />);
    const privacyLink = screen.getByText('Privacy');
    expect(privacyLink.closest('a')).toHaveAttribute('href', '/legal/privacy');
  });

  it('renders terms link', () => {
    render(<AppFooter />);
    const termsLink = screen.getByText('Terms');
    expect(termsLink.closest('a')).toHaveAttribute('href', '/legal/terms');
  });

  it('renders copyright with current year', () => {
    render(<AppFooter />);
    const year = new Date().getFullYear();
    expect(screen.getByText(`\u00A9 ${year} Contractor Ops`)).toBeInTheDocument();
  });

  it('links have accessible tap target size', () => {
    render(<AppFooter />);
    const privacyLink = screen.getByText('Privacy');
    expect(privacyLink).toHaveClass('min-h-[44px]');
  });
});
