/**
 * PortalMobileMenu accepts the `usePortalMobileMenu` hook
 * return as a `menu` prop; nav clicks delegate to the hook's
 * `handleNavClick`.
 */

import { render, screen, setup } from '@/test/test-utils';
import type { usePortalMobileMenu } from '../hooks/use-portal-top-bar.js';
import { PortalMobileMenu } from '../portal-mobile-menu';

type Menu = ReturnType<typeof usePortalMobileMenu>;

function makeMenu(overrides: Partial<Menu> = {}): Menu {
  return {
    pathname: '/en/portal',
    orgSwitcher: {
      isAvailable: false,
      orgs: [],
      switchingContractorId: null,
      switchTo: vi.fn(),
    },
    handleNavClick: vi.fn(),
    handleLogout: vi.fn(),
    ...overrides,
  } as unknown as Menu;
}

function renderMenu(overrides: Partial<Parameters<typeof PortalMobileMenu>[0]> = {}) {
  return render(
    <PortalMobileMenu
      open
      onOpenChange={vi.fn()}
      orgName="Acme Corp"
      orgLogo={null}
      contractorName="Jane Doe"
      contractorEmail="jane@example.com"
      menu={makeMenu()}
      {...overrides}
    />,
  );
}

describe('PortalMobileMenu', () => {
  it('renders the org name as the sheet title', () => {
    renderMenu();
    expect(screen.getByText('Acme Corp')).toBeInTheDocument();
  });

  it('renders the contractor name and email in the footer', () => {
    renderMenu();
    expect(screen.getByText('Jane Doe')).toBeInTheDocument();
    expect(screen.getByText('jane@example.com')).toBeInTheDocument();
  });

  it('renders all nav items', () => {
    renderMenu();
    expect(screen.getByText('Overview')).toBeInTheDocument();
    expect(screen.getByText('Contracts')).toBeInTheDocument();
    expect(screen.getByText('Invoices')).toBeInTheDocument();
    expect(screen.getByText('Documents')).toBeInTheDocument();
    expect(screen.getByText('Time')).toBeInTheDocument();
    expect(screen.getByText('Equipment')).toBeInTheDocument();
    expect(screen.getByText('Payments')).toBeInTheDocument();
    expect(screen.getByText('Settings')).toBeInTheDocument();
  });

  it('renders nothing when closed', () => {
    renderMenu({ open: false });
    expect(screen.queryByText('Acme Corp')).not.toBeInTheDocument();
  });

  it('invokes menu.handleNavClick with the href when a nav item is clicked', async () => {
    const handleNavClick = vi.fn();
    const { user } = setup(
      <PortalMobileMenu
        open
        onOpenChange={vi.fn()}
        orgName="Acme"
        orgLogo={null}
        contractorName="Jane"
        contractorEmail="j@x.com"
        menu={makeMenu({ handleNavClick })}
      />,
    );
    await user.click(screen.getByText('Invoices'));
    expect(handleNavClick).toHaveBeenCalledWith('/portal/invoices');
  });

  it('invokes menu.handleLogout when the sign-out button is clicked', async () => {
    const handleLogout = vi.fn();
    const { user } = setup(
      <PortalMobileMenu
        open
        onOpenChange={vi.fn()}
        orgName="Acme"
        orgLogo={null}
        contractorName="Jane"
        contractorEmail="j@x.com"
        menu={makeMenu({ handleLogout })}
      />,
    );
    await user.click(screen.getByRole('button', { name: /sign out/i }));
    expect(handleLogout).toHaveBeenCalled();
  });

  it('marks the current pathname as the active nav item', () => {
    render(
      <PortalMobileMenu
        open
        onOpenChange={vi.fn()}
        orgName="Acme"
        orgLogo={null}
        contractorName="Jane"
        contractorEmail="j@x.com"
        menu={makeMenu({ pathname: '/portal/equipment' })}
      />,
    );
    // Sheet content renders in a portal, so query document.body
    const activeBtn = document.body.querySelector('button[aria-current="page"]');
    expect(activeBtn?.textContent).toContain('Equipment');
  });
});
