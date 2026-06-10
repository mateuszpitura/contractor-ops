/**
 * US compliance dispatch — RED until `UsComplianceFields` is created at
 * apps/web-vite/src/components/contractors/compliance/us-compliance-fields.tsx
 * (mirroring UkComplianceFields) and `case 'US'` is registered in
 * CountryFieldsDispatch. The import below resolves to a not-yet-existing
 * module so the suite fails (Cannot find module).
 *
 * Path-scoped only — NEVER the unscoped web-vite suite (RAM constraint).
 */

import { describe, expect, it, vi } from 'vitest';

import { render, screen } from '../../../test/test-utils.js';
import { UsComplianceFields } from '../compliance/us-compliance-fields.js';

describe('UsComplianceFields — US dispatch render (US-FIELD-04)', () => {
  it('renders the EIN input', () => {
    render(<UsComplianceFields values={{}} onChange={vi.fn()} contractorId="contractor-1" />);
    expect(screen.getByLabelText(/EIN/i)).toBeInTheDocument();
  });

  it('renders the SSN field', () => {
    render(<UsComplianceFields values={{}} onChange={vi.fn()} contractorId="contractor-1" />);
    expect(screen.getByLabelText(/Social Security Number/i)).toBeInTheDocument();
  });

  it('renders the US address block (state + ZIP)', () => {
    render(<UsComplianceFields values={{}} onChange={vi.fn()} contractorId="contractor-1" />);
    expect(screen.getByLabelText(/ZIP/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/State/i)).toBeInTheDocument();
  });
});
