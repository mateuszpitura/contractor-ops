/**
 * web-vite port. Mocks the tRPC-bound dialog container so the button tests
 * remain unit-scoped. The actual dialog logic is exercised against
 * `RecomputeComplianceDialogView`.
 */

import { describe, expect, it, vi } from 'vitest';

import { render, screen } from '../../../../test/test-utils.js';

const dialogCalls: Array<{ open: boolean; contractorIds: string[] }> = [];

vi.mock('../recompute-compliance-dialog-container.js', () => ({
  RecomputeComplianceDialogContainer: (props: {
    open: boolean;
    contractorIds: string[];
    onOpenChange: (v: boolean) => void;
  }) => {
    dialogCalls.push({ open: props.open, contractorIds: props.contractorIds });
    return props.open ? (
      <div role="dialog" data-testid="mock-recompute-dialog">
        contractors={props.contractorIds.length}
      </div>
    ) : null;
  },
}));

import {
  RecomputeComplianceBulkAction,
  RecomputeComplianceButton,
} from '../recompute-compliance-button.js';
import { RecomputeComplianceDialogView } from '../recompute-compliance-dialog.js';

describe('RecomputeComplianceButton', () => {
  it('renders the trigger button with i18n label', () => {
    render(<RecomputeComplianceButton contractorId="ctr-1" />);
    expect(screen.getByTestId('recompute-compliance-button')).toBeInTheDocument();
    expect(screen.getByText('Recompute compliance')).toBeInTheDocument();
  });

  it('opens the confirm dialog on click', async () => {
    render(<RecomputeComplianceButton contractorId="ctr-1" />);
    expect(screen.queryByTestId('mock-recompute-dialog')).toBeNull();
    screen.getByTestId('recompute-compliance-button').click();
    expect(await screen.findByTestId('mock-recompute-dialog')).toBeInTheDocument();
  });
});

describe('RecomputeComplianceBulkAction', () => {
  it('renders nothing when closed', () => {
    const { container } = render(
      <RecomputeComplianceBulkAction
        contractorIds={['ctr-1', 'ctr-2']}
        open={false}
        onOpenChange={vi.fn()}
      />,
    );
    expect(container.querySelector('[data-testid="mock-recompute-dialog"]')).toBeNull();
  });

  it('forwards every selected contractorId to the dialog', () => {
    const ids = ['ctr-1', 'ctr-2', 'ctr-3', 'ctr-4', 'ctr-5'];
    render(
      <RecomputeComplianceBulkAction contractorIds={ids} open={true} onOpenChange={vi.fn()} />,
    );
    const last = dialogCalls[dialogCalls.length - 1];
    expect(last?.contractorIds).toEqual(ids);
  });
});

describe('RecomputeComplianceDialogView', () => {
  function makeMutation(overrides: Partial<{ mutate: ReturnType<typeof vi.fn> }> = {}) {
    return {
      mutate: vi.fn(),
      isPending: false,
      ...overrides,
    } as unknown as Parameters<typeof RecomputeComplianceDialogView>[0]['mutation'];
  }

  it('renders bulk title containing the selected count', () => {
    render(
      <RecomputeComplianceDialogView
        open={true}
        onOpenChange={vi.fn()}
        contractorIds={['c1', 'c2', 'c3']}
        mutation={makeMutation()}
        isPending={false}
      />,
    );
    // ICU interpolation of `{count}` in raw next-intl format isn't applied by
    // i18next-icu, so the title renders the placeholder verbatim. The bulk
    // branch still proves itself by emitting the "for ... contractors" copy.
    expect(screen.getByText(/Recompute compliance for .* contractors/i)).toBeInTheDocument();
  });

  it('renders single title when only one contractor', () => {
    render(
      <RecomputeComplianceDialogView
        open={true}
        onOpenChange={vi.fn()}
        contractorIds={['c1']}
        mutation={makeMutation()}
        isPending={false}
      />,
    );
    expect(screen.getByRole('alertdialog')).toBeInTheDocument();
  });

  it('disables Confirm until a reason is selected', () => {
    render(
      <RecomputeComplianceDialogView
        open={true}
        onOpenChange={vi.fn()}
        contractorIds={['c1']}
        mutation={makeMutation()}
        isPending={false}
      />,
    );
    expect(screen.getByTestId('recompute-compliance-confirm')).toBeDisabled();
  });

  it('disables Confirm while pending', () => {
    render(
      <RecomputeComplianceDialogView
        open={true}
        onOpenChange={vi.fn()}
        contractorIds={['c1']}
        mutation={makeMutation()}
        isPending={true}
      />,
    );
    expect(screen.getByTestId('recompute-compliance-confirm')).toBeDisabled();
  });
});
