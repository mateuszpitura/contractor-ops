/**
 * web-vite port. Mocks the two tRPC-bound dialog containers so the header
 * unit-tests don't pull in the contract wizard / template picker graphs.
 */

import { describe, expect, it, vi } from 'vitest';

vi.mock('../../../contracts/contract-wizard/wizard-dialog.js', () => ({
  ContractWizardDialog: () => null,
}));

vi.mock('../../../workflows/template-picker-dialog.js', () => ({
  TemplatePickerDialog: () => null,
}));

import { render, screen } from '../../../../test/test-utils.js';
import type { ProfileHeaderContractor } from '../profile-header.js';
import { ProfileHeaderView } from '../profile-header.js';

const makeContractor = (stage: string): ProfileHeaderContractor => ({
  id: 'c1',
  displayName: 'ACME Corp',
  legalName: 'ACME Sp. z o.o.',
  type: 'COMPANY',
  lifecycleStage: stage,
  owner: { id: 'u1', name: 'Jan Kowalski', image: null },
});

function renderHeader(stage = 'ACTIVE', overrides: Partial<ProfileHeaderContractor> = {}) {
  return render(
    <ProfileHeaderView
      contractor={{ ...makeContractor(stage), ...overrides }}
      transitionLifecycle={vi.fn()}
      archive={vi.fn()}
      isPending={false}
    />,
  );
}

describe('ProfileHeaderView', () => {
  it('renders contractor display name', () => {
    renderHeader();
    expect(screen.getByText('ACME Corp')).toBeInTheDocument();
  });

  it('renders owner info', () => {
    renderHeader();
    expect(screen.getByText('Jan Kowalski')).toBeInTheDocument();
  });

  it('renders edit + add-contract buttons on ACTIVE', () => {
    renderHeader('ACTIVE');
    expect(screen.getByText('Edit contractor')).toBeInTheDocument();
    expect(screen.getByText('Add contract')).toBeInTheDocument();
  });

  it('shows the Start onboarding workflow CTA on ONBOARDING', () => {
    renderHeader('ONBOARDING');
    expect(screen.getByText('Start onboarding')).toBeInTheDocument();
  });

  it('shows the Start workflow CTA on OFFBOARDING', () => {
    renderHeader('OFFBOARDING');
    expect(screen.getByText('Start workflow')).toBeInTheDocument();
  });

  it('renders contractor type badge text (company)', () => {
    renderHeader();
    expect(screen.getByText(/company/i)).toBeInTheDocument();
  });

  it('renders without owner when owner is null', () => {
    renderHeader('ACTIVE', { owner: null });
    expect(screen.getByText('ACME Corp')).toBeInTheDocument();
    expect(screen.queryByText('Jan Kowalski')).not.toBeInTheDocument();
  });

  it('renders avatar fallback initials when owner has no image', () => {
    renderHeader();
    expect(screen.getByText('JK')).toBeInTheDocument();
  });

  it('does not show onboarding/offboarding workflow CTAs on ENDED', () => {
    renderHeader('ENDED');
    expect(screen.queryByText('Start onboarding')).not.toBeInTheDocument();
    expect(screen.queryByText('Start offboarding')).not.toBeInTheDocument();
  });
});
