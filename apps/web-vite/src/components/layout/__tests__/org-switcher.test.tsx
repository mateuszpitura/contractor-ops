/**
 * Step 10 port of apps/web/src/components/layout/__tests__/org-switcher.test.tsx.
 *
 * The web-vite OrgSwitcher is the pure presentational counterpart of the
 * container — it receives `currentOrg`, `organizations`, `onOrgSwitch`,
 * `onCreateOrg`, `isCreating` and renders the dropdown header + item list
 * plus an Add-organization affordance. The shadcn `useSidebar` hook
 * normally requires a `<SidebarProvider>` ancestor, so we stub the
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

vi.mock('@contractor-ops/ui/components/shadcn/dialog', () => ({
  Dialog: ({ open, children }: { open?: boolean; children: React.ReactNode }) =>
    open ? <div data-testid="dialog">{children}</div> : null,
  DialogContent: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  DialogHeader: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  DialogFooter: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  DialogTitle: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  DialogDescription: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}));

vi.mock('@contractor-ops/ui/components/shadcn/button', () => ({
  Button: ({
    children,
    onClick,
    type,
    disabled,
  }: {
    children: React.ReactNode;
    onClick?: () => void;
    type?: 'button' | 'submit';
    disabled?: boolean;
  }) => (
    <button type={type ?? 'button'} onClick={onClick} disabled={disabled}>
      {children}
    </button>
  ),
}));

vi.mock('@contractor-ops/ui/components/shadcn/input', () => ({
  Input: (props: React.InputHTMLAttributes<HTMLInputElement>) => <input {...props} />,
}));

vi.mock('@contractor-ops/ui/components/shadcn/label', () => ({
  Label: ({ children, htmlFor }: { children: React.ReactNode; htmlFor?: string }) => (
    <label htmlFor={htmlFor}>{children}</label>
  ),
}));

import { OrgSwitcher, OrgSwitcherEmpty } from '../org-switcher.js';
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

const noopCreate = vi.fn().mockResolvedValue({ ok: true });

describe('OrgSwitcher (web-vite)', () => {
  it('renders the current org name in the trigger', async () => {
    const { container } = await mount(
      <OrgSwitcher
        currentOrg={currentOrg}
        organizations={organizations}
        onOrgSwitch={vi.fn()}
        onCreateOrg={noopCreate}
        isCreating={false}
      />,
    );
    expect(container.textContent).toContain('Acme Corp');
  });

  it('renders the leading letter avatar from the current org name', async () => {
    const { container } = await mount(
      <OrgSwitcher
        currentOrg={currentOrg}
        organizations={organizations}
        onOrgSwitch={vi.fn()}
        onCreateOrg={noopCreate}
        isCreating={false}
      />,
    );
    expect(container.textContent).toContain('A');
  });

  it('falls back to the "Select organization" label when currentOrg is null', async () => {
    const { container } = await mount(
      <OrgSwitcher
        currentOrg={null}
        organizations={organizations}
        onOrgSwitch={vi.fn()}
        onCreateOrg={noopCreate}
        isCreating={false}
      />,
    );
    expect(container.textContent).toContain('Select organization');
  });

  it('renders one dropdown item per organization plus an add-org item', async () => {
    const { container } = await mount(
      <OrgSwitcher
        currentOrg={currentOrg}
        organizations={organizations}
        onOrgSwitch={vi.fn()}
        onCreateOrg={noopCreate}
        isCreating={false}
      />,
    );
    const items = container.querySelectorAll('[data-testid="org-item"]');
    expect(items.length).toBe(organizations.length + 1);
    expect(items[items.length - 1]?.textContent).toContain('Add organization');
  });

  it('invokes onOrgSwitch with the chosen org id', async () => {
    const onOrgSwitch = vi.fn();
    const { container } = await mount(
      <OrgSwitcher
        currentOrg={currentOrg}
        organizations={organizations}
        onOrgSwitch={onOrgSwitch}
        onCreateOrg={noopCreate}
        isCreating={false}
      />,
    );
    const items = Array.from(
      container.querySelectorAll<HTMLButtonElement>('[data-testid="org-item"]'),
    );
    await click(items[1]);
    expect(onOrgSwitch).toHaveBeenCalledWith('org-2');
  });
});

describe('OrgSwitcherEmpty (web-vite)', () => {
  it('renders a disabled placeholder plus an add-org item', async () => {
    const { container } = await mount(
      <OrgSwitcherEmpty currentOrg={currentOrg} onCreateOrg={noopCreate} isCreating={false} />,
    );
    const items = Array.from(
      container.querySelectorAll<HTMLButtonElement>('[data-testid="org-item"]'),
    );
    expect(items.length).toBe(2);
    expect(items[0].disabled).toBe(true);
    expect(items[0].textContent).toContain('Select organization');
    expect(items[1].disabled).toBe(false);
    expect(items[1].textContent).toContain('Add organization');
  });

  it('renders the current org name in the trigger when one is set', async () => {
    const { container } = await mount(
      <OrgSwitcherEmpty currentOrg={currentOrg} onCreateOrg={noopCreate} isCreating={false} />,
    );
    expect(container.textContent).toContain('Acme Corp');
  });

  it('falls back to the "Select organization" label when currentOrg is null', async () => {
    const { container } = await mount(
      <OrgSwitcherEmpty currentOrg={null} onCreateOrg={noopCreate} isCreating={false} />,
    );
    expect(container.textContent).toContain('Select organization');
  });
});
