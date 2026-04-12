import { render, screen } from '@/test/test-utils';
import { TopBar } from '../top-bar';

vi.mock('@/i18n/navigation', () => ({
  Link: ({ children, href, ...props }: any) => (
    <a href={href} {...props}>
      {children}
    </a>
  ),
  usePathname: () => '/contractors',
  useRouter: () => ({ push: vi.fn() }),
}));

vi.mock('@/components/layout/breadcrumb-context', () => ({
  useBreadcrumbContext: () => ({ overrides: new Map() }),
}));

vi.mock('@/components/ui/sidebar', () => ({
  SidebarTrigger: () => <button data-testid="sidebar-trigger">Menu</button>,
}));

vi.mock('@/components/contracts/contract-wizard/wizard-dialog', () => ({
  ContractWizardDialog: () => null,
}));

vi.mock('@/components/notifications/notification-popover', () => ({
  NotificationPopover: () => null,
}));

vi.mock('@/components/search/search-provider', () => ({
  useSearch: () => ({ setOpen: vi.fn() }),
}));

vi.mock('@/components/search/command-palette', () => ({
  CommandPalette: () => null,
}));

describe('TopBar', () => {
  it('renders sidebar trigger', () => {
    render(<TopBar />);
    expect(screen.getByTestId('sidebar-trigger')).toBeInTheDocument();
  });

  it('renders breadcrumb with pathname segment', () => {
    render(<TopBar />);
    expect(screen.getByText('Contractors')).toBeInTheDocument();
  });

  it('renders quick action buttons', () => {
    render(<TopBar />);
    expect(screen.getByText('Add contractor')).toBeInTheDocument();
    expect(screen.getByText('New contract')).toBeInTheDocument();
    expect(screen.getByText('Upload invoice')).toBeInTheDocument();
  });
});
