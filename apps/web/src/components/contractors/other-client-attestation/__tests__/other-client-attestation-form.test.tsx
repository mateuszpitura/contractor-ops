// Phase 59 Plan 59-03 Task 4 — OtherClientAttestationForm structural smoke tests.

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen } from '@testing-library/react';
import { NextIntlClientProvider } from 'next-intl';
import { describe, expect, it, vi } from 'vitest';

vi.mock('@/trpc/init', () => ({
  trpc: {
    ir35Attestation: {
      getForEngagement: {
        queryOptions: () => ({
          queryKey: ['mock', 'ir35Attestation', 'getForEngagement'],
          queryFn: async () => null,
        }),
      },
      upsert: { mutationOptions: () => ({ mutationFn: async () => ({}) }) },
    },
  },
}));

import { OtherClientAttestationForm } from '../other-client-attestation-form';

const messages = {
  OtherClientAttestation: {
    title: 'Other clients attestation',
    subtitle: 'Confirm your other clients.',
    statementLabel: 'Statement',
    statementHint: 'Maximum {max} characters.',
    signedNameLabel: 'Signed name',
    submit: 'Submit attestation',
    update: 'Update attestation',
    saving: 'Saving…',
  },
};

function renderForm() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={queryClient}>
      <NextIntlClientProvider locale="en" messages={messages}>
        <OtherClientAttestationForm engagementId="cass_1" />
      </NextIntlClientProvider>
    </QueryClientProvider>,
  );
}

describe('OtherClientAttestationForm', () => {
  it('renders a labelled section with the attestation heading', () => {
    renderForm();
    const heading = screen.getByRole('heading', { name: 'Other clients attestation' });
    expect(heading.id).toBe('other-client-attestation-heading');
  });

  it('renders statement + signed-name inputs with labels', () => {
    renderForm();
    expect(screen.getByText('Statement')).toBeInTheDocument();
    expect(screen.getByText('Signed name')).toBeInTheDocument();
  });

  it('renders Submit attestation button when no existing attestation exists', () => {
    renderForm();
    expect(screen.getByRole('button', { name: 'Submit attestation' })).toBeInTheDocument();
  });
});
