import { beforeEach, describe, expect, it, vi } from 'vitest';

const mockMutate = vi.fn();
const mockMutationState: { current: { isPending: boolean } } = {
  current: { isPending: false },
};

vi.mock('@tanstack/react-query', async () => {
  const actual = await vi.importActual<Record<string, unknown>>('@tanstack/react-query');
  return {
    ...actual,
    useMutation: () => ({
      mutate: mockMutate,
      isPending: mockMutationState.current.isPending,
    }),
    useQueryClient: () => ({
      invalidateQueries: vi.fn(),
    }),
  };
});

vi.mock('@/trpc/init', () => ({
  trpc: {
    classification: {
      approveSds: {
        mutationOptions: (opts: Record<string, unknown>) => opts,
      },
    },
    classificationDocument: {
      generateSds: {
        mutationOptions: (opts: Record<string, unknown>) => opts,
      },
    },
  },
}));

import { render, screen, setup } from '@/test/test-utils';

import { GenerateSdsButton } from '../generate-sds-button';

describe('GenerateSdsButton', () => {
  beforeEach(() => {
    mockMutate.mockClear();
    mockMutationState.current = { isPending: false };
  });

  it('renders the generate button', () => {
    render(<GenerateSdsButton classificationAssessmentId="a-1" />);

    expect(screen.getByRole('button')).toBeInTheDocument();
  });

  it('calls mutate with assessment id when clicked', async () => {
    const { user } = setup(
      <GenerateSdsButton classificationAssessmentId="a-1" alreadyApproved={true} />,
    );

    await user.click(screen.getByRole('button'));

    expect(mockMutate).toHaveBeenCalledWith({ classificationAssessmentId: 'a-1' });
  });

  it('disables button when mutation is pending', () => {
    mockMutationState.current = { isPending: true };

    render(<GenerateSdsButton classificationAssessmentId="a-1" alreadyApproved={true} />);

    expect(screen.getByRole('button')).toBeDisabled();
  });

  it('sets aria-busy when mutation is pending', () => {
    mockMutationState.current = { isPending: true };

    render(<GenerateSdsButton classificationAssessmentId="a-1" alreadyApproved={true} />);

    expect(screen.getByRole('button')).toHaveAttribute('aria-busy', 'true');
  });
});
