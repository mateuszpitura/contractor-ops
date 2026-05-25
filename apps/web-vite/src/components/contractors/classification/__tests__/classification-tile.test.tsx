/**
 * web-vite port. ClassificationTileView is a pure-prop component (container
 * split). `latest` and `isPending` are injected directly; no tRPC mock needed.
 */

import { describe, expect, it } from 'vitest';

import { render, screen } from '../../../../test/test-utils.js';
import {
  ClassificationTileEmpty,
  ClassificationTileSkeleton,
  ClassificationTileView,
} from '../classification-tile.js';

const engagement = {
  id: 'eng-1',
  name: 'Acme — Widgets',
  contractorId: 'c-1',
  countryCode: 'GB' as const,
};

describe('ClassificationTileView', () => {
  it('CT-1 loading: renders the skeleton', () => {
    render(<ClassificationTileSkeleton />);
    expect(screen.getByTestId('classification-tile-skeleton')).toBeInTheDocument();
    expect(screen.queryByTestId('classification-tile-verdict')).not.toBeInTheDocument();
  });

  it('CT-2 empty: renders empty-state copy and the Run-assessment CTA', () => {
    render(<ClassificationTileEmpty engagement={engagement} />);
    const cta = screen.getByTestId('classification-engagement-cta');
    expect(cta).toBeInTheDocument();
    const href = cta.closest('a')?.getAttribute('href') ?? '';
    expect(href).toContain(
      `/contractors/${engagement.contractorId}/engagements/${engagement.id}/classification`,
    );
  });

  it('CT-3 completed: renders verdict pill + view-details link + re-run CTA', () => {
    const completedAt = new Date(Date.now() - 2 * 24 * 60 * 60 * 1000);
    render(
      <ClassificationTileView
        engagement={engagement}
        latest={{
          id: 'a-1',
          ruleSetVersion: 'IR35-2024-CEST',
          completedAt,
          outcome: {
            kind: 'IR35',
            verdict: 'outside',
            ruleSetVersion: 'IR35-2024-CEST',
            areas: [],
            computedAt: completedAt.toISOString(),
          },
        }}
      />,
    );
    expect(screen.getByTestId('classification-tile-verdict')).toBeInTheDocument();

    const viewDetails = screen.getByTestId('classification-tile-view-details');
    const href = viewDetails.closest('a')?.getAttribute('href') ?? '';
    expect(href).toContain(
      `/contractors/${engagement.contractorId}/engagements/${engagement.id}/classification/a-1`,
    );

    expect(screen.getByTestId('classification-tile-rerun')).toBeInTheDocument();
  });
});
