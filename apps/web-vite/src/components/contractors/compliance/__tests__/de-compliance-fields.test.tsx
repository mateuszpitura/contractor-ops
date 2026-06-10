// DE contractor fields UI — rendering rules verified:
//   * Bundesland <select> contains exactly the 16 states, alphabetical
//   * Steuernummer input is disabled until a Bundesland is chosen
//   * Selecting a Bundesland swaps the Steuernummer format hint
//   * Every locked German tax label from `legal/de.ts` renders verbatim
//   * Handelsregister composite is a real <fieldset> with <legend>

import { fireEvent } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { DeComplianceFields } from '@/components/contractors/compliance/de-compliance-fields';
import { render, screen, within } from '@/test/test-utils';

describe('DeComplianceFields — Bundesland', () => {
  it('renders a Bundesland select with 16 options sorted alphabetically', () => {
    render(<DeComplianceFields entityType="EINZELUNTERNEHMEN" isVatRegistered={false} />);
    const select = screen.getByRole('combobox', { name: /Bundesland/i });
    const options = within(select).getAllByRole('option');
    expect(options).toHaveLength(16);
    // Alphabetical (German names): first = Baden-Württemberg, last = Thüringen
    expect(options[0]?.textContent).toMatch(/Baden-Württemberg/);
    expect(options[options.length - 1]?.textContent).toMatch(/Thüringen/);
  });

  it('disables Steuernummer input until Bundesland is chosen', () => {
    render(<DeComplianceFields entityType="EINZELUNTERNEHMEN" isVatRegistered={false} />);
    const steuer = screen.getByLabelText(/Steuernummer/);
    expect(steuer).toBeDisabled();
  });

  it('enables Steuernummer and reflects the Bundesland format hint after selection', () => {
    render(<DeComplianceFields entityType="EINZELUNTERNEHMEN" isVatRegistered={false} />);
    const select = screen.getByRole('combobox', { name: /Bundesland/i });
    fireEvent.change(select, { target: { value: 'BW' } });
    const steuer = screen.getByLabelText(/Steuernummer/) as HTMLInputElement;
    expect(steuer).not.toBeDisabled();
    expect(steuer.placeholder).toBe('93/815/08152');
  });
});

describe('DeComplianceFields — locked German phrases', () => {
  it.each([
    'Steuernummer',
    'Umsatzsteuer-Identifikationsnummer (USt-IdNr)',
    'Handelsregisternummer',
    'Sozialversicherungsnummer',
    'Kleinunternehmer gemäß § 19 UStG',
  ])('renders verbatim locked phrase %s', phrase => {
    const { container } = render(<DeComplianceFields entityType="GMBH" isVatRegistered={true} />);
    expect(container.textContent).toContain(phrase);
  });

  it('renders Handelsregister as a fieldset with legend "Handelsregisternummer"', () => {
    const { container } = render(<DeComplianceFields entityType="GMBH" isVatRegistered={false} />);
    const fieldset = container.querySelector('fieldset');
    expect(fieldset).not.toBeNull();
    const legend = fieldset?.querySelector('legend');
    expect(legend?.textContent).toContain('Handelsregisternummer');
    // aria-labelledby must target the legend for group announcement
    expect(fieldset?.getAttribute('aria-labelledby')).toBe(legend?.id);
  });

  it('does not render Handelsregister for EINZELUNTERNEHMEN (sole prop.)', () => {
    const { container } = render(
      <DeComplianceFields entityType="EINZELUNTERNEHMEN" isVatRegistered={false} />,
    );
    expect(container.querySelector('fieldset')).toBeNull();
  });
});
