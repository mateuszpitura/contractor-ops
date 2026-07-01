import { describe, expect, it } from 'vitest';

import { render, screen } from '@/test/test-utils';
import type { ErasureResult } from '../hooks/use-personnel-erasure.js';
import { ErasureResultView } from '../personnel-erasure-dialog.js';

const partialResult: ErasureResult = {
  workerId: 'worker-1',
  fullErasureClaimed: false,
  sections: [
    { section: 'A', disposition: 'erased' },
    { section: 'B', disposition: 'erased' },
    { section: 'C', disposition: 'erased' },
    {
      section: 'D',
      disposition: 'retained',
      citation: 'KP art. 94(5)',
      retainUntil: new Date('2031-01-15T00:00:00Z'),
    },
  ],
};

const fullResult: ErasureResult = {
  workerId: 'worker-2',
  fullErasureClaimed: true,
  sections: [
    { section: 'A', disposition: 'erased' },
    { section: 'B', disposition: 'erased' },
    { section: 'C', disposition: 'erased' },
    { section: 'D', disposition: 'erased' },
  ],
};

describe('ErasureResultView — criterion #3 banner', () => {
  it('renders the partial-erasure WARNING (never a full-erasure success) when one of four sections is retained', () => {
    render(<ErasureResultView result={partialResult} jurisdiction="PL" />);

    // The load-bearing guarantee: fullErasureClaimed === false MUST show the
    // partial-erasure copy and a warning banner, even with 3 of 4 erased.
    expect(screen.getByRole('alert')).toBeInTheDocument();
    expect(
      screen.getByText('3 of 4 sections erased — 1 retained under statutory hold'),
    ).toBeInTheDocument();

    // It must NEVER render the full-erasure success while a hold is active.
    expect(screen.queryByText('All sections erased')).not.toBeInTheDocument();
    expect(screen.queryByRole('status')).not.toBeInTheDocument();

    // The retained row carries its citation + retain-until and the Retained badge.
    expect(screen.getByText(/KP art\. 94\(5\)/)).toBeInTheDocument();
    expect(screen.getByText('Retained')).toBeInTheDocument();

    // The adviser-verify note is the locked disclaimer constant (verbatim).
    expect(
      screen.getByText(
        /seeded reference data pending jurisdiction legal or tax adviser verification/,
      ),
    ).toBeInTheDocument();
  });

  it('renders the full-erasure success only when fullErasureClaimed is true', () => {
    render(<ErasureResultView result={fullResult} jurisdiction="PL" />);

    expect(screen.getByRole('status')).toBeInTheDocument();
    expect(screen.getByText('All sections erased')).toBeInTheDocument();

    // No partial warning when everything is erased.
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    expect(screen.queryByText(/retained under statutory hold/)).not.toBeInTheDocument();
  });
});
