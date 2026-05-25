/**
 * web-vite port. View is `StepCompanyView` taking lookup + isLookupLoading
 * as direct props.
 */

import { useForm } from 'react-hook-form';
import { describe, expect, it, vi } from 'vitest';
import { render, screen, setup } from '../../../../test/test-utils.js';
import { StepCompanyView } from '../step-company.js';
import type { WizardFormValues } from '../wizard-dialog.js';

type StepCompanyLookup = Parameters<typeof StepCompanyView>[0]['lookup'];

function Wrapper({
  defaultValues,
  lookup,
  isLookupLoading = false,
}: {
  defaultValues?: Partial<WizardFormValues>;
  lookup?: StepCompanyLookup;
  isLookupLoading?: boolean;
}) {
  const form = useForm<WizardFormValues>({
    defaultValues: {
      taxId: '',
      legalName: '',
      displayName: '',
      type: undefined,
      email: '',
      vatId: '',
      registrationNumber: '',
      addressLine1: '',
      addressLine2: '',
      city: '',
      postalCode: '',
      ...defaultValues,
    } as WizardFormValues,
  });
  const fallbackLookup: StepCompanyLookup = vi.fn(async () => undefined);
  return (
    <StepCompanyView
      form={form}
      lookup={lookup ?? fallbackLookup}
      isLookupLoading={isLookupLoading}
    />
  );
}

describe('StepCompanyView', () => {
  it('renders NIP input with company-lookup button', () => {
    render(<Wrapper />);
    expect(screen.getByPlaceholderText('0000000000')).toBeInTheDocument();
    expect(screen.getAllByRole('button').length).toBeGreaterThan(0);
  });

  it('renders legal name input', () => {
    render(<Wrapper />);
    expect(document.querySelector('[id$="-legalName"]')).toBeInTheDocument();
  });

  it('renders contractor type radio group with 4 options', () => {
    render(<Wrapper />);
    expect(screen.getAllByRole('radio')).toHaveLength(4);
  });

  it('renders email input', () => {
    render(<Wrapper />);
    expect(document.querySelector('[id$="-email"]')).toBeInTheDocument();
  });

  it('renders VAT-EU input', () => {
    render(<Wrapper />);
    expect(document.querySelector('[id$="-vatId"]')).toBeInTheDocument();
  });

  it('allows typing in NIP input', async () => {
    const { user } = setup(<Wrapper />);
    const nipInput = screen.getByPlaceholderText('0000000000');
    await user.type(nipInput, '1234567890');
    expect(nipInput).toHaveValue('1234567890');
  });

  it('invokes lookup when the Fetch button is clicked', async () => {
    const lookup: StepCompanyLookup = vi.fn(async () => undefined);
    const { user } = setup(<Wrapper defaultValues={{ taxId: '1234567890' }} lookup={lookup} />);
    const buttons = screen.getAllByRole('button');
    const lookupBtn = buttons.find(b => /fetch/i.test(b.textContent ?? ''));
    expect(lookupBtn).toBeDefined();
    if (lookupBtn) await user.click(lookupBtn);
    expect(lookup).toHaveBeenCalledWith('1234567890', expect.any(Function));
  });

  it('disables the lookup button while isLookupLoading=true', () => {
    render(<Wrapper isLookupLoading={true} />);
    const buttons = screen.getAllByRole('button');
    const lookupBtn = buttons.find(b => /fetch/i.test(b.textContent ?? ''));
    expect(lookupBtn).toBeDisabled();
  });

  it('allows typing in email input', async () => {
    const { user } = setup(<Wrapper />);
    const emailInput = document.querySelector('[id$="-email"]') as HTMLInputElement;
    await user.type(emailInput, 'test@example.com');
    expect(emailInput).toHaveValue('test@example.com');
  });

  it('allows selecting a contractor type', async () => {
    const { user } = setup(<Wrapper />);
    const radios = screen.getAllByRole('radio');
    await user.click(radios[1]);
    expect(radios[1]).toBeChecked();
  });
});
