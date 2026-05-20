import { render, screen } from '@/test/test-utils';
import { AppSidebar } from '../sidebar';

vi.mock('@contractor-ops/ui/components/shadcn/sidebar', () => ({
  Sidebar: ({ children }: { children: React.ReactNode }) => (
    <nav data-testid="sidebar">{children}</nav>
  ),
  SidebarContent: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  SidebarFooter: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  SidebarHeader: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  SidebarMenu: ({ children }: { children: React.ReactNode }) => <ul>{children}</ul>,
  SidebarMenuItem: ({ children }: { children: React.ReactNode }) => <li>{children}</li>,
  SidebarRail: () => null,
}));

vi.mock('@/components/layout/nav-items', () => ({
  NavItems: () => <div data-testid="nav-items">NavItems</div>,
}));

vi.mock('@/components/layout/org-switcher', () => ({
  OrgSwitcher: () => <div data-testid="org-switcher">OrgSwitcher</div>,
}));

vi.mock('@/components/layout/user-menu', () => ({
  UserMenu: () => <div data-testid="user-menu">UserMenu</div>,
}));

describe('AppSidebar', () => {
  it('renders sidebar with all sections', () => {
    render(<AppSidebar />);
    expect(screen.getByTestId('sidebar')).toBeInTheDocument();
    expect(screen.getByTestId('org-switcher')).toBeInTheDocument();
    expect(screen.getByTestId('nav-items')).toBeInTheDocument();
    expect(screen.getByTestId('user-menu')).toBeInTheDocument();
  });
});
