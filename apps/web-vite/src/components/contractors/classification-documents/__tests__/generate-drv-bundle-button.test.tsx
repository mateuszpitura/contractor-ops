/**
 * web-vite port. View takes mutation + generate + isPending as props.
 */

import { describe, expect, it, vi } from 'vitest';

import { render, screen, setup } from '../../../../test/test-utils.js';
import { GenerateDrvBundleButtonView } from '../generate-drv-bundle-button.js';

function makeMutation(overrides: Partial<{ error: Error | null }> = {}) {
  return {
    mutate: vi.fn(),
    error: null,
    ...overrides,
  } as unknown as Parameters<typeof GenerateDrvBundleButtonView>[0]['mutation'];
}

describe('GenerateDrvBundleButtonView', () => {
  it('renders the generate button', () => {
    render(
      <GenerateDrvBundleButtonView
        classificationAssessmentId="a-1"
        mutation={makeMutation()}
        generate={vi.fn()}
        isPending={false}
      />,
    );
    expect(screen.getByRole('button')).toBeInTheDocument();
  });

  it('invokes generate when clicked', async () => {
    const generate = vi.fn();
    const { user } = setup(
      <GenerateDrvBundleButtonView
        classificationAssessmentId="a-1"
        mutation={makeMutation()}
        generate={generate}
        isPending={false}
      />,
    );
    await user.click(screen.getByRole('button'));
    expect(generate).toHaveBeenCalled();
  });

  it('disables the button while isPending=true', () => {
    render(
      <GenerateDrvBundleButtonView
        classificationAssessmentId="a-1"
        mutation={makeMutation()}
        generate={vi.fn()}
        isPending={true}
      />,
    );
    expect(screen.getByRole('button')).toBeDisabled();
  });

  it('disables the button when the disabled prop is true', () => {
    render(
      <GenerateDrvBundleButtonView
        classificationAssessmentId="a-1"
        disabled
        mutation={makeMutation()}
        generate={vi.fn()}
        isPending={false}
      />,
    );
    expect(screen.getByRole('button')).toBeDisabled();
  });

  it('renders disabled reason text when both disabled and disabledReason are set', () => {
    render(
      <GenerateDrvBundleButtonView
        classificationAssessmentId="a-1"
        disabled
        disabledReason="Assessment not completed"
        mutation={makeMutation()}
        generate={vi.fn()}
        isPending={false}
      />,
    );
    expect(screen.getByText('Assessment not completed')).toBeInTheDocument();
  });

  it('does not render disabled reason when not disabled', () => {
    render(
      <GenerateDrvBundleButtonView
        classificationAssessmentId="a-1"
        disabledReason="Should not show"
        mutation={makeMutation()}
        generate={vi.fn()}
        isPending={false}
      />,
    );
    expect(screen.queryByText('Should not show')).not.toBeInTheDocument();
  });

  it('sets aria-busy="true" while isPending', () => {
    render(
      <GenerateDrvBundleButtonView
        classificationAssessmentId="a-1"
        mutation={makeMutation()}
        generate={vi.fn()}
        isPending={true}
      />,
    );
    expect(screen.getByRole('button')).toHaveAttribute('aria-busy', 'true');
  });

  it('sets aria-describedby when disabled with reason', () => {
    render(
      <GenerateDrvBundleButtonView
        classificationAssessmentId="a-1"
        disabled
        disabledReason="Not ready"
        mutation={makeMutation()}
        generate={vi.fn()}
        isPending={false}
      />,
    );
    const button = screen.getByRole('button');
    expect(button).toHaveAttribute('aria-describedby');
  });
});
