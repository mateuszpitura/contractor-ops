/**
 * PortalTopBar accepts the `usePortalTopBar` return as a
 * `bar` prop. The nested mobile-menu container reaches into tRPC for org
 * lists, so we stub it to inert null. The OrgSwitcherList is only shown
 * via dropdown sub-menus the test does not exercise.
 */

vi.mock('../portal-mobile-menu.js', () => ({
  PortalMobileMenuContainer: () => null,
}));

import { render, screen } from '@/test/test-utils';
import type { usePortalTopBar } from '../hooks/use-portal-top-bar.js';
import { PortalTopBar } from '../portal-top-bar';

type Bar = ReturnType<typeof usePortalTopBar>;

function makeBar(overrides: Partial<Bar> = {}): Bar {
  return {
    pathname: '/en/portal',
    orgSwitcher: {
      isAvailable: false,
      orgs: [],
      switchingContractorId: null,
      switchTo: vi.fn(),
    },
    mobileMenuOpen: false,
    setMobileMenuOpen: vi.fn(),
    handleLogout: vi.fn(),
    ...overrides,
  } as unknown as Bar;
}

function renderTopBar(overrides: Partial<Parameters<typeof PortalTopBar>[0]> = {}) {
  return render(
    <PortalTopBar
      orgName="Acme Corp"
      orgLogo={null}
      contractorName="Jane Doe"
      contractorEmail="jane@example.com"
      bar={makeBar()}
      {...overrides}
    />,
  );
}

describe('PortalTopBar', () => {
  it('renders the org name', () => {
    renderTopBar();
    expect(screen.getByText('Acme Corp')).toBeInTheDocument();
  });

  it('renders the navigation items', () => {
    renderTopBar();
    expect(screen.getByText('Overview')).toBeInTheDocument();
    expect(screen.getByText('Contracts')).toBeInTheDocument();
    expect(screen.getByText('Invoices')).toBeInTheDocument();
    expect(screen.getByText('Documents')).toBeInTheDocument();
    expect(screen.getByText('Time')).toBeInTheDocument();
    expect(screen.getByText('Equipment')).toBeInTheDocument();
    expect(screen.getByText('Payments')).toBeInTheDocument();
    expect(screen.getByText('Settings')).toBeInTheDocument();
  });

  it('marks the current pathname as the active nav item', () => {
    const { container } = render(
      <PortalTopBar
        orgName="Acme"
        orgLogo={null}
        contractorName="Jane"
        contractorEmail="j@x.com"
        bar={makeBar({ pathname: '/en/portal/invoices' })}
      />,
    );
    const activeLink = container.querySelector('a[aria-current="page"]');
    expect(activeLink?.textContent).toContain('Invoices');
  });

  it('renders the contractor avatar initials', () => {
    renderTopBar();
    // Jane Doe → "JD"
    expect(screen.getByText('JD')).toBeInTheDocument();
  });
});
