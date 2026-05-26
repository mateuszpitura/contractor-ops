import { describe, expect, it } from 'vitest';

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

import { render, screen } from '@/test/test-utils';

import { ClassificationEngagementCta } from '../classification-engagement-cta';

describe('ClassificationEngagementCta', () => {
  it('renders a link-button with default test id', () => {
    render(<ClassificationEngagementCta contractorId="c-1" engagementId="eng-1" />);

    expect(screen.getByTestId('classification-engagement-cta')).toBeInTheDocument();
  });

  it('renders an anchor linking to the classification wizard route', () => {
    render(<ClassificationEngagementCta contractorId="c-1" engagementId="eng-1" />);

    const link = screen.getByTestId('classification-engagement-cta').closest('a');
    expect(link).toHaveAttribute('href', '/contractors/c-1/engagements/eng-1/classification');
  });

  it('uses custom label when provided', () => {
    render(
      <ClassificationEngagementCta
        contractorId="c-1"
        engagementId="eng-1"
        label="Run Assessment"
      />,
    );

    expect(screen.getByText('Run Assessment')).toBeInTheDocument();
  });

  it('uses custom data-testid when provided', () => {
    render(
      <ClassificationEngagementCta
        contractorId="c-1"
        engagementId="eng-1"
        dataTestId="custom-cta"
      />,
    );

    expect(screen.getByTestId('custom-cta')).toBeInTheDocument();
  });
});
