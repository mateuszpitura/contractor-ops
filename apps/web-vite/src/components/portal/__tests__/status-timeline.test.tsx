/**
 * StatusTimeline is the five-step strip on the portal invoice detail
 * page (Submitted -> In Review -> Approved -> Payment Scheduled -> Paid).
 * Lock the activeStep / rejected branching, including the
 * rejected-from-review styling that swaps the second circle to destructive.
 *
 * Uses react-dom/client directly + i18n bootstrap to match the existing
 * web-vite render pattern (e.g. equipment-status-badge.test.tsx).
 */

import type { ReactElement } from 'react';
import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { afterEach, beforeAll, describe, expect, it } from 'vitest';

import { applyLocale, initI18n } from '../../../i18n/index.js';
import { StatusTimeline, StatusTimelineSkeleton } from '../status-timeline.js';

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

beforeAll(async () => {
  initI18n();
  await applyLocale('en');
});

afterEach(() => {
  while (mounted.length > 0) {
    mounted.pop()?.unmount();
  }
});

const baseProps = {
  status: 'RECEIVED',
  approvalStatus: 'PENDING',
  paymentStatus: 'NONE',
} as const;

describe('StatusTimeline · step labels', () => {
  it('renders all five lifecycle labels in both desktop and mobile layouts', () => {
    const { container } = renderInto(<StatusTimeline {...baseProps} />);
    // Source renders one <ol> for desktop + one for mobile = 2 copies per label.
    const text = container.textContent ?? '';
    for (const label of ['Submitted', 'In Review', 'Approved', 'Payment Scheduled', 'Paid']) {
      const occurrences = text.split(label).length - 1;
      expect(occurrences).toBeGreaterThanOrEqual(2);
    }
  });

  it('mounts both desktop and mobile <ol> lists', () => {
    const { container } = renderInto(<StatusTimeline {...baseProps} />);
    expect(container.querySelectorAll('ol').length).toBe(2);
  });
});

describe('StatusTimeline · active step', () => {
  it('marks step 0 (Submitted) active for RECEIVED — no past steps yet', () => {
    const { container } = renderInto(<StatusTimeline {...baseProps} />);
    // Active step shows an animated pulse ring; past steps would show green circles.
    expect(container.querySelectorAll('.animate-pulse').length).toBeGreaterThan(0);
    expect(container.querySelectorAll('.bg-green-600').length).toBe(0);
  });

  it('marks step 2 (Approved) active when approvalStatus = APPROVED', () => {
    const { container } = renderInto(
      <StatusTimeline status="UNDER_REVIEW" approvalStatus="APPROVED" paymentStatus="NONE" />,
    );
    // Steps 0 + 1 are past -> two green connector segments + green circles.
    expect(container.querySelectorAll('.bg-green-600').length).toBeGreaterThanOrEqual(2);
    // Step 2 is active -> primary pulse still visible.
    expect(container.querySelectorAll('.animate-pulse').length).toBeGreaterThan(0);
  });

  it('marks every step past when paymentStatus = PAID (full happy path)', () => {
    const { container } = renderInto(
      <StatusTimeline status="UNDER_REVIEW" approvalStatus="APPROVED" paymentStatus="PAID" />,
    );
    // Steps 0..3 past => four green Check circles per layout. Connectors
    // also paint `bg-green-600` for past steps, so we filter to elements
    // that actually contain the inline <Check /> svg to count circles.
    const greenCircles = Array.from(container.querySelectorAll('.bg-green-600')).filter(el =>
      el.querySelector('svg'),
    );
    expect(greenCircles.length).toBe(8);
    // Step 4 (Paid) is the active head and still renders a pulse — that's
    // by design in the source (`index === activeIndex && !rejected`).
    expect(container.querySelectorAll('.animate-pulse').length).toBe(2);
  });

  it('marks step 3 (Payment Scheduled) active when paymentStatus = IN_RUN', () => {
    const { container } = renderInto(
      <StatusTimeline status="UNDER_REVIEW" approvalStatus="APPROVED" paymentStatus="IN_RUN" />,
    );
    // Steps 0..2 past = three green circles per layout.
    expect(container.querySelectorAll('.bg-green-600').length).toBeGreaterThanOrEqual(3);
    expect(container.querySelectorAll('.animate-pulse').length).toBeGreaterThan(0);
  });
});

describe('StatusTimeline · rejected state', () => {
  it('renders destructive circles on the In-Review step in both layouts', () => {
    const { container } = renderInto(
      <StatusTimeline {...baseProps} rejectedAt="2026-04-01T00:00:00Z" />,
    );
    // Source paints exactly one destructive circle per layout (desktop + mobile).
    expect(container.querySelectorAll('.bg-destructive').length).toBe(2);
    // Active-step pulse is suppressed when rejected.
    expect(container.querySelectorAll('.animate-pulse').length).toBe(0);
  });
});

describe('StatusTimelineSkeleton', () => {
  it('renders without throwing', () => {
    const { container } = renderInto(<StatusTimelineSkeleton />);
    expect(container.firstElementChild).toBeTruthy();
  });
});
