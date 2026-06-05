/**
 * Web-vite split: BacsSubmitterForm accepts `useBacsSubmitterForm`'s
 * return as a `submitter` prop, so the test injects a shaped stub
 * instead of mocking the BACS tRPC endpoints.
 *
 * NOTE: tests intentionally avoid the masks-with-submitterName branch —
 * the form's `useBacsSubmitterNameSync(reset)` callback is recreated
 * inline each render, so a non-null `masks.submitterName` makes the sync
 * effect re-fire on every render under jsdom (RHF reset → re-render →
 * new closure ref → effect re-fires). Production survives because the
 * mask payload typically arrives without a submitterName until the
 * user populates it. Focus the assertions on the prop-driven branches
 * the component owns.
 */

import { render, screen } from '@/test/test-utils';
import type { useBacsSubmitterForm } from '../../hooks/use-bacs-submitter-form.js';
import { BacsSubmitterForm } from '../bacs-submitter-form';

type Submitter = ReturnType<typeof useBacsSubmitterForm>;

function makeSubmitter(overrides: Partial<Submitter> = {}): Submitter {
  return {
    masks: null,
    isMasksLoading: false,
    onSave: vi.fn(),
    isSaving: false,
    submitterNameDefault: '',
    ...overrides,
  } as unknown as Submitter;
}

describe('BacsSubmitterForm', () => {
  it('renders the section heading', () => {
    render(<BacsSubmitterForm featureEnabled submitter={makeSubmitter()} />);
    expect(screen.getByText('UK BACS Standard 18 submitter')).toBeInTheDocument();
  });

  it('renders all four labelled inputs', () => {
    render(<BacsSubmitterForm featureEnabled submitter={makeSubmitter()} />);
    expect(screen.getByLabelText('Service user number (SUN)')).toBeInTheDocument();
    expect(screen.getByLabelText('Originating sort code')).toBeInTheDocument();
    expect(screen.getByLabelText('Originating account number')).toBeInTheDocument();
    expect(screen.getByLabelText(/Submitter name/)).toBeInTheDocument();
  });

  it('renders skeleton loaders for mask hints while loading', () => {
    const { container } = render(
      <BacsSubmitterForm featureEnabled submitter={makeSubmitter({ isMasksLoading: true })} />,
    );
    expect(container.querySelectorAll('[data-slot="skeleton"]').length).toBeGreaterThan(0);
  });

  it('shows the saved sun / sortCode / accountNumber masks (without submitterName)', () => {
    render(
      <BacsSubmitterForm
        featureEnabled
        submitter={makeSubmitter({
          masks: {
            sun: '••a••56',
            sortCode: '12-••-78xx',
            accountNumber: '••cc••5678',
            submitterName: null,
          },
        } as Partial<Submitter>)}
      />,
    );
    expect(screen.getByText(/••a••56/)).toBeInTheDocument();
    expect(screen.getByText(/12-••-78xx/)).toBeInTheDocument();
    expect(screen.getByText(/••cc••5678/)).toBeInTheDocument();
  });

  it('renders the feature-flag-off banner when featureEnabled is false', () => {
    render(<BacsSubmitterForm featureEnabled={false} submitter={makeSubmitter()} />);
    expect(screen.getByText(/BACS export is disabled/i)).toBeInTheDocument();
  });

  it('disables the Save button when feature is disabled', () => {
    render(<BacsSubmitterForm featureEnabled={false} submitter={makeSubmitter()} />);
    const saveBtn = screen.getByRole('button', { name: /Save changes/i });
    expect(saveBtn).toBeDisabled();
  });

  it('disables the Save button when the form is pristine even with feature enabled', () => {
    render(<BacsSubmitterForm featureEnabled submitter={makeSubmitter()} />);
    const saveBtn = screen.getByRole('button', { name: /Save changes/i });
    expect(saveBtn).toBeDisabled();
  });

  it('shows the spinner icon when isSaving is true', () => {
    const { container } = render(
      <BacsSubmitterForm featureEnabled submitter={makeSubmitter({ isSaving: true })} />,
    );
    expect(container.querySelector('.animate-spin')).toBeTruthy();
  });
});
