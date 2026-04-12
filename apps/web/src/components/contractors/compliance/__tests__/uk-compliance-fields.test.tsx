// Wave 0 scaffold — implemented in Plan 06 (UK compliance field UI)
// Tests fail by design until Plan 06 creates
// `apps/web/src/components/contractors/compliance/uk-compliance-fields.tsx`.
// Covers FOUND-01 (UK contractor fields rendered via UkComplianceFields).

import { render, screen } from '@/test/test-utils';
import { describe, expect, it } from 'vitest';
// biome-ignore lint/correctness/noUnresolvedImports: Plan 06 creates this module
// @ts-expect-error Plan 06 creates this module
import { UkComplianceFields } from '@/components/contractors/compliance/uk-compliance-fields';

describe('UkComplianceFields (FOUND-01)', () => {
  it('renders UTR input as required for SOLE_TRADER', () => {
    render(<UkComplianceFields entityType="SOLE_TRADER" isVatRegistered={false} />);
    const utr = screen.getByLabelText(/UTR/i);
    expect(utr).toBeInTheDocument();
    expect(utr).toHaveAttribute('aria-required', 'true');
  });

  it('renders Companies House input as required for LTD', () => {
    render(<UkComplianceFields entityType="LTD" isVatRegistered={false} />);
    const ch = screen.getByLabelText(/Companies House/i);
    expect(ch).toBeInTheDocument();
    expect(ch).toHaveAttribute('aria-required', 'true');
  });

  it('conditionally renders VAT registration input when isVatRegistered=true', () => {
    render(<UkComplianceFields entityType="LTD" isVatRegistered={true} />);
    expect(screen.getByLabelText(/VAT/i)).toBeInTheDocument();
  });

  it('does not render VAT input when isVatRegistered=false', () => {
    render(<UkComplianceFields entityType="LTD" isVatRegistered={false} />);
    expect(screen.queryByLabelText(/VAT registration number/i)).toBeNull();
  });
});
