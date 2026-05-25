/**
 * Step 10 port of apps/web/src/components/layout/__tests__/top-bar.test.tsx.
 *
 * The web-vite TopBar is purely presentational: it receives breadcrumb
 * segments, a `hasContractors` flag, and navigation callbacks. The dialogs
 * (contract wizard + command palette) and the notification popover are
 * container-owned. We mock those plus the shadcn `sidebar`/`tooltip`
 * primitives to keep this test focused on the visible nav surface.
 */

import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { afterEach, describe, expect, it, vi } from 'vitest';

vi.mock('@contractor-ops/ui/components/shadcn/sidebar', () => ({
  SidebarTrigger: ({ className }: { className?: string }) => (
    <button type="button" className={className} data-testid="sidebar-trigger" />
  ),
}));

vi.mock('@contractor-ops/ui/components/shadcn/tooltip', () => ({
  Tooltip: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  TooltipTrigger: ({
    render,
    children,
  }: {
    render?: React.ReactElement;
    children: React.ReactNode;
  }) => {
    if (render) {
      return <render.type {...(render.props as object)}>{children}</render.type>;
    }
    return <>{children}</>;
  },
  TooltipContent: ({ children }: { children: React.ReactNode }) => <span>{children}</span>,
  TooltipProvider: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

vi.mock('../../contracts/contract-wizard/wizard-dialog-container.js', () => ({
  ContractWizardDialogContainer: ({ open }: { open: boolean }) =>
    open ? <div data-testid="contract-wizard">wizard</div> : null,
}));

vi.mock('../../notifications/notification-popover-container.js', () => ({
  NotificationPopoverContainer: () => <div data-testid="notification-popover" />,
}));

vi.mock('../../search/command-palette-container.js', () => ({
  CommandPaletteContainer: () => <div data-testid="command-palette" />,
}));

import type { BreadcrumbSegmentView } from '../hooks/use-top-bar-breadcrumbs.js';
import { TopBar } from '../top-bar.js';
import { click, findButton, mount } from './_render.js';

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

const baseProps = {
  hasContractors: true,
  navigateToNewContractor: vi.fn(),
  navigateToUploadInvoice: vi.fn(),
  segments: [] as BreadcrumbSegmentView[],
  contractWizardOpen: false,
  onContractWizardOpenChange: vi.fn(),
  onOpenContractWizard: vi.fn(),
  onOpenSearch: vi.fn(),
};

describe('TopBar (web-vite)', () => {
  it('renders the dashboard fallback breadcrumb when no segments are supplied', async () => {
    const { container } = await mount(withRouter(<TopBar {...baseProps} />));
    expect(container.textContent ?? '').toContain('Dashboard');
  });

  it('renders breadcrumb segments with the last one as a page label', async () => {
    const segments: BreadcrumbSegmentView[] = [
      { segment: 'contractors', label: 'Contractors', href: '/contractors', isLast: false },
      { segment: 'c-1', label: 'Acme', href: '/contractors/c-1', isLast: true },
    ];
    const { container } = await mount(withRouter(<TopBar {...baseProps} segments={segments} />));
    expect(container.textContent).toContain('Contractors');
    expect(container.textContent).toContain('Acme');
  });

  it('renders the notification popover slot', async () => {
    const { container } = await mount(withRouter(<TopBar {...baseProps} />));
    expect(container.querySelector('[data-testid="notification-popover"]')).not.toBeNull();
  });

  it('renders the command palette container', async () => {
    const { container } = await mount(withRouter(<TopBar {...baseProps} />));
    expect(container.querySelector('[data-testid="command-palette"]')).not.toBeNull();
  });

  it('invokes navigateToNewContractor when the add-contractor button is clicked', async () => {
    const navigateToNewContractor = vi.fn();
    const { container } = await mount(
      withRouter(<TopBar {...baseProps} navigateToNewContractor={navigateToNewContractor} />),
    );
    const btn = Array.from(container.querySelectorAll('button')).find(b =>
      (b.textContent ?? '').includes('Add contractor'),
    );
    expect(btn).toBeDefined();
    await click(btn as HTMLButtonElement);
    expect(navigateToNewContractor).toHaveBeenCalledTimes(1);
  });

  it('marks contract and upload buttons aria-disabled when there are no contractors', async () => {
    const { container } = await mount(withRouter(<TopBar {...baseProps} hasContractors={false} />));
    const disabledBtns = Array.from(container.querySelectorAll('button')).filter(
      b => b.getAttribute('aria-disabled') === 'true',
    );
    // New contract + upload invoice both go disabled without contractors.
    expect(disabledBtns.length).toBeGreaterThanOrEqual(2);
  });

  it('invokes onOpenContractWizard when New contract is clicked and contractors exist', async () => {
    const onOpenContractWizard = vi.fn();
    const { container } = await mount(
      withRouter(<TopBar {...baseProps} onOpenContractWizard={onOpenContractWizard} />),
    );
    const btn = Array.from(container.querySelectorAll('button')).find(b =>
      (b.textContent ?? '').includes('New contract'),
    );
    expect(btn).toBeDefined();
    await click(btn as HTMLButtonElement);
    expect(onOpenContractWizard).toHaveBeenCalledTimes(1);
  });

  it('invokes onOpenSearch when the search trigger is clicked', async () => {
    const onOpenSearch = vi.fn();
    const { container } = await mount(
      withRouter(<TopBar {...baseProps} onOpenSearch={onOpenSearch} />),
    );
    const search = findButton(container, /search/i);
    expect(search).not.toBeNull();
    await click(search as HTMLButtonElement);
    expect(onOpenSearch).toHaveBeenCalled();
  });

  it('renders the contract wizard slot only when contractWizardOpen is true', async () => {
    const { container: closed } = await mount(withRouter(<TopBar {...baseProps} />));
    expect(closed.querySelector('[data-testid="contract-wizard"]')).toBeNull();

    const { container: open } = await mount(
      withRouter(<TopBar {...baseProps} contractWizardOpen={true} />),
    );
    expect(open.querySelector('[data-testid="contract-wizard"]')).not.toBeNull();
  });
});
