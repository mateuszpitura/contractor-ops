// VerdictBanner escalation event firing.
//
// Asserts that onAmberVerdictMounted is called exactly once on mount
// when the verdict tone is warning (amber/indeterminate), and is NOT
// called for non-amber verdicts.

import { render } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { VerdictBanner } from '../verdict-banner';

const IR35_INDETERMINATE = {
  kind: 'IR35',
  verdict: 'indeterminate',
  totalScore: 50,
  categoryScores: {},
  answeredAt: new Date(),
  ruleSetVersion: '1.0.0',
};

const IR35_OUTSIDE = {
  kind: 'IR35',
  verdict: 'outside',
  totalScore: 20,
  categoryScores: {},
  answeredAt: new Date(),
  ruleSetVersion: '1.0.0',
};

const DRV_AMBER = {
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
        outcome={IR35_INDETERMINATE as never}
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
        outcome={DRV_AMBER as never}
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
        outcome={IR35_OUTSIDE as never}
        label="Outside"
        onAmberVerdictMounted={onAmber}
      />,
    );
    expect(onAmber).not.toHaveBeenCalled();
  });

  it('does NOT call onAmberVerdictMounted when prop is omitted', () => {
    // Should not throw when prop is absent
    expect(() =>
      render(
        <VerdictBanner kind="ir35" outcome={IR35_INDETERMINATE as never} label="Indeterminate" />,
      ),
    ).not.toThrow();
  });
});
