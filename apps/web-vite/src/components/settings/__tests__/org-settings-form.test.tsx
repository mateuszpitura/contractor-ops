/**
 * Web-vite port of apps/web/src/components/settings/__tests__/org-settings-form.test.tsx.
 *
 * Container/component split — the form takes register/handleSubmit/setValue
 * plus several option lists and t. We provide a real `useForm` instance
 * in a tiny harness so the controlled selects + inputs are exercised
 * without the tRPC-backed hook.
 */

import { useForm } from 'react-hook-form';
import { describe, expect, it, vi } from 'vitest';

import { render, screen } from '@/test/test-utils';
import type { SettingsValues } from '../hooks/use-org-settings-form';
import { OrgSettingsForm, OrgSettingsFormSkeleton } from '../org-settings-form';

const tStub = ((key: string) => key) as never;

const optionLists = {
  timezones: [
    { value: 'Europe/Warsaw', label: 'Europe/Warsaw' },
    { value: 'UTC', label: 'UTC' },
  ],
  currencies: [
    { value: 'PLN', label: 'PLN' },
    { value: 'EUR', label: 'EUR' },
  ],
  countries: [
    { value: 'PL', label: 'Poland' },
    { value: 'DE', label: 'Germany' },
  ],
  months: [
    { value: 1, label: 'January' },
    { value: 4, label: 'April' },
  ],
};

interface HarnessProps {
  isLoading?: boolean;
  isPending?: boolean;
}

function Harness({ isLoading = false, isPending = false }: HarnessProps) {
  const form = useForm<SettingsValues>({
    defaultValues: {
      name: 'Acme',
      legalName: 'Acme Sp. z o.o.',
      country: 'PL',
      currency: 'PLN',
      timezone: 'Europe/Warsaw',
      language: 'pl',
      dateFormat: 'YYYY-MM-DD',
      timeFormat: '24h',
      fiscalYearStartMonth: 1,
      billingEmail: 'billing@acme.test',
    },
  });

  return (
    <OrgSettingsForm
      id="org"
      t={tStub}
      timezones={optionLists.timezones}
      currencies={optionLists.currencies}
      countries={optionLists.countries}
      months={optionLists.months}
      isLoading={isLoading}
      register={form.register}
      handleSubmit={form.handleSubmit}
      setValue={form.setValue}
      watch={form.watch}
      onSubmit={vi.fn()}
      errors={form.formState.errors}
      isDirty={form.formState.isDirty}
      isPending={isPending}
    />
  );
}

describe('OrgSettingsForm', () => {
  it('renders the loading skeletons via the Skeleton sibling export', () => {
    const { container } = render(<OrgSettingsFormSkeleton />);
    expect(container.querySelectorAll('[data-slot="skeleton"]').length).toBeGreaterThan(0);
    expect(screen.queryByText('tabs.general')).not.toBeInTheDocument();
  });

  it('renders the form fields wired to the supplied defaults', () => {
    render(<Harness />);

    expect(screen.getByText('tabs.general')).toBeInTheDocument();
    expect((screen.getByLabelText(/fields\.orgName/i) as HTMLInputElement).value).toBe('Acme');
    expect((screen.getByLabelText(/billingEmail/i) as HTMLInputElement).value).toBe(
      'billing@acme.test',
    );
  });

  it('disables the save button while the form is pristine', () => {
    render(<Harness />);
    expect(screen.getByRole('button', { name: 'saveCta' })).toBeDisabled();
  });

  it('disables every input + the save button while pending', () => {
    render(<Harness isPending />);
    expect(screen.getByRole('button', { name: 'saving' })).toBeDisabled();
    expect(screen.getByLabelText(/fields\.orgName/i)).toBeDisabled();
  });
});
