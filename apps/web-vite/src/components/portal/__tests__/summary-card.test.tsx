/**
 * Step 10 port of apps/web/src/components/portal/__tests__/summary-card.test.tsx.
 *
 * SummaryCard is the dashboard stat tile (invoice count, paid amount, ...).
 * It carries no i18n and no tRPC, so the port is a direct render of
 * static + skeleton variants.
 *
 * Uses react-dom/client directly (same pattern as the other web-vite
 * component tests) — @testing-library/react is not yet a declared dep.
 */

import { Receipt } from 'lucide-react';
import type { ReactElement } from 'react';
import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { afterEach, describe, expect, it } from 'vitest';

import { SummaryCard, SummaryCardSkeleton } from '../summary-card.js';

interface Rendered {
  container: HTMLDivElement;
  unmount: () => void;
}

const mounted: Rendered[] = [];

function renderInto(node: ReactElement): Rendered {
  const container = document.createElement('div');
  document.body.appendChild(container);
  const root = createRoot(container);
  void act(() => {
    root.render(node);
  });
  const handle: Rendered = {
    container,
    unmount: () => {
      void act(() => {
        root.unmount();
      });
      container.remove();
    },
  };
  mounted.push(handle);
  return handle;
}

afterEach(() => {
  while (mounted.length > 0) {
    mounted.pop()?.unmount();
  }
});

describe('SummaryCard', () => {
  it('renders label and numeric value', () => {
    const { container } = renderInto(
      <SummaryCard icon={Receipt} label="Total Invoices" value={42} />,
    );
    expect(container.textContent).toContain('Total Invoices');
    expect(container.textContent).toContain('42');
  });

  it('renders string value (pre-formatted currency)', () => {
    const { container } = renderInto(<SummaryCard icon={Receipt} label="Amount" value="$1,200" />);
    expect(container.textContent).toContain('$1,200');
  });

  it('renders the icon as inline SVG', () => {
    const { container } = renderInto(<SummaryCard icon={Receipt} label="Test" value={0} />);
    expect(container.querySelector('svg')).toBeTruthy();
  });

  it('appends a custom className to the card root', () => {
    const { container } = renderInto(
      <SummaryCard icon={Receipt} label="Test" value={0} className="custom-class" />,
    );
    expect((container.firstElementChild as HTMLElement | null)?.className).toContain(
      'custom-class',
    );
  });

  it('handles zero value without falling back to a blank cell', () => {
    const { container } = renderInto(<SummaryCard icon={Receipt} label="Pending" value={0} />);
    expect(container.textContent).toContain('0');
  });
});

describe('SummaryCardSkeleton', () => {
  it('renders without throwing', () => {
    const { container } = renderInto(<SummaryCardSkeleton />);
    expect(container.firstElementChild).toBeTruthy();
  });

  it('appends a custom className to the skeleton root', () => {
    const { container } = renderInto(<SummaryCardSkeleton className="extra" />);
    expect((container.firstElementChild as HTMLElement | null)?.className).toContain('extra');
  });
});
