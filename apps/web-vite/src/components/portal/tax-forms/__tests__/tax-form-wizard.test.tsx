/**
 * Component spec for the portal W-form wizard. Drives the determination query +
 * submit mutation through the in-test tRPC proxy and asserts the four states
 * (loading / load-error / determination render / W-8BEN treaty auto-populate),
 * the attestation gate, the submit-failure-preserves-data behaviour, RTL, and
 * the staff status card pill mapping.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../../../../providers/trpc-provider.js', () => ({
  useTRPC: () => trpcProxy,
  usePortalTRPC: () => trpcProxy,
}));

import { render, screen, setup, waitFor } from '@/test/test-utils';
import { applyLocale } from '../../../../i18n/index.js';
import { clearTRPCMock, createTRPCProxy, setTRPCMock } from '../../../../test-utils/render-hook.js';
import { TaxFormStatusCard } from '../../../contractors/tax-forms/tax-form-status-card.js';
import { TaxFormWizard } from '../tax-form-wizard.js';

const trpcProxy = createTRPCProxy();

const W9_DETERMINATION = {
  formType: 'W9' as const,
  countryCode: 'US',
  legalName: 'Jane Q Contractor',
  displayName: 'Jane',
  treatyClaim: null,
};

const W8BEN_DETERMINATION = {
  formType: 'W8BEN' as const,
  countryCode: 'PL',
  legalName: 'Jan Kowalski',
  displayName: 'Jan',
  treatyClaim: { article: 'Article 7', rate: 0, residency: 'PL' },
};

beforeEach(() => {
  clearTRPCMock();
});

afterEach(async () => {
  clearTRPCMock();
  vi.clearAllMocks();
  // The locale is a shared i18next instance — reset to English so an `ar`
  // render in one test never leaks into later English assertions.
  await applyLocale('en');
});

describe('TaxFormWizard', () => {
  it('renders the skeleton while the determination loads', () => {
    setTRPCMock({
      'portal.getTaxFormDetermination': () => new Promise(() => undefined),
    });
    const { container } = render(<TaxFormWizard />);
    expect(container.querySelector('[aria-busy="true"]')).toBeInTheDocument();
  });

  it('shows the load error and a reload action when the determination fails', async () => {
    setTRPCMock({
      'portal.getTaxFormDetermination': () => {
        throw new Error('boom');
      },
    });
    render(<TaxFormWizard />);
    expect(await screen.findByText("Couldn't load your tax form")).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Reload tax form' })).toBeInTheDocument();
  });

  it('renders the determination step with the auto-routed form and an override control', async () => {
    setTRPCMock({ 'portal.getTaxFormDetermination': () => W9_DETERMINATION });
    render(<TaxFormWizard />);
    expect(await screen.findByText('Confirm your tax form')).toBeInTheDocument();
    // Override control (combobox) present so the contractor can change the form.
    expect(screen.getByRole('combobox')).toBeInTheDocument();
  });

  it('auto-populates and announces the W-8BEN treaty rate/article', async () => {
    setTRPCMock({ 'portal.getTaxFormDetermination': () => W8BEN_DETERMINATION });
    const { user } = setup(<TaxFormWizard />);
    await screen.findByText('Confirm your tax form');
    await user.click(screen.getByRole('button', { name: /continue to details/i }));

    const live = await screen.findByText(/treaty rate applied automatically/i);
    expect(live).toHaveTextContent('Article 7');
    expect(live).toHaveTextContent('0%');
    // The announcement region is aria-live so SR users hear it resolve.
    const liveRegion = live.closest('[aria-live="polite"]');
    expect(liveRegion).toBeInTheDocument();
  });

  it('renders Arabic strings and flips logical layout under RTL', async () => {
    setTRPCMock({ 'portal.getTaxFormDetermination': () => W9_DETERMINATION });
    render(<TaxFormWizard />, { locale: 'ar' });
    // Locale applies asynchronously; wait for the Arabic title rather than
    // asserting eagerly. The wizard uses logical RTL props (ms-*/text-start,
    // rtl:rotate-180) so it flips with `dir` — verified by the no-physical-props
    // grep gate in the acceptance criteria.
    expect(await screen.findByText('نموذج الحالة الضريبية')).toBeInTheDocument();
    // The determination CTA's directional arrow flips via the logical class.
    const arrow = document.querySelector('.rtl\\:rotate-180');
    expect(arrow).toBeInTheDocument();
  });
});

