// Phase 60 · CLASS-09 — DRV clearance a11y tests.
// See .planning/phases/60-classification-polish/60-UI-SPEC.md §Accessibility Contract.
//
// Covers: form label associations, role="alert" on validation errors,
// rel="noopener noreferrer" + target="_blank" on the external V0023 link
// (T-60-11 reverse-tabnabbing mitigation), and aria-live="polite" on the
// expiry-countdown caption.

import { beforeEach, describe, expect, it, vi } from 'vitest';

const mockMutate = vi.fn();

vi.mock('@tanstack/react-query', async () => {
  const actual = await vi.importActual<Record<string, unknown>>('@tanstack/react-query');
  return {
    ...actual,
    useMutation: () => ({ mutate: mockMutate, isPending: false }),
    useQueryClient: () => ({ invalidateQueries: vi.fn() }),
  };
});

vi.mock('@/trpc/init', () => ({
  trpc: {
    statusfeststellungsverfahren: {
      create: { mutationOptions: (opts?: { onSuccess?: () => void }) => ({ ...opts }) },
      update: { mutationOptions: (opts?: { onSuccess?: () => void }) => ({ ...opts }) },
    },
  },
}));

import { render, screen, setup } from '@/test/test-utils';

import { DrvClearanceForm } from '../drv-clearance-form';
import type { DrvClearanceRowData } from '../drv-clearance-row';
import { DrvClearanceRow } from '../drv-clearance-row';

beforeEach(() => {
  mockMutate.mockClear();
});

describe('DrvClearanceForm — accessibility (UI-SPEC §Accessibility Contract)', () => {
  it('associates every labelled field with an input (label htmlFor → input id)', () => {
    render(<DrvClearanceForm open onOpenChange={() => undefined} contractorAssignmentId="ca-1" />);

    // getByLabelText ensures the label is actually associated with a form control.
    expect(screen.getByLabelText(/Filing date/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/DRV case reference/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/Notes/i)).toBeInTheDocument();
  });

  it('surfaces validation errors with role="alert" when required fields are empty', async () => {
    const { user } = setup(
      <DrvClearanceForm open onOpenChange={() => undefined} contractorAssignmentId="ca-1" />,
    );

    const submit = screen.getByRole('button', { name: /File clearance/i });
    await user.click(submit);

    const alerts = screen.getAllByRole('alert');
    expect(alerts.length).toBeGreaterThan(0);
    // The drvReference field is the canonical required field.
    expect(alerts.some(el => /DRV reference is required/i.test(el.textContent ?? ''))).toBe(true);
    // The server mutation should NOT have been called.
    expect(mockMutate).not.toHaveBeenCalled();
  });

  it('external V0023 link carries rel="noopener noreferrer" and target="_blank" (T-60-11)', () => {
    render(<DrvClearanceForm open onOpenChange={() => undefined} contractorAssignmentId="ca-1" />);

    const link = screen.getByRole('link', { name: /DRV form V0023/i });
    expect(link.getAttribute('target')).toBe('_blank');
    expect(link.getAttribute('rel')).toContain('noopener');
    expect(link.getAttribute('rel')).toContain('noreferrer');
  });
});

describe('DrvClearanceRow — accessibility', () => {
  it('renders the expiry countdown inside an aria-live="polite" region', () => {
    const in45: ClearanceDateIso = new Date();
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
          <DrvClearanceRow clearance={clearance} onEdit={() => undefined} />
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
          <DrvClearanceRow clearance={clearance} onEdit={() => undefined} />
        </tbody>
      </table>,
    );

    expect(screen.getByText(/Dependent employment/i)).toBeInTheDocument();
  });
});

type ClearanceDateIso = Date;
