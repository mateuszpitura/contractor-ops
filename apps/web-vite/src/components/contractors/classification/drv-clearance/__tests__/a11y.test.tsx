/**
 * web-vite port — accessibility checks for DRV clearance form + row.
 */

import { describe, expect, it, vi } from 'vitest';

import { render, screen, setup } from '../../../../../test/test-utils.js';
import { DrvClearanceFormView } from '../drv-clearance-form.js';
import type { DrvClearanceRowData } from '../drv-clearance-row.js';
import { DrvClearanceRow } from '../drv-clearance-row.js';

// React Query's `UseMutationResult` type can resolve to two structurally
// identical but nominally distinct instances across the tRPC + react-query
// graph here (TS2719). Building the mock as `unknown` and asserting at the
// JSX prop boundary keeps the runtime spy accessible while sidestepping the
// nominal collision.
type MutationMock = { mutate: ReturnType<typeof vi.fn>; isPending: boolean };
function makeMutation(): MutationMock {
  return { mutate: vi.fn(), isPending: false };
}
type CreateMutationProp = Parameters<typeof DrvClearanceFormView>[0]['createMutation'];
type UpdateMutationProp = Parameters<typeof DrvClearanceFormView>[0]['updateMutation'];

const noop = () => undefined;

describe('DrvClearanceFormView — accessibility', () => {
  it('associates every labelled field with an input', () => {
    render(
      <DrvClearanceFormView
        open
        onOpenChange={noop}
        contractorAssignmentId="ca-1"
        createMutation={makeMutation() as unknown as CreateMutationProp}
        updateMutation={makeMutation() as unknown as UpdateMutationProp}
      />,
    );
    expect(screen.getByLabelText(/Filing date/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/DRV case reference/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/Notes/i)).toBeInTheDocument();
  });

  it('surfaces validation errors with role="alert" when required fields are empty', async () => {
    const createMutation = makeMutation();
    const { user } = setup(
      <DrvClearanceFormView
        open
        onOpenChange={noop}
        contractorAssignmentId="ca-1"
        createMutation={createMutation as unknown as CreateMutationProp}
        updateMutation={makeMutation() as unknown as UpdateMutationProp}
      />,
    );

    const submit = screen.getByRole('button', { name: /File clearance/i });
    await user.click(submit);

    const alerts = screen.getAllByRole('alert');
    expect(alerts.length).toBeGreaterThan(0);
    expect(alerts.some(el => /DRV reference is required/i.test(el.textContent ?? ''))).toBe(true);
    expect(createMutation.mutate).not.toHaveBeenCalled();
  });

  it('external V0023 link carries rel="noopener noreferrer" and target="_blank"', () => {
    render(
      <DrvClearanceFormView
        open
        onOpenChange={noop}
        contractorAssignmentId="ca-1"
        createMutation={makeMutation() as unknown as CreateMutationProp}
        updateMutation={makeMutation() as unknown as UpdateMutationProp}
      />,
    );

    const link = screen.getByRole('link', { name: /DRV form V0023/i });
    expect(link.getAttribute('target')).toBe('_blank');
    expect(link.getAttribute('rel')).toContain('noopener');
    expect(link.getAttribute('rel')).toContain('noreferrer');
  });
});

describe('DrvClearanceRow — accessibility', () => {
  it('renders the expiry countdown inside an aria-live="polite" region', () => {
    const in45 = new Date();
    in45.setDate(in45.getDate() + 45);

    const clearance: DrvClearanceRowData = {
      id: 'sfv-1',
      filedAt: new Date('2026-01-15'),
      drvReference: 'DRV-A11Y-001',
      outcome: 'SELBSTANDIG',
      validFrom: new Date('2026-01-15'),
      validTo: in45,
      notes: null,
    };

    const { container } = render(
      <table>
        <tbody>
          <DrvClearanceRow clearance={clearance} onEdit={noop} />
        </tbody>
      </table>,
    );

    const live = container.querySelector('[aria-live="polite"]');
    expect(live).not.toBeNull();
  });

  it('outcome chip surfaces an accessible text label (not colour-only)', () => {
    const clearance: DrvClearanceRowData = {
      id: 'sfv-2',
      filedAt: new Date('2026-01-15'),
      drvReference: 'DRV-A11Y-002',
      outcome: 'ABHANGIG',
      validFrom: new Date('2026-01-15'),
      validTo: new Date('2027-01-15'),
      notes: null,
    };

    render(
      <table>
        <tbody>
          <DrvClearanceRow clearance={clearance} onEdit={noop} />
        </tbody>
      </table>,
    );

    expect(screen.getByText(/Dependent employment/i)).toBeInTheDocument();
  });
});
