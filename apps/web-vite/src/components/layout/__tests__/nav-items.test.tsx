/**
 * Step 10 port of apps/web/src/components/layout/__tests__/nav-items.test.tsx.
 *
 * The web-vite NavItems is purely presentational — it consumes a shaped
 * `groups` prop (NavItemsGroupView[]) instead of pulling pins from tRPC.
 * The container owns query + permission gating; this test pins the
 * sidebar group/label/item rendering and the active-route attribute.
 */

import { LayoutDashboard, Settings, Users } from 'lucide-react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { afterEach, describe, expect, it, vi } from 'vitest';

vi.mock('../../workflows/workflow-nav-badge-container.js', () => ({
  WorkflowNavBadgeContainer: () => <span data-testid="workflow-badge" />,
}));

vi.mock('@contractor-ops/ui/components/shadcn/sidebar', () => ({
  SidebarGroup: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  SidebarGroupLabel: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="group-label">{children}</div>
  ),
  SidebarMenu: ({ children }: { children: React.ReactNode }) => <ul>{children}</ul>,
  SidebarMenuButton: ({
    render,
    children,
    isActive,
  }: {
    render?: React.ReactElement;
    children: React.ReactNode;
    isActive?: boolean;
    tooltip?: string;
  }) => {
    if (render) {
      // Forward render-prop pattern: clone the `Link` and inject children.
      return <>{<render.type {...(render.props as object)}>{children}</render.type>}</>;
    }
    return (
      <button type="button" data-active={isActive || undefined}>
        {children}
      </button>
    );
  },
  SidebarMenuItem: ({ children }: { children: React.ReactNode }) => <li>{children}</li>,
}));

import type { NavItemsGroupView } from '../hooks/use-nav-items.js';
import { NavItems } from '../nav-items.js';
import { mount } from './_render.js';

afterEach(() => {
  document.body.innerHTML = '';
  vi.clearAllMocks();
});

function withRouter(node: React.ReactElement) {
  return (
    <MemoryRouter initialEntries={['/en/dashboard']}>
      <Routes>
        <Route path="/:locale/*" element={node} />
      </Routes>
    </MemoryRouter>
  );
}

const sampleGroups: NavItemsGroupView[] = [
  {
    key: 'overview',
    label: null,
    items: [
      {
        key: 'dashboard',
        href: '/dashboard',
        label: 'Dashboard',
        icon: LayoutDashboard,
        isActive: true,
        showWorkflowBadge: false,
      },
    ],
    pinnedTabs: [],
  },
  {
    key: 'operations',
    label: 'Operations',
    items: [
      {
        key: 'contractors',
        href: '/contractors',
        label: 'Contractors',
        icon: Users,
        isActive: false,
        showWorkflowBadge: false,
      },
      {
        key: 'workflows',
        href: '/workflows',
        label: 'Workflows',
        icon: Users,
        isActive: false,
        showWorkflowBadge: true,
      },
    ],
    pinnedTabs: [],
  },
  {
    key: 'system',
    label: 'System',
    items: [
      {
        key: 'settings',
        href: '/settings',
        label: 'Settings',
        icon: Settings,
        isActive: false,
        showWorkflowBadge: false,
      },
    ],
    pinnedTabs: [],
  },
];

describe('NavItems (web-vite)', () => {
  it('renders one item per provided group item', async () => {
    const { container } = await mount(withRouter(<NavItems groups={sampleGroups} />));
    expect(container.textContent).toContain('Dashboard');
    expect(container.textContent).toContain('Contractors');
    expect(container.textContent).toContain('Workflows');
    expect(container.textContent).toContain('Settings');
  });

  it('renders the human-readable label for non-overview groups', async () => {
    const { container } = await mount(withRouter(<NavItems groups={sampleGroups} />));
    const labels = Array.from(container.querySelectorAll('[data-testid="group-label"]')).map(
      el => el.textContent ?? '',
    );
    expect(labels).toContain('Operations');
    expect(labels).toContain('System');
  });

  it('omits the group label for the overview group', async () => {
    const { container } = await mount(withRouter(<NavItems groups={sampleGroups} />));
    const labels = Array.from(container.querySelectorAll('[data-testid="group-label"]')).map(
      el => el.textContent ?? '',
    );
    // Overview group has label=null, so its label cell never renders.
    expect(labels.every(l => l !== '')).toBe(true);
  });

  it('renders the workflow badge slot only for items that opt in', async () => {
    const { container } = await mount(withRouter(<NavItems groups={sampleGroups} />));
    const badges = container.querySelectorAll('[data-testid="workflow-badge"]');
    expect(badges.length).toBe(1);
  });

  it('passes aria-current="page" to the active item link', async () => {
    const { container } = await mount(withRouter(<NavItems groups={sampleGroups} />));
    const activeLink = Array.from(container.querySelectorAll('a')).find(
      a => a.getAttribute('aria-current') === 'page',
    );
    expect(activeLink).toBeDefined();
    expect(activeLink?.textContent).toContain('Dashboard');
  });

  it('renders nothing extra for an empty groups array', async () => {
    const { container } = await mount(withRouter(<NavItems groups={[]} />));
    expect(container.querySelectorAll('li').length).toBe(0);
  });
});
