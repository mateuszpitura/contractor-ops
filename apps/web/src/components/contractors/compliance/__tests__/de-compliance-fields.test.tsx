// Wave 0 scaffold — implemented in Plan 06 (DE compliance field UI)
// Tests fail by design until Plan 06 creates
// `apps/web/src/components/contractors/compliance/de-compliance-fields.tsx`.
// Covers FOUND-02 (DE contractor fields UI) + FOUND-04 (verbatim locked German phrases in DOM).

import { render, screen } from '@/test/test-utils';
import { describe, expect, it } from 'vitest';
// biome-ignore lint/correctness/noUnresolvedImports: Plan 06 creates this module
// @ts-expect-error Plan 06 creates this module
import { DeComplianceFields } from '@/components/contractors/compliance/de-compliance-fields';

describe('DeComplianceFields — Bundesland (FOUND-02)', () => {
  it('renders a Bundesland select with 16 options sorted alphabetically', () => {
    render(<DeComplianceFields entityType="EINZELUNTERNEHMEN" isVatRegistered={false} />);
    const select = screen.getByRole('combobox', { name: /Bundesland/i });
    const options = within(select).getAllByRole('option');
    expect(options).toHaveLength(16);
    // Alphabetical (German names): first = Baden-Württemberg
    expect(options[0]?.textContent).toMatch(/Baden-Württemberg/);
  });

  it('disables Steuernummer input until Bundesland is chosen', () => {
    render(<DeComplianceFields entityType="EINZELUNTERNEHMEN" isVatRegistered={false} />);
    const steuer = screen.getByLabelText(/Steuernummer/);
    expect(steuer).toBeDisabled();
  });
});

describe('DeComplianceFields — locked German phrases (FOUND-04)', () => {
  it.each([
    'Steuernummer',
    'Umsatzsteuer-Identifikationsnummer (USt-IdNr)',
    'Handelsregisternummer',
    'Sozialversicherungsnummer',
  ])('renders verbatim locked phrase %s', phrase => {
    const { container } = render(
      <DeComplianceFields entityType="EINZELUNTERNEHMEN" isVatRegistered={true} />,
    );
    expect(container.textContent).toContain(phrase);
  });

  it('renders Handelsregister as a fieldset with legend "Handelsregisternummer"', () => {
    const { container } = render(
      <DeComplianceFields entityType="GMBH" isVatRegistered={false} />,
    );
    const fieldset = container.querySelector('fieldset');
    expect(fieldset).not.toBeNull();
    const legend = fieldset?.querySelector('legend');
    expect(legend?.textContent).toContain('Handelsregisternummer');
  });
});

// ---------------------------------------------------------------------------
// Local import of `within` — RTL export re-exposed via test-utils in Plan 05
// ---------------------------------------------------------------------------
import { within } from '@testing-library/react';
