/**
 * Step 10 port of apps/web/src/components/layout/__tests__/org-switcher.test.tsx.
 *
 * The web-vite OrgSwitcher is the pure presentational counterpart of the
 * container — it receives `currentOrg`, `organizations`, `onOrgSwitch`
 * and renders the dropdown header + item list. The shadcn `useSidebar`
 * hook normally requires a `<SidebarProvider>` ancestor, so we stub the
 * sidebar primitives to plain elements and keep the dropdown primitives
 * trivial enough to assert against.
 */

import { afterEach, describe, expect, it, vi } from 'vitest';

vi.mock('@contractor-ops/ui/components/shadcn/sidebar', () => ({
  useSidebar: () => ({ isMobile: false }),
  SidebarMenuButton: ({ children }: { children: React.ReactNode }) => (
    <button type="button">{children}</button>
  ),
}));

vi.mock('@contractor-ops/ui/components/shadcn/dropdown-menu', () => ({
  DropdownMenu: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  DropdownMenuTrigger: ({
    render,
    children,
  }: {
    render?: React.ReactElement;
    children: React.ReactNode;
  }) => {
    if (render) {
      return <render.type {...(render.props as object)}>{children}</render.type>;
    }
    return <div>{children}</div>;
  },
  DropdownMenuContent: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="dropdown-content">{children}</div>
  ),
  DropdownMenuItem: ({
    children,
    onClick,
    disabled,
  }: {
    children: React.ReactNode;
    onClick?: () => void;
    disabled?: boolean;
    className?: string;
  }) => (
    <button type="button" onClick={onClick} disabled={disabled} data-testid="org-item">
      {children}
    </button>
  ),
  DropdownMenuLabel: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  DropdownMenuSeparator: () => <hr />,
}));

import { OrgSwitcher } from '../org-switcher.js';
import { click, mount } from './_render.js';

afterEach(() => {
  document.body.innerHTML = '';
  vi.clearAllMocks();
});

const currentOrg = { id: 'org-1', name: 'Acme Corp', slug: 'acme', logo: null };

const organizations = [
  { id: 'org-1', name: 'Acme Corp' },
  { id: 'org-2', name: 'Beta Inc' },
];

describe('OrgSwitcher (web-vite)', () => {
  it('renders the current org name in the trigger', async () => {
    const { container } = await mount(
      <OrgSwitcher currentOrg={currentOrg} organizations={organizations} onOrgSwitch={vi.fn()} />,
    );
    expect(container.textContent).toContain('Acme Corp');
  });

  it('renders the leading letter avatar from the current org name', async () => {
    const { container } = await mount(
      <OrgSwitcher currentOrg={currentOrg} organizations={organizations} onOrgSwitch={vi.fn()} />,
    );
    expect(container.textContent).toContain('A');
  });

  it('falls back to the "Select organization" label when currentOrg is null', async () => {
    const { container } = await mount(
      <OrgSwitcher currentOrg={null} organizations={organizations} onOrgSwitch={vi.fn()} />,
    );
    expect(container.textContent).toContain('Select organization');
  });

  it('renders one dropdown item per organization', async () => {
    const { container } = await mount(
      <OrgSwitcher currentOrg={currentOrg} organizations={organizations} onOrgSwitch={vi.fn()} />,
    );
    const items = container.querySelectorAll('[data-testid="org-item"]');
    expect(items.length).toBe(2);
  });

  it('renders a disabled placeholder when there are no other organizations', async () => {
    const { container } = await mount(
      <OrgSwitcher currentOrg={currentOrg} organizations={[]} onOrgSwitch={vi.fn()} />,
    );
    const items = Array.from(
      container.querySelectorAll<HTMLButtonElement>('[data-testid="org-item"]'),
    );
    expect(items.length).toBe(1);
    expect(items[0].disabled).toBe(true);
    expect(items[0].textContent).toContain('Select organization');
  });

  it('invokes onOrgSwitch with the chosen org id', async () => {
    const onOrgSwitch = vi.fn();
    const { container } = await mount(
      <OrgSwitcher
        currentOrg={currentOrg}
        organizations={organizations}
        onOrgSwitch={onOrgSwitch}
      />,
    );
    const items = Array.from(
      container.querySelectorAll<HTMLButtonElement>('[data-testid="org-item"]'),
    );
    await click(items[1]);
    expect(onOrgSwitch).toHaveBeenCalledWith('org-2');
  });
});
