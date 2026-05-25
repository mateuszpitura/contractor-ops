/**
 * Step 10 port of apps/web/src/components/approvals/approval-queue/__tests__/side-panel.test.tsx.
 *
 * Web-vite split the panel into a container (`ApprovalSidePanelContainer`,
 * which owns the useApprovalActions hook) and a pure view
 * (`ApprovalSidePanelView`, which receives `actions` + `resolvedChain` as
 * props). Tests target the view with a shaped `actions` stub so we never need
 * tRPC or react-query, and assert against the real EN bundle.
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';

import { render, screen, setup, waitFor } from '../../../../test/test-utils.js';
import type { ApprovalQueueRow } from '../columns.js';
import type { ApprovalSidePanelProps } from '../side-panel.js';
import { ApprovalSidePanelView } from '../side-panel.js';

vi.mock('../../sla-badge.js', () => ({
  SlaBadge: () => <span data-testid="sla-badge">SLA</span>,
}));

type Actions = ApprovalSidePanelProps['actions'];

function makeActions(overrides: Partial<Actions> = {}): Actions {
  return {
    approve: vi.fn(),
    reject: vi.fn(),
    delegate: vi.fn(),
    requestClarification: vi.fn(),
    isPending: false,
    ...overrides,
  };
}

const baseStep: ApprovalQueueRow = {
  id: 'step-1',
  stepOrder: 1,
  name: 'Manager Review',
  status: 'PENDING',
  approverUserId: 'user-1',
  approverRole: 'ops_manager',
  slaDeadline: '2025-04-10T12:00:00Z',
  createdAt: '2025-04-01T10:00:00Z',
  approvalFlow: {
    id: 'flow-1',
    resourceId: 'inv-1',
    resourceType: 'INVOICE',
    status: 'IN_PROGRESS',
    startedAt: '2025-04-01T10:00:00Z',
    chainConfigId: 'chain-1',
  },
  approver: {
    id: 'user-1',
    name: 'John Doe',
    email: 'john@test.com',
    image: null,
  },
  invoice: {
    id: 'inv-1',
    invoiceNumber: 'FV/2025/001',
    sellerName: 'Acme Corp',
    totalMinor: 500000,
    currency: 'PLN',
    createdAt: '2025-04-01T09:00:00Z',
    contractor: {
      id: 'ct-1',
      legalName: 'Acme Corp',
    },
  },
  slaStatus: {
    level: 'warning',
    label: 'Expiring soon',
    percentage: 75,
    hoursRemaining: 12,
  },
};

const onOpenChange = vi.fn();

describe('ApprovalSidePanelView (web-vite)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders invoice number as title', () => {
    render(
      <ApprovalSidePanelView
        step={baseStep}
        open
        onOpenChange={onOpenChange}
        actions={makeActions()}
      />,
    );
    expect(screen.getByText('FV/2025/001')).toBeInTheDocument();
  });

  it('renders status badge', () => {
    render(
      <ApprovalSidePanelView
        step={baseStep}
        open
        onOpenChange={onOpenChange}
        actions={makeActions()}
      />,
    );
    expect(screen.getByText('PENDING')).toBeInTheDocument();
  });

  it('renders SLA badge', () => {
    render(
      <ApprovalSidePanelView
        step={baseStep}
        open
        onOpenChange={onOpenChange}
        actions={makeActions()}
      />,
    );
    expect(screen.getByTestId('sla-badge')).toBeInTheDocument();
  });

  it('renders contractor name as link', () => {
    render(
      <ApprovalSidePanelView
        step={baseStep}
        open
        onOpenChange={onOpenChange}
        actions={makeActions()}
      />,
    );
    // Contractor section + side-panel description both surface the name; assert presence.
    expect(screen.getAllByText('Acme Corp').length).toBeGreaterThanOrEqual(1);
  });

  it('renders approver name', () => {
    render(
      <ApprovalSidePanelView
        step={baseStep}
        open
        onOpenChange={onOpenChange}
        actions={makeActions()}
      />,
    );
    expect(screen.getByText('John Doe')).toBeInTheDocument();
  });

  it('shows approve and reject buttons for PENDING status', () => {
    render(
      <ApprovalSidePanelView
        step={baseStep}
        open
        onOpenChange={onOpenChange}
        actions={makeActions()}
      />,
    );
    expect(screen.getByText('Approve invoice')).toBeInTheDocument();
    expect(screen.getByText('Reject invoice')).toBeInTheDocument();
  });

  it('shows More dropdown trigger', () => {
    render(
      <ApprovalSidePanelView
        step={baseStep}
        open
        onOpenChange={onOpenChange}
        actions={makeActions()}
      />,
    );
    expect(screen.getByText('More')).toBeInTheDocument();
  });

  it('does not show action buttons for APPROVED status', () => {
    render(
      <ApprovalSidePanelView
        step={{ ...baseStep, status: 'APPROVED' }}
        open
        onOpenChange={onOpenChange}
        actions={makeActions()}
      />,
    );
    expect(screen.queryByText('Approve invoice')).not.toBeInTheDocument();
    expect(screen.queryByText('Reject invoice')).not.toBeInTheDocument();
  });

  it('does not show More button for non-PENDING status', () => {
    render(
      <ApprovalSidePanelView
        step={{ ...baseStep, status: 'APPROVED' }}
        open
        onOpenChange={onOpenChange}
        actions={makeActions()}
      />,
    );
    expect(screen.queryByText('More')).not.toBeInTheDocument();
  });

  it('renders the chain tracker heading', () => {
    render(
      <ApprovalSidePanelView
        step={baseStep}
        open
        onOpenChange={onOpenChange}
        actions={makeActions()}
      />,
    );
    expect(screen.getByText('Approval chain')).toBeInTheDocument();
  });

  it('falls back to email when approver name is null', () => {
    render(
      <ApprovalSidePanelView
        step={{
          ...baseStep,
          approver: { id: 'user-1', name: null, email: 'john@test.com', image: null },
        }}
        open
        onOpenChange={onOpenChange}
        actions={makeActions()}
      />,
    );
    expect(screen.getByText('john@test.com')).toBeInTheDocument();
  });

  it('calls actions.approve when Approve invoice is clicked', async () => {
    const actions = makeActions();
    const { user } = setup(
      <ApprovalSidePanelView step={baseStep} open onOpenChange={onOpenChange} actions={actions} />,
    );
    await user.click(screen.getByText('Approve invoice'));
    expect(actions.approve).toHaveBeenCalledTimes(1);
  });

  it('renders APPROVED status label without action buttons', () => {
    render(
      <ApprovalSidePanelView
        step={{ ...baseStep, status: 'APPROVED' }}
        open
        onOpenChange={onOpenChange}
        actions={makeActions()}
      />,
    );
    expect(screen.getByText('APPROVED')).toBeInTheDocument();
    expect(screen.queryByText('Approve invoice')).not.toBeInTheDocument();
  });

  it('renders REJECTED status label without action buttons', () => {
    render(
      <ApprovalSidePanelView
        step={{ ...baseStep, status: 'REJECTED' }}
        open
        onOpenChange={onOpenChange}
        actions={makeActions()}
      />,
    );
    expect(screen.getByText('REJECTED')).toBeInTheDocument();
    expect(screen.queryByText('Approve invoice')).not.toBeInTheDocument();
    expect(screen.queryByText('Reject invoice')).not.toBeInTheDocument();
  });

  it('renders contractor link with locale-prefixed href', () => {
    render(
      <ApprovalSidePanelView
        step={baseStep}
        open
        onOpenChange={onOpenChange}
        actions={makeActions()}
      />,
    );
    const links = screen.getAllByText('Acme Corp');
    const anchor = links.map(el => el.closest('a')).find(Boolean);
    expect(anchor?.getAttribute('href')).toBe('/en/contractors/ct-1');
  });

  it('renders Amount section header', () => {
    render(
      <ApprovalSidePanelView
        step={baseStep}
        open
        onOpenChange={onOpenChange}
        actions={makeActions()}
      />,
    );
    expect(screen.getByText('Amount')).toBeInTheDocument();
  });

  it('renders Approver section header', () => {
    render(
      <ApprovalSidePanelView
        step={baseStep}
        open
        onOpenChange={onOpenChange}
        actions={makeActions()}
      />,
    );
    expect(screen.getByText('Approver')).toBeInTheDocument();
  });

  it('renders Contractor section header', () => {
    render(
      <ApprovalSidePanelView
        step={baseStep}
        open
        onOpenChange={onOpenChange}
        actions={makeActions()}
      />,
    );
    expect(screen.getByText('Contractor')).toBeInTheDocument();
  });

  it('renders Submitted section header', () => {
    render(
      <ApprovalSidePanelView
        step={baseStep}
        open
        onOpenChange={onOpenChange}
        actions={makeActions()}
      />,
    );
    expect(screen.getByText('Submitted')).toBeInTheDocument();
  });

  it('renders CANCELLED status without action buttons', () => {
    render(
      <ApprovalSidePanelView
        step={{ ...baseStep, status: 'CANCELLED' }}
        open
        onOpenChange={onOpenChange}
        actions={makeActions()}
      />,
    );
    expect(screen.getByText('CANCELLED')).toBeInTheDocument();
    expect(screen.queryByText('Approve invoice')).not.toBeInTheDocument();
    expect(screen.queryByText('More')).not.toBeInTheDocument();
  });

  it('opens reject popover when reject button is clicked', async () => {
    const { user } = setup(
      <ApprovalSidePanelView
        step={baseStep}
        open
        onOpenChange={onOpenChange}
        actions={makeActions()}
      />,
    );
    await user.click(screen.getByText('Reject invoice'));
    await waitFor(() => {
      // h4 + button both labelled "Reject invoice"; require at least 2 once open.
      expect(screen.getAllByText('Reject invoice').length).toBeGreaterThanOrEqual(2);
    });
  });

  it('shows reject reason validation when comment is too short', async () => {
    const { user } = setup(
      <ApprovalSidePanelView
        step={baseStep}
        open
        onOpenChange={onOpenChange}
        actions={makeActions()}
      />,
    );
    await user.click(screen.getByText('Reject invoice'));
    const textarea = (await screen.findAllByRole('textbox'))[0] as HTMLTextAreaElement;
    await user.type(textarea, 'short');
    await waitFor(() => {
      expect(screen.getByText(/at least 10 characters/i)).toBeInTheDocument();
    });
  });

  it('calls actions.reject with comment when confirmed', async () => {
    const actions = makeActions();
    const { user } = setup(
      <ApprovalSidePanelView step={baseStep} open onOpenChange={onOpenChange} actions={actions} />,
    );
    await user.click(screen.getByText('Reject invoice'));
    const textarea = (await screen.findAllByRole('textbox'))[0] as HTMLTextAreaElement;
    await user.type(textarea, 'This invoice has incorrect amounts');
    const confirmBtns = screen.getAllByRole('button', { name: /reject invoice/i });
    await user.click(confirmBtns[confirmBtns.length - 1] as HTMLButtonElement);
    expect(actions.reject).toHaveBeenCalledWith('This invoice has incorrect amounts');
  });

  it('opens clarification overlay via More dropdown', async () => {
    const { user } = setup(
      <ApprovalSidePanelView
        step={baseStep}
        open
        onOpenChange={onOpenChange}
        actions={makeActions()}
      />,
    );
    await user.click(screen.getByText('More'));
    await waitFor(() => {
      expect(screen.getByText('Request clarification')).toBeInTheDocument();
    });
    await user.click(screen.getByText('Request clarification'));
    await waitFor(() => {
      // Clarify overlay heading + Send request button confirm it opened.
      expect(screen.getByText('Send request')).toBeInTheDocument();
      expect(screen.getByText("Don't send")).toBeInTheDocument();
    });
  });

  it('opens delegate overlay via More dropdown', async () => {
    const { user } = setup(
      <ApprovalSidePanelView
        step={baseStep}
        open
        onOpenChange={onOpenChange}
        actions={makeActions()}
      />,
    );
    await user.click(screen.getByText('More'));
    await waitFor(() => {
      expect(screen.getByText('Delegate approval')).toBeInTheDocument();
    });
    await user.click(screen.getByText('Delegate approval'));
    await waitFor(() => {
      expect(screen.getByText('Delegate to')).toBeInTheDocument();
      expect(screen.getByText('Note (optional)')).toBeInTheDocument();
      expect(screen.getByText('Keep assigned')).toBeInTheDocument();
    });
  });

  it('disables clarification send when comment is empty', async () => {
    const { user } = setup(
      <ApprovalSidePanelView
        step={baseStep}
        open
        onOpenChange={onOpenChange}
        actions={makeActions()}
      />,
    );
    await user.click(screen.getByText('More'));
    await user.click(await screen.findByText('Request clarification'));
    const sendBtn = (await screen.findByText('Send request')).closest('button');
    expect(sendBtn).toBeDisabled();
  });

  it('submits clarification request with comment', async () => {
    const actions = makeActions();
    const { user } = setup(
      <ApprovalSidePanelView step={baseStep} open onOpenChange={onOpenChange} actions={actions} />,
    );
    await user.click(screen.getByText('More'));
    await user.click(await screen.findByText('Request clarification'));
    // Overlay textarea is rendered via the ClarifyOverlay portal; query the DOM
    // tree directly because shadcn Textarea sets data-slot but may not always
    // expose role="textbox" reliably when nested under portal+role="dialog".
    await screen.findByText('Send request');
    const textareas = document.querySelectorAll('textarea');
    await user.type(
      textareas[textareas.length - 1] as HTMLTextAreaElement,
      'Please provide a breakdown of line items',
    );
    await user.click(screen.getByText('Send request'));
    expect(actions.requestClarification).toHaveBeenCalledWith(
      'Please provide a breakdown of line items',
    );
  });

  it('disables delegate confirm when user ID is empty', async () => {
    const { user } = setup(
      <ApprovalSidePanelView
        step={baseStep}
        open
        onOpenChange={onOpenChange}
        actions={makeActions()}
      />,
    );
    await user.click(screen.getByText('More'));
    await user.click(await screen.findByText('Delegate approval'));
    // After the overlay opens, the confirm button shares the "Delegate approval"
    // label with the h4 heading. Resolve via DOM queries on <button> elements.
    await screen.findByText('Delegate to');
    const buttons = Array.from(document.querySelectorAll('button')).filter(
      b => b.textContent?.trim() === 'Delegate approval',
    );
    expect(buttons.length).toBeGreaterThanOrEqual(1);
    expect(buttons[buttons.length - 1]).toBeDisabled();
  });

  it('submits delegate request with user ID and note', async () => {
    const actions = makeActions();
    const { user } = setup(
      <ApprovalSidePanelView step={baseStep} open onOpenChange={onOpenChange} actions={actions} />,
    );
    await user.click(screen.getByText('More'));
    await user.click(await screen.findByText('Delegate approval'));
    await screen.findByText('Delegate to');
    // Query the underlying DOM nodes for the overlay's input + textarea — shadcn
    // wrappers occasionally lose the implicit role under the portal.
    const inputs = document.querySelectorAll('input');
    const textareas = document.querySelectorAll('textarea');
    await user.type(inputs[inputs.length - 1] as HTMLInputElement, 'user-delegate-99');
    await user.type(
      textareas[textareas.length - 1] as HTMLTextAreaElement,
      'Out of office, please review',
    );
    const confirmBtns = Array.from(document.querySelectorAll('button')).filter(
      b => b.textContent?.trim() === 'Delegate approval',
    );
    await user.click(confirmBtns[confirmBtns.length - 1] as HTMLButtonElement);
    expect(actions.delegate).toHaveBeenCalledWith(
      'user-delegate-99',
      'Out of office, please review',
    );
  });

  it('does not render contractor section when contractor is null', () => {
    render(
      <ApprovalSidePanelView
        step={{
          ...baseStep,
          invoice: {
            ...(baseStep.invoice as NonNullable<typeof baseStep.invoice>),
            contractor: null,
          },
        }}
        open
        onOpenChange={onOpenChange}
        actions={makeActions()}
      />,
    );
    // No contractor link, but seller name 'Acme Corp' is still in description text.
    expect(screen.queryByRole('link', { name: 'Acme Corp' })).not.toBeInTheDocument();
  });

  it('does not render approver section when approver is null', () => {
    render(
      <ApprovalSidePanelView
        step={{ ...baseStep, approver: null }}
        open
        onOpenChange={onOpenChange}
        actions={makeActions()}
      />,
    );
    expect(screen.queryByText('John Doe')).not.toBeInTheDocument();
  });
});
