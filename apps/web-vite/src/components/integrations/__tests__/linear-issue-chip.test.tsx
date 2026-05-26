/**
 * Step 10 port of apps/web/src/components/integrations/__tests__/linear-issue-chip.test.tsx.
 *
 * Prior batches deferred this test because base-ui's tooltip uses the
 * `render` prop pattern (the trigger anchor is composed inside a Radix /
 * base-ui slot), making the rendered DOM brittle to walk. We mirror the
 * legacy approach: stub the shadcn tooltip module so `<TooltipTrigger
 * render={<a ... />}>` collapses to a plain `<a>` we can interrogate
 * directly, and `<TooltipContent>` renders its children inline so the
 * title is visible without simulating a hover.
 */

import { afterEach, describe, expect, it, vi } from 'vitest';

import { findByText, mount } from './_render.js';

vi.mock('@contractor-ops/ui/components/shadcn/tooltip', () => ({
  Tooltip: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  TooltipTrigger: ({
    children,
    render: renderProp,
  }: {
    children?: React.ReactNode;
    render?: React.ReactElement;
  }) => {
    if (renderProp) {
      const { props } = renderProp as React.ReactElement<Record<string, unknown>>;
      return <a {...(props as React.AnchorHTMLAttributes<HTMLAnchorElement>)}>{children}</a>;
    }
    return <div>{children}</div>;
  },
  TooltipContent: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="tooltip-content">{children}</div>
  ),
}));

// Import after vi.mock so the stub is in effect.
const { LinearIssueChip } = await import('../linear-issue-chip.js');

type StatusType = 'triage' | 'backlog' | 'unstarted' | 'started' | 'completed' | 'cancelled';

const baseProps: {
  identifier: string;
  title: string;
  status: string;
  statusType: StatusType;
  url: string;
} = {
  identifier: 'ENG-123',
  title: 'Implement dark mode',
  status: 'In Progress',
  statusType: 'started',
  url: 'https://linear.app/team/ENG-123',
};

afterEach(() => {
  document.body.innerHTML = '';
});

describe('LinearIssueChip (web-vite)', () => {
  it('renders the identifier and status text', async () => {
    const { container } = await mount(<LinearIssueChip {...baseProps} />);
    expect(findByText(container, 'ENG-123')).not.toBeNull();
    expect(findByText(container, 'In Progress')).not.toBeNull();
  });

  it('renders an anchor with the issue url and a new-tab rel/target', async () => {
    const { container } = await mount(<LinearIssueChip {...baseProps} />);
    const link = container.querySelector('a');
    expect(link).not.toBeNull();
    expect(link?.getAttribute('href')).toBe('https://linear.app/team/ENG-123');
    expect(link?.getAttribute('target')).toBe('_blank');
    expect(link?.getAttribute('rel')).toBe('noopener noreferrer');
    expect(link?.getAttribute('aria-label')).toBe('Open Linear issue ENG-123 in new tab');
  });

  it('renders the issue title in the tooltip content slot', async () => {
    const { container } = await mount(<LinearIssueChip {...baseProps} />);
    const tooltip = container.querySelector('[data-testid="tooltip-content"]');
    expect(tooltip?.textContent ?? '').toContain('Implement dark mode');
  });

  it('applies a custom className to the trigger anchor', async () => {
    const { container } = await mount(<LinearIssueChip {...baseProps} className="extra-marker" />);
    const link = container.querySelector('a');
    expect(link?.className ?? '').toContain('extra-marker');
  });

  it('maps statusType to the correct dot color', async () => {
    const cases: [StatusType, string][] = [
      ['started', 'bg-info'],
      ['completed', 'bg-success'],
      ['cancelled', 'bg-destructive'],
      ['backlog', 'bg-muted-foreground'],
    ];
    for (const [statusType, expectedClass] of cases) {
      const { container, unmount } = await mount(
        <LinearIssueChip {...baseProps} statusType={statusType} />,
      );
      const dot = container.querySelector('.rounded-full');
      expect(dot?.className ?? '').toContain(expectedClass);
      unmount();
    }
  });
});
