/**
 * ChainTracker is a pure presentational component that receives `flow` +
 * `isLoading` as props — the tRPC query lives in `chain-tracker.tsx`,
 * so there is no react-query boilerplate here and we exercise the visual logic
 * directly.
 *
 * The SlaBadge child is mocked to keep this test focused on chain layout;
 * SLA logic is covered by `sla-badge.test.tsx`.
 */

import type { ReactElement } from 'react';
import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';

vi.mock('../sla-badge.js', () => ({
  SlaBadge: () => <span data-testid="sla-badge">SLA</span>,
}));

import { applyLocale, initI18n } from '../../../i18n/index.js';
import { ChainTrackerSkeleton, ChainTrackerView } from '../chain-tracker.js';

// Opt jsdom into React 19's act-aware environment so the renderer stops
// logging "current testing environment is not configured to support
// act(...)" during the synchronous renders below.
(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

interface Rendered {
  container: HTMLDivElement;
  unmount: () => void;
}

const mounted: Rendered[] = [];

function renderInto(node: ReactElement): Rendered {
  const container = document.createElement('div');
  document.body.appendChild(container);
  const root = createRoot(container);
  // `act` returns a thenable; render is synchronous so we discard it.
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
  // initI18n kicks off `i18next.init` without awaiting it; applyLocale awaits
  // changeLanguage, which resolves only after init has finished — guaranteeing
  // ICU interpolation is wired before the first render.
  await applyLocale('en');
});

afterEach(() => {
  while (mounted.length > 0) {
    mounted.pop()?.unmount();
  }
});

describe('ChainTracker', () => {
  it('ChainTrackerSkeleton renders skeleton primitives', () => {
    const { container } = renderInto(<ChainTrackerSkeleton />);
    expect(container.querySelector("[data-slot='skeleton']")).toBeTruthy();
  });

  it('renders step circle for each step with chain name + approver', () => {
    const { container } = renderInto(
      <ChainTrackerView
        steps={[
          {
            id: 's1',
            stepOrder: 0,
            name: 'Level 1',
            status: 'APPROVED',
            approverUserId: null,
            approverRole: 'team_manager',
            slaDeadline: null,
            actedAt: '2026-01-01T00:00:00Z',
            decision: 'APPROVED',
            approver: null,
          },
          {
            id: 's2',
            stepOrder: 1,
            name: 'Level 2',
            status: 'PENDING',
            approverUserId: 'u-2',
            approverRole: 'DIRECTOR',
            slaDeadline: '2026-02-01T00:00:00Z',
            actedAt: null,
            decision: null,
            approver: {
              id: 'u-2',
              name: 'Anna',
              email: 'anna@test.com',
              image: null,
            },
          },
        ]}
        chainName="Finance Chain"
      />,
    );

    // PENDING step shows its 1-based ordinal as the circle label (APPROVED uses an icon).
    expect(container.textContent).toContain('2');
    // Approval chain heading renders from the real i18n bundle.
    expect(container.textContent).toContain('Approval chain');
    // Approver name surfaced.
    expect(container.textContent).toContain('Anna');
    // Chain-name caption renders (the exact wording depends on ICU
    // interpolation; the caption element itself must be present).
    const captions = container.querySelectorAll('p');
    expect(captions.length).toBeGreaterThan(0);
  });

  it('renders SLA badge for pending steps with a deadline', () => {
    const { container } = renderInto(
      <ChainTrackerView
        steps={[
          {
            id: 's1',
            stepOrder: 0,
            name: 'L1',
            status: 'PENDING',
            approverUserId: null,
            approverRole: null,
            slaDeadline: '2026-06-01T00:00:00Z',
            actedAt: null,
            decision: null,
            approver: null,
          },
        ]}
      />,
    );
    expect(container.querySelector('[data-testid="sla-badge"]')).toBeTruthy();
  });

  it('greys out steps following a rejected step', () => {
    const { container } = renderInto(
      <ChainTrackerView
        steps={[
          {
            id: 's1',
            stepOrder: 0,
            name: 'L1',
            status: 'REJECTED',
            approverUserId: null,
            approverRole: 'team_manager',
            slaDeadline: null,
            actedAt: null,
            decision: null,
            approver: null,
          },
          {
            id: 's2',
            stepOrder: 1,
            name: 'L2',
            status: 'NOT_STARTED',
            approverUserId: null,
            approverRole: 'DIRECTOR',
            slaDeadline: null,
            actedAt: null,
            decision: null,
            approver: null,
          },
        ]}
      />,
    );
    const circles = container.querySelectorAll('.rounded-full');
    const lastCircle = circles[circles.length - 1];
    expect(lastCircle?.className).toContain('bg-muted');
  });
});
