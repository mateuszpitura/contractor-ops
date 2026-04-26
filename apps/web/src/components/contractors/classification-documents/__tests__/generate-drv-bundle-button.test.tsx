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
    classificationDocument: {
      generateDrvDefenseBundle: {
        mutationOptions: (opts: Record<string, unknown>) => opts,
      },
    },
  },
}));

import { render, screen, setup } from '@/test/test-utils';

import { GenerateDrvBundleButton } from '../generate-drv-bundle-button';

describe('GenerateDrvBundleButton', () => {
  beforeEach(() => {
    mockMutate.mockClear();
    mockMutationState.current = { isPending: false };
  });

  it('renders the generate button', () => {
    render(<GenerateDrvBundleButton classificationAssessmentId="a-1" />);

    expect(screen.getByRole('button')).toBeInTheDocument();
  });

  it('calls mutate with assessment id when clicked', async () => {
    const { user } = setup(<GenerateDrvBundleButton classificationAssessmentId="a-1" />);

    await user.click(screen.getByRole('button'));

    expect(mockMutate).toHaveBeenCalledWith({ classificationAssessmentId: 'a-1' });
  });

  it('disables button when mutation is pending', () => {
    mockMutationState.current = { isPending: true };

    render(<GenerateDrvBundleButton classificationAssessmentId="a-1" />);

    expect(screen.getByRole('button')).toBeDisabled();
  });

  it('disables button when disabled prop is true', () => {
    render(<GenerateDrvBundleButton classificationAssessmentId="a-1" disabled />);

    expect(screen.getByRole('button')).toBeDisabled();
  });

  it('renders disabled reason text when disabled with reason', () => {
    render(
      <GenerateDrvBundleButton
        classificationAssessmentId="a-1"
        disabled
        disabledReason="Assessment not completed"
      />,
    );

    expect(screen.getByText('Assessment not completed')).toBeInTheDocument();
  });

  it('does not render disabled reason when not disabled', () => {
    render(
      <GenerateDrvBundleButton classificationAssessmentId="a-1" disabledReason="Should not show" />,
    );

    expect(screen.queryByText('Should not show')).not.toBeInTheDocument();
  });

  it('sets aria-busy when mutation is pending', () => {
    mockMutationState.current = { isPending: true };

    render(<GenerateDrvBundleButton classificationAssessmentId="a-1" />);

    expect(screen.getByRole('button')).toHaveAttribute('aria-busy', 'true');
  });

  it('sets aria-describedby when disabled with reason', () => {
    render(
      <GenerateDrvBundleButton
        classificationAssessmentId="a-1"
        disabled
        disabledReason="Not ready"
      />,
    );

    const button = screen.getByRole('button');
    expect(button).toHaveAttribute('aria-describedby');
  });
});
