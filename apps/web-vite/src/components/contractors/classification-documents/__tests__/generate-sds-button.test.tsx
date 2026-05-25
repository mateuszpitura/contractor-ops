/**
 * web-vite port. View takes approveSdsMutation/generateMutation/generateSds as
 * props (split from `useGenerateSds`). Tests the approval gate and the
 * generate button branches.
 */

import { describe, expect, it, vi } from 'vitest';

import { render, screen, setup } from '../../../../test/test-utils.js';
import { GenerateSdsButtonView } from '../generate-sds-button.js';

function makeApproveMutation(
  overrides: Partial<{
    isPending: boolean;
    error: Error | null;
    mutate: ReturnType<typeof vi.fn>;
  }> = {},
) {
  return {
    mutate: vi.fn(),
    isPending: false,
    error: null,
    ...overrides,
  } as unknown as Parameters<typeof GenerateSdsButtonView>[0]['approveSdsMutation'];
}

function makeGenerateMutation(
  overrides: Partial<{ isPending: boolean; error: Error | null }> = {},
) {
  return {
    isPending: false,
    error: null,
    ...overrides,
  } as unknown as Parameters<typeof GenerateSdsButtonView>[0]['generateMutation'];
}

describe('GenerateSdsButtonView', () => {
  it('renders the approval gate when not yet approved', () => {
    render(
      <GenerateSdsButtonView
        classificationAssessmentId="a-1"
        approveSdsMutation={makeApproveMutation()}
        generateMutation={makeGenerateMutation()}
        approveSds={vi.fn()}
        generateSds={vi.fn()}
      />,
    );
    expect(screen.getByRole('checkbox')).toBeInTheDocument();
    // Generate button is not visible until approval.
    expect(screen.queryByRole('button', { name: /generate/i })).not.toBeInTheDocument();
  });

  it('renders the generate button when alreadyApproved=true', () => {
    render(
      <GenerateSdsButtonView
        classificationAssessmentId="a-1"
        alreadyApproved={true}
        approveSdsMutation={makeApproveMutation()}
        generateMutation={makeGenerateMutation()}
        approveSds={vi.fn()}
        generateSds={vi.fn()}
      />,
    );
    const buttons = screen.getAllByRole('button');
    expect(buttons.length).toBeGreaterThan(0);
  });

  it('invokes generateSds when generate button is clicked', async () => {
    const generateSds = vi.fn();
    const { user } = setup(
      <GenerateSdsButtonView
        classificationAssessmentId="a-1"
        alreadyApproved={true}
        approveSdsMutation={makeApproveMutation()}
        generateMutation={makeGenerateMutation()}
        approveSds={vi.fn()}
        generateSds={generateSds}
      />,
    );
    const btn = screen.getByRole('button');
    await user.click(btn);
    expect(generateSds).toHaveBeenCalled();
  });

  it('disables the generate button while generation is pending', () => {
    render(
      <GenerateSdsButtonView
        classificationAssessmentId="a-1"
        alreadyApproved={true}
        approveSdsMutation={makeApproveMutation()}
        generateMutation={makeGenerateMutation({ isPending: true })}
        approveSds={vi.fn()}
        generateSds={vi.fn()}
      />,
    );
    const btn = screen.getByRole('button');
    expect(btn).toBeDisabled();
    expect(btn).toHaveAttribute('aria-busy', 'true');
  });
});
