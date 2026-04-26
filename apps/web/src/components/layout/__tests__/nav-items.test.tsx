import { render, screen } from '@/test/test-utils';
import { NavItems } from '../nav-items';

vi.mock('next/navigation', () => ({
  useSearchParams: () => new URLSearchParams(),
}));

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
  usePathname: () => '/dashboard',
}));

vi.mock('@/hooks/use-permissions', () => ({
  usePermissions: () => ({ can: () => true, isLoading: false }),
}));

vi.mock('@/lib/navigation', () => ({
  navigationGroups: [
    {
      key: 'overview',
      items: [{ key: 'dashboard', href: '/dashboard', icon: () => null }],
    },
    {
      key: 'operations',
      items: [
        { key: 'contractors', href: '/contractors', icon: () => null },
        { key: 'workflows', href: '/workflows', icon: () => null },
      ],
    },
  ],
}));

vi.mock('@/components/workflows/workflow-nav-badge', () => ({
  WorkflowNavBadge: () => null,
}));

vi.mock('@/components/layout/feature-flag-context', () => ({
  useFlagBag: () => ({}),
  FeatureFlagProvider: ({ children }: { children: React.ReactNode }) => children,
}));

vi.mock('@/components/ui/sidebar', () => ({
  SidebarGroup: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  SidebarGroupLabel: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  SidebarMenu: ({ children }: { children: React.ReactNode }) => <ul>{children}</ul>,
  SidebarMenuButton: ({
    children,
    ...props
  }: {
    children: React.ReactNode;
    [key: string]: unknown;
  }) => <button {...(props as React.ButtonHTMLAttributes<HTMLButtonElement>)}>{children}</button>,
  SidebarMenuItem: ({ children }: { children: React.ReactNode }) => <li>{children}</li>,
}));

describe('NavItems', () => {
  it('renders navigation items', () => {
    render(<NavItems />);
    expect(screen.getByText('Dashboard')).toBeInTheDocument();
    expect(screen.getByText('Contractors')).toBeInTheDocument();
    expect(screen.getByText('Workflows')).toBeInTheDocument();
  });

  it('renders group labels for non-overview groups', () => {
    render(<NavItems />);
    expect(screen.getByText(/Operations/i)).toBeInTheDocument();
  });
});
