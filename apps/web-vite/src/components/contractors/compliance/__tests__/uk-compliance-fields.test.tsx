// Plan 06 — FOUND-01 (UK contractor profile field UI).
//
// Rendering rules verified:
//   * Entity-type-driven required markers (UTR vs Companies House)
//   * VAT-registered toggle gating the VAT registration number input

import { describe, expect, it } from 'vitest';
import { UkComplianceFields } from '@/components/contractors/compliance/uk-compliance-fields';
import { render, screen } from '@/test/test-utils';

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

  it('does not mark UTR as required when entity type is LTD', () => {
    render(<UkComplianceFields entityType="LTD" isVatRegistered={false} />);
    const utr = screen.getByLabelText(/UTR/i);
    expect(utr).not.toHaveAttribute('aria-required', 'true');
  });

  it('conditionally renders VAT registration input when isVatRegistered=true', () => {
    render(<UkComplianceFields entityType="LTD" isVatRegistered={true} />);
    const vat = screen.getByLabelText(/VAT registration number/i);
    expect(vat).toBeInTheDocument();
    expect(vat).toHaveAttribute('aria-required', 'true');
  });

  it('does not render VAT input when isVatRegistered=false', () => {
    render(<UkComplianceFields entityType="LTD" isVatRegistered={false} />);
    expect(screen.queryByLabelText(/VAT registration number/i)).toBeNull();
  });
});