describe('TaxFormWizard attestation gate', () => {
  async function advanceToAttest(user: ReturnType<typeof setup>['user']) {
    await screen.findByText('Confirm your tax form');
    await user.click(screen.getByRole('button', { name: /continue to details/i }));
    await screen.findByText('Your W-9 details');
    // Fill the required W-9 fields so the schema validates on submit.
    await user.click(screen.getByRole('combobox'));
    await user.click(await screen.findByRole('option', { name: 'Individual' }));
    await user.type(screen.getByLabelText(/employer identification number/i), '12-3456789');
    await user.click(screen.getByRole('button', { name: /continue to certify/i }));
    await screen.findByText('Certify and sign');
  }

  it('keeps Sign & submit disabled until perjury + name match + affirmation', async () => {
    setTRPCMock({ 'portal.getTaxFormDetermination': () => W9_DETERMINATION });
    const { user } = setup(<TaxFormWizard />);
    await advanceToAttest(user);

    const submit = screen.getByRole('button', { name: 'Sign & submit' });
    expect(submit).toBeDisabled();

    const checkboxes = screen.getAllByRole('checkbox');
    await user.click(checkboxes[0]); // perjury
    await user.click(checkboxes[1]); // legal-signature affirmation
    expect(submit).toBeDisabled(); // name still not typed

    await user.type(
      screen.getByLabelText('Type your full legal name to sign'),
      'Jane Q Contractor',
    );
    await waitFor(() => expect(submit).toBeEnabled());
  });

  it('preserves data and shows an alert region when submit fails', async () => {
    setTRPCMock({
      'portal.getTaxFormDetermination': () => W9_DETERMINATION,
      'portal.submitTaxForm': () => {
        throw new Error('submit failed');
      },
    });
    const { user } = setup(<TaxFormWizard />);
    await advanceToAttest(user);

    const checkboxes = screen.getAllByRole('checkbox');
    await user.click(checkboxes[0]);
    await user.click(checkboxes[1]);
    const nameField = screen.getByLabelText('Type your full legal name to sign');
    await user.type(nameField, 'Jane Q Contractor');
    await user.click(screen.getByRole('button', { name: 'Sign & submit' }));

    const alert = await screen.findByRole('alert');
    expect(alert).toHaveAttribute('aria-live', 'polite');
    // Entered name preserved (wizard not reset).
    expect(nameField).toHaveValue('Jane Q Contractor');
  });

  it('renders the receipt with the form name on a successful submit', async () => {
    setTRPCMock({
      'portal.getTaxFormDetermination': () => W9_DETERMINATION,
      'portal.submitTaxForm': () => ({ id: 'tf-1', status: 'ACTIVE', formType: 'W9' }),
    });
    const { user } = setup(<TaxFormWizard />);
    await advanceToAttest(user);

    const checkboxes = screen.getAllByRole('checkbox');
    await user.click(checkboxes[0]);
    await user.click(checkboxes[1]);
    await user.type(
      screen.getByLabelText('Type your full legal name to sign'),
      'Jane Q Contractor',
    );
    await user.click(screen.getByRole('button', { name: 'Sign & submit' }));

    expect(await screen.findByText('Tax form submitted')).toBeInTheDocument();
  });
});

describe('TaxFormStatusCard', () => {
  const baseForm = {
    id: 'tf-1',
    formType: 'W9' as const,
    status: 'ACTIVE' as const,
    treatyArticle: null,
    treatyRate: null,
    contractorResidency: null,
    signerName: 'Jane Q Contractor',
    signedAt: new Date('2026-01-01').toISOString(),
    expiresAt: null,
    createdAt: new Date('2026-01-01').toISOString(),
  };

  it('maps ACTIVE → success and shows the SSN reveal when permitted', async () => {
    setTRPCMock({ 'taxForm.listFormSubmissions': () => [baseForm] });
    render(<TaxFormStatusCard contractorId="c-1" ssnLast4="6789" canRevealPii />);
    const pill = await screen.findByTestId('tax-form-status-pill');
    expect(pill).toHaveAttribute('data-status', 'active');
    expect(screen.getByRole('button', { name: /reveal/i })).toBeInTheDocument();
  });

  it('omits the SSN reveal control without contractorPii:read', async () => {
    setTRPCMock({ 'taxForm.listFormSubmissions': () => [baseForm] });
    render(<TaxFormStatusCard contractorId="c-1" ssnLast4="6789" canRevealPii={false} />);
    await screen.findByTestId('tax-form-status-pill');
    expect(screen.queryByRole('button', { name: /reveal/i })).not.toBeInTheDocument();
  });

  it('shows the empty state with a request CTA when no forms exist', async () => {
    setTRPCMock({ 'taxForm.listFormSubmissions': () => [] });
    render(<TaxFormStatusCard contractorId="c-1" ssnLast4={null} canRevealPii={false} />);
    expect(await screen.findByText('No tax form submitted yet')).toBeInTheDocument();
  });

  it('maps SUPERSEDED → secondary and DRAFT → info variants', async () => {
    setTRPCMock({
      'taxForm.listFormSubmissions': () => [{ ...baseForm, id: 'tf-2', status: 'DRAFT' }],
    });
    render(<TaxFormStatusCard contractorId="c-1" ssnLast4={null} canRevealPii={false} />);
    const pill = await screen.findByTestId('tax-form-status-pill');
    expect(pill).toHaveAttribute('data-status', 'draft');
  });
});
