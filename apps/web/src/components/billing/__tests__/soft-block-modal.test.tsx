import { render, screen } from '@/test/test-utils';
import { SoftBlockModal } from '../soft-block-modal';

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

// Mock PlanComparisonGrid to simplify
vi.mock('../plan-comparison-grid', () => ({
  PlanComparisonGrid: ({ onSelectPlan }: { onSelectPlan: (plan: string) => void }) => (
    <div data-testid="plan-grid">
      // biome-ignore lint/nursery/noJsxPropsBind: menu item handler
      <button type="button" onClick={() => onSelectPlan('price_pro')}>
        Select Pro
      </button>
    </div>
  ),
}));

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('SoftBlockModal', () => {
  it('does not render content when closed', () => {
    render(<SoftBlockModal isOpen={false} onSelectPlan={vi.fn()} />);
    expect(screen.queryByText('Your trial has ended')).not.toBeInTheDocument();
  });

  it('renders title and description when open', () => {
    render(<SoftBlockModal isOpen={true} onSelectPlan={vi.fn()} />);
    expect(screen.getByText('Your trial has ended')).toBeInTheDocument();
    expect(
      screen.getByText('Your data is safe. Choose a plan to continue using Contractor Ops.'),
    ).toBeInTheDocument();
  });

  it('renders the plan comparison grid', () => {
    render(<SoftBlockModal isOpen={true} onSelectPlan={vi.fn()} />);
    expect(screen.getByTestId('plan-grid')).toBeInTheDocument();
  });

  it('has alertdialog role', () => {
    render(<SoftBlockModal isOpen={true} onSelectPlan={vi.fn()} />);
    expect(screen.getByRole('alertdialog')).toBeInTheDocument();
  });
});
