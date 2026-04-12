import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, setup } from '@/test/test-utils';
import { NewPaymentRunDialog } from '../index';

vi.mock('@tanstack/react-query', async () => {
  const actual =
    await vi.importActual<typeof import('@tanstack/react-query')>('@tanstack/react-query');
  return {
    ...actual,
    useQueryClient: () => ({
      invalidateQueries: vi.fn(),
    }),
  };
});

vi.mock('../step-select', () => ({
  StepSelect: ({ onNext }: { onNext: () => void }) => (
    <button type="button" onClick={onNext}>
      mock-go-review
    </button>
  ),
}));

vi.mock('../step-review', () => ({
  StepReview: () => <div>step-review-mock</div>,
}));

vi.mock('../step-confirmation', () => ({
  StepConfirmation: () => <div>step-confirmation-mock</div>,
}));

describe('NewPaymentRunDialog', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('shows title and step 1 content when open', () => {
    render(<NewPaymentRunDialog open onOpenChange={() => undefined} />);
    expect(screen.getByText('New payment run')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /mock-go-review/i })).toBeInTheDocument();
  });

  it('advances to review step when step 1 completes', async () => {
    const { user } = setup(<NewPaymentRunDialog open onOpenChange={() => undefined} />);
    await user.click(screen.getByRole('button', { name: /mock-go-review/i }));
    expect(screen.getByText('step-review-mock')).toBeInTheDocument();
  });
});
