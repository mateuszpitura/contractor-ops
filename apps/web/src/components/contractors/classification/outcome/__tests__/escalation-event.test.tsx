// Phase 64 · D-19 — VerdictBanner escalation event firing (LEGAL-04).
//
// Asserts that onAmberVerdictMounted is called exactly once on mount
// when the verdict tone is warning (amber/indeterminate), and is NOT
// called for non-amber verdicts.

import type { Ir35Outcome, ScheinselbstandigkeitOutcome } from '@contractor-ops/classification';
import { render } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { VerdictBanner } from '../verdict-banner';

const IR35_INDETERMINATE: Ir35Outcome = {
  kind: 'IR35',
  verdict: 'indeterminate',
  totalScore: 50,
  categoryScores: {},
  answeredAt: new Date(),
  ruleSetVersion: '1.0.0',
};

const IR35_OUTSIDE: Ir35Outcome = {
  kind: 'IR35',
  verdict: 'outside',
  totalScore: 20,
  categoryScores: {},
  answeredAt: new Date(),
  ruleSetVersion: '1.0.0',
};

const DRV_AMBER: ScheinselbstandigkeitOutcome = {
  kind: 'SCHEINSELBSTANDIGKEIT',
  verdict: 'amber',
  categoryScores: {},
  answeredAt: new Date(),
  ruleSetVersion: '1.0.0',
};

describe('VerdictBanner escalation event (Phase 64 D-19)', () => {
  it('calls onAmberVerdictMounted on mount for IR35 indeterminate verdict', () => {
    const onAmber = vi.fn();
    render(
      <VerdictBanner
        kind="ir35"
        outcome={IR35_INDETERMINATE}
        label="Indeterminate"
        onAmberVerdictMounted={onAmber}
      />,
    );
    expect(onAmber).toHaveBeenCalledTimes(1);
  });

  it('calls onAmberVerdictMounted on mount for DRV amber verdict', () => {
    const onAmber = vi.fn();
    render(
      <VerdictBanner
        kind="drv"
        outcome={DRV_AMBER}
        label="Amber"
        onAmberVerdictMounted={onAmber}
      />,
    );
    expect(onAmber).toHaveBeenCalledTimes(1);
  });

  it('does NOT call onAmberVerdictMounted for outside/green verdicts', () => {
    const onAmber = vi.fn();
    render(
      <VerdictBanner
        kind="ir35"
        outcome={IR35_OUTSIDE}
        label="Outside"
        onAmberVerdictMounted={onAmber}
      />,
    );
    expect(onAmber).not.toHaveBeenCalled();
  });

  it('does NOT call onAmberVerdictMounted when prop is omitted', () => {
    // Should not throw when prop is absent
    expect(() =>
      render(<VerdictBanner kind="ir35" outcome={IR35_INDETERMINATE} label="Indeterminate" />),
    ).not.toThrow();
  });
});
