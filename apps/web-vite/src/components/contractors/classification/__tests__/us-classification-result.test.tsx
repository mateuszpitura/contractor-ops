/**
 * The wired section is data-layer compliant (props/hooks only). We mock the two
 * hooks so the four states, the blocking disclaimer gate, the amber AB5 flag,
 * the info §530 flag, and the override trigger resolve in isolation.
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';

const hooks = vi.hoisted(() => ({
  useUsClassification: vi.fn(),
  useClassificationDisclaimerAck: vi.fn(),
}));

vi.mock('../hooks/use-us-classification.js', () => ({
  useUsClassification: hooks.useUsClassification,
}));
vi.mock('../hooks/use-classification-disclaimer.js', () => ({
  useClassificationDisclaimerAck: hooks.useClassificationDisclaimerAck,
}));

import { render, screen } from '../../../../test/test-utils.js';
import { ClassificationOverrideDialog } from '../classification-override-dialog.js';
import { UsClassificationResult } from '../us-classification-result.js';

const engagement = { id: 'cass_1', name: 'Acme LLC', contractorId: 'c_1' } as const;

type OutcomeOverrides = {
  verdict?: 'employee' | 'independent-contractor' | 'indeterminate';
  ab5Flag?: boolean;
  section530ReliefEligible?: boolean;
};

function usOutcome(overrides: OutcomeOverrides = {}) {
  return {
    kind: 'US_CLASSIFICATION' as const,
    ruleSetVersion: 'us-2026.1',
    verdict: overrides.verdict ?? 'employee',
    federalFactors: [
      { category: 'behavioral', employeeSignals: 3, contractorSignals: 1 },
      { category: 'financial', employeeSignals: 1, contractorSignals: 2 },
      { category: 'relationship', employeeSignals: 2, contractorSignals: 2 },
    ],
    ab5Flag: overrides.ab5Flag ?? true,
    section530ReliefEligible: overrides.section530ReliefEligible ?? true,
    computedAt: '2026-06-01T00:00:00.000Z',
  };
}

function setHook(over: Record<string, unknown> = {}) {
  hooks.useUsClassification.mockReturnValue({
    latest: null,
    isPending: false,
    isError: false,
    refetch: vi.fn(),
    override: vi.fn().mockResolvedValue(undefined),
    overrideMutation: { isPending: false, error: null },
    ...over,
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  hooks.useClassificationDisclaimerAck.mockReturnValue({ acknowledge: vi.fn(), isPending: false });
  setHook();
});

describe('UsClassificationResult states', () => {
  it('loading → aria-busy skeleton', () => {
    setHook({ isPending: true });
    render(<UsClassificationResult engagement={engagement} />);
    expect(screen.getByTestId('us-classification-result')).toHaveAttribute('aria-busy', 'true');
  });

  it('error → role=alert + reload', () => {
    setHook({ isError: true });
    render(<UsClassificationResult engagement={engagement} />);
    expect(screen.getByRole('alert')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /reload/i })).toBeInTheDocument();
  });

  it('empty (no assessment) → empty heading + CTA', () => {
    setHook({ latest: null });
    render(<UsClassificationResult engagement={engagement} />);
    expect(screen.getByText(/no US classification assessment yet/i)).toBeInTheDocument();
  });

  it('non-US outcome falls back to the empty state', () => {
    setHook({
      latest: {
        id: 'ca_1',
        disclaimerAcknowledgedAt: new Date(),
        outcome: { kind: 'IR35', verdict: 'inside', ruleSetVersion: 'x', areas: [] },
      },
    });
    render(<UsClassificationResult engagement={engagement} />);
    expect(screen.getByText(/no US classification assessment yet/i)).toBeInTheDocument();
  });
});

describe('UsClassificationResult loaded', () => {
  it('blocks the outcome behind the disclaimer until acknowledged', () => {
    setHook({
      latest: { id: 'ca_1', disclaimerAcknowledgedAt: null, outcome: usOutcome() },
    });
    render(<UsClassificationResult engagement={engagement} />);
    expect(screen.getByText(/before you view this result/i)).toBeInTheDocument();
    expect(screen.queryByTestId('us-classification-verdict')).toBeNull();
  });

  it('shows the verdict pill, AB5 amber flag, §530 flag, and override trigger once acknowledged', () => {
    setHook({
      latest: { id: 'ca_1', disclaimerAcknowledgedAt: new Date(), outcome: usOutcome() },
    });
    render(<UsClassificationResult engagement={engagement} />);
    const verdict = screen.getByTestId('us-classification-verdict');
    expect(verdict).toHaveAttribute('data-tone', 'destructive');
    const ab5 = screen.getByTestId('ab5-watchlist-flag');
    // Amber warning treatment — never the destructive variant classes.
    expect(ab5.className).not.toMatch(/bg-destructive|text-destructive/);
    expect(ab5.className).toMatch(/amber/);
    expect(screen.getByTestId('section530-flag')).toBeInTheDocument();
    expect(screen.getByTestId('us-classification-override-trigger')).toBeInTheDocument();
    expect(screen.getByText(/need verification by a jurisdiction-specific/i)).toBeInTheDocument();
  });

  it('omits the AB5 flag when the CA overlay did not apply', () => {
    setHook({
      latest: {
        id: 'ca_1',
        disclaimerAcknowledgedAt: new Date(),
        outcome: usOutcome({ ab5Flag: false, verdict: 'independent-contractor' }),
      },
    });
    render(<UsClassificationResult engagement={engagement} />);
    expect(screen.queryByTestId('ab5-watchlist-flag')).toBeNull();
    expect(screen.getByTestId('us-classification-verdict')).toHaveAttribute('data-tone', 'success');
  });
});

describe('ClassificationOverrideDialog', () => {
  it('disables submit until a verdict, a reason, and the acknowledgement are provided', () => {
    render(
      <ClassificationOverrideDialog
        engagementName="Acme LLC"
        open
        onOpenChange={vi.fn()}
        onSubmit={vi.fn().mockResolvedValue(undefined)}
      />,
    );
    expect(screen.getByRole('button', { name: /save override/i })).toBeDisabled();
    expect(screen.getByLabelText(/reason/i)).toBeInTheDocument();
  });
});
