import { render, screen } from '@/test/test-utils';

// Hoisted mutable holder so each test can swap the data the mocked tRPC pins
// query returns without re-mocking modules.
const pinsHolder = vi.hoisted(() => ({
  data: [] as Array<{ kind: string; key: string; pinnedAt: Date }>,
}));

vi.mock('next/navigation', () => ({
  useSearchParams: () => new URLSearchParams(),
}));

vi.mock(import('@tanstack/react-query'), async importOriginal => {
  const actual = await importOriginal();
  return {
    ...actual,
    useQuery: () => ({ data: pinsHolder.data, isLoading: false, error: null }) as never,
  };
});

vi.mock('@/trpc/init', () => ({
  trpc: {
    user: {
      pins: {
        list: {
          queryOptions: (_input?: unknown) => ({ queryKey: ['user', 'pins', 'list'] }),
          queryKey: (_input?: unknown) => ['user', 'pins', 'list'],
        },
      },
    },
  },
}));

import { NavItems } from '../nav-items';

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
    {
      key: 'system',
      items: [{ key: 'settings', href: '/settings', icon: () => null, permission: null }],
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
  beforeEach(() => {
    pinsHolder.data = [];
  });

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

  it('renders pinned settings tabs in the system group when present', () => {
    pinsHolder.data = [
      { kind: 'settings-tab', key: 'integrations', pinnedAt: new Date('2026-01-01') },
      { kind: 'settings-tab', key: 'billing', pinnedAt: new Date('2026-01-02') },
    ];
    render(<NavItems />);
    expect(screen.getByText('Integrations')).toBeInTheDocument();
    expect(screen.getByText('Billing')).toBeInTheDocument();
  });

  it('skips pinned entries with unknown keys', () => {
    pinsHolder.data = [
      { kind: 'settings-tab', key: 'bogus-key', pinnedAt: new Date('2026-01-01') },
      { kind: 'settings-tab', key: 'integrations', pinnedAt: new Date('2026-01-02') },
    ];
    render(<NavItems />);
    expect(screen.getByText('Integrations')).toBeInTheDocument();
    expect(screen.queryByText('bogus-key')).not.toBeInTheDocument();
  });
});
