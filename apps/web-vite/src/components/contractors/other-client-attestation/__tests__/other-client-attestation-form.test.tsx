/**
 * Container/component split — `OtherClientAttestationFormView` takes the
 * `useOtherClientAttestation` hook return as props. Tests inject a shaped
 * stub instead of mocking tRPC.
 */

import { describe, expect, it, vi } from 'vitest';

import { render, screen, setup } from '../../../../test/test-utils.js';
import { OtherClientAttestationFormView } from '../other-client-attestation-form.js';

type ViewProps = Parameters<typeof OtherClientAttestationFormView>[0];

interface OverrideHook {
  existing?: ViewProps['existing'];
  mutation?: Partial<ViewProps['mutation']>;
  isPending?: boolean;
}

function buildProps(override: OverrideHook = {}): ViewProps {
  const { existing = null, mutation: mutationOverride = {}, isPending = false } = override;
  const mutation = {
    mutate: vi.fn(),
    isPending,
    ...mutationOverride,
  } as unknown as ViewProps['mutation'];
  return {
    engagementId: 'cass_1',
    existing: (existing ?? null) as ViewProps['existing'],
    existingQuery: { data: existing ?? null } as unknown as ViewProps['existingQuery'],
    submit: vi.fn(),
    mutation,
    isPending,
  };
}

describe('OtherClientAttestationFormView', () => {
  it('renders a labelled section with the attestation heading', () => {
    render(<OtherClientAttestationFormView {...buildProps()} />);
    const heading = screen.getByRole('heading', { name: 'Other clients attestation' });
    expect(heading.id).toBeTruthy();
    const section = heading.closest('section');
    expect(section?.getAttribute('aria-labelledby')).toBe(heading.id);
  });

  it('renders statement + signed-name labels', () => {
    render(<OtherClientAttestationFormView {...buildProps()} />);
    expect(screen.getByText('Statement')).toBeInTheDocument();
    expect(screen.getByText('Signed name')).toBeInTheDocument();
  });

  it('shows the Submit attestation CTA when no existing attestation exists', () => {
    render(<OtherClientAttestationFormView {...buildProps()} />);
    expect(screen.getByRole('button', { name: 'Submit attestation' })).toBeInTheDocument();
  });

  it('shows Update attestation CTA when existing attestation is loaded', () => {
    render(
      <OtherClientAttestationFormView
        {...buildProps({
          existing: {
            statementText: 'I work with other clients.',
            signedName: 'Jane Doe',
          } as unknown as ViewProps['existing'],
        })}
      />,
    );
    expect(screen.getByRole('button', { name: 'Update attestation' })).toBeInTheDocument();
  });

  it('renders Saving copy and disables the button when mutation is pending', () => {
    render(<OtherClientAttestationFormView {...buildProps({ isPending: true })} />);
    const btn = screen.getByRole('button', { name: /Saving/i });
    expect(btn).toBeDisabled();
  });

  it('hydrates inputs from `existing` on mount', () => {
    render(
      <OtherClientAttestationFormView
        {...buildProps({
          existing: {
            statementText: 'Hydrated statement',
            signedName: 'Hydrated Signer',
          } as unknown as ViewProps['existing'],
        })}
      />,
    );
    const textarea = document.querySelector('textarea');
    const input = document.querySelector('input[type="text"]');
    expect(textarea?.value).toBe('Hydrated statement');
    expect((input as HTMLInputElement | null)?.value).toBe('Hydrated Signer');
  });

  it('calls mutation.mutate with engagementId + form values on submit', async () => {
    const mutate = vi.fn();
    const props = buildProps({ mutation: { mutate } as unknown as ViewProps['mutation'] });
    const { user } = setup(<OtherClientAttestationFormView {...props} />);
    const textarea = document.querySelector('textarea') as HTMLTextAreaElement;
    const signedInput = document.querySelector('input[type="text"]') as HTMLInputElement;

    await user.type(textarea, 'Working with X and Y.');
    await user.type(signedInput, 'Ada Lovelace');
    await user.click(screen.getByRole('button', { name: 'Submit attestation' }));

    expect(mutate).toHaveBeenCalledTimes(1);
    expect(mutate).toHaveBeenCalledWith(
      {
        contractorAssignmentId: 'cass_1',
        statementText: 'Working with X and Y.',
        signedName: 'Ada Lovelace',
      },
      expect.objectContaining({ onError: expect.any(Function) }),
    );
  });
});
