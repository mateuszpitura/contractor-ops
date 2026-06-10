/**
 * AuditTimeline is presentational — `events` + `isLoading` come in via
 * props (the tRPC query lives in `audit-timeline.tsx`).
 * Translation keys resolve against the real English bundle, so assertions
 * are against English strings ("Audit trail", "No activity yet", …).
 */

import type { ReactElement } from 'react';
import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { afterEach, beforeAll, describe, expect, it } from 'vitest';

import { applyLocale, initI18n } from '../../../i18n/index.js';
import { AuditTimelineView, AuditTimelineSkeleton } from '../audit-timeline.js';

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

describe('AuditTimeline (web-vite)', () => {
  it('AuditTimelineSkeleton renders a skeleton card without heading copy', () => {
    const { container } = renderInto(<AuditTimelineSkeleton />);
    expect(container.querySelector("[data-slot='skeleton']")).not.toBeNull();
    // Heading + body are absent in the skeleton sibling.
    expect(container.textContent).not.toContain('Audit trail');
  });

  it('renders the heading + empty copy when there are no events', () => {
    const { container } = renderInto(<AuditTimelineView events={[]} />);
    expect(container.textContent).toContain('Audit trail');
    expect(container.textContent).toContain('No activity yet');
  });

  it('renders a system entry with the submitted label', () => {
    const { container } = renderInto(
      <AuditTimelineView
        events={[
          {
            type: 'system',
            label: 'submitted',
            timestamp: new Date(Date.now() - 60_000).toISOString(),
          },
        ]}
      />,
    );
    expect(container.textContent).toContain('Submitted for approval');
  });

  it('renders a routed system entry with the chain name interpolated', () => {
    const { container } = renderInto(
      <AuditTimelineView
        events={[
          {
            type: 'system',
            label: 'routed',
            timestamp: new Date(Date.now() - 120_000).toISOString(),
            chainName: 'Finance Chain',
          },
        ]}
      />,
    );
    expect(container.textContent).toContain('Finance Chain');
  });

  it('renders a decision entry with the actor + approved badge', () => {
    const { container } = renderInto(
      <AuditTimelineView
        events={[
          {
            type: 'decision',
            label: 'approve',
            timestamp: new Date(Date.now() - 180_000).toISOString(),
            actor: { id: 'u1', name: 'Alice', email: 'alice@test.com', image: null },
            comment: 'Looks good',
          },
        ]}
      />,
    );
    expect(container.textContent).toContain('Alice');
    expect(container.textContent).toContain('Approved');
    expect(container.textContent).toContain('Looks good');
  });

  it('renders a rejected decision badge', () => {
    const { container } = renderInto(
      <AuditTimelineView
        events={[
          {
            type: 'decision',
            label: 'reject',
            timestamp: new Date(Date.now() - 240_000).toISOString(),
            actor: { id: 'u2', name: 'Bob', email: 'bob@test.com', image: null },
          },
        ]}
      />,
    );
    expect(container.textContent).toContain('Bob');
    expect(container.textContent).toContain('Rejected');
  });

  it('renders multiple events in document order', () => {
    const { container } = renderInto(
      <AuditTimelineView
        events={[
          {
            type: 'system',
            label: 'submitted',
            timestamp: new Date(Date.now() - 60_000).toISOString(),
          },
          {
            type: 'decision',
            label: 'approve',
            timestamp: new Date(Date.now() - 30_000).toISOString(),
            actor: { id: 'u1', name: 'Alice', email: 'alice@test.com', image: null },
          },
        ]}
      />,
    );
    const text = container.textContent ?? '';
    expect(text.indexOf('Submitted for approval')).toBeGreaterThan(-1);
    expect(text.indexOf('Alice')).toBeGreaterThan(-1);
    expect(text.indexOf('Submitted for approval')).toBeLessThan(text.indexOf('Alice'));
  });
});
