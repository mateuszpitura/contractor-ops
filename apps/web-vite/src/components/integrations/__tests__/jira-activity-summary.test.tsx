/**
 * Tests target `JiraActivitySummaryView`. Sibling `JiraIssueChip` is rendered
 * for real (it is itself unit-tested) so we can assert the issue key surfaces
 * for each activity item.
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';

import { render, screen } from '@/test/test-utils';
import { JiraActivitySummarySkeleton, JiraActivitySummaryView } from '../jira-activity-summary';

const mockItems = [
  {
    id: 'a-1',
    externalId: 'ENG-42',
    externalUrl: 'https://jira.example.com/browse/ENG-42',
    metadataJson: {
      key: 'ENG-42',
      summary: 'Fix authentication bug',
      status: 'In Progress',
      statusCategory: 'indeterminate' as const,
      url: 'https://jira.example.com/browse/ENG-42',
    },
    updatedAt: new Date(Date.now() - 60_000).toISOString(),
  },
  {
    id: 'a-2',
    externalId: 'API-100',
    externalUrl: 'https://jira.example.com/browse/API-100',
    metadataJson: {
      key: 'API-100',
      summary: 'Improve rate limiting',
      status: 'Done',
      statusCategory: 'done' as const,
      url: 'https://jira.example.com/browse/API-100',
    },
    updatedAt: new Date(Date.now() - 5 * 60_000).toISOString(),
  },
];

interface BuildOpts {
  items?: typeof mockItems;
}

function buildProps(overrides: BuildOpts = {}) {
  const { items = mockItems } = overrides;

  const t = ((key: string): string => {
    const messages: Record<string, string> = {
      title: 'Recent Jira Activity',
    };
    return messages[key] ?? key;
  }) as never;

  const relativeTime = (_dateStr: string) => '1m ago';

  return {
    items,
    relativeTime,
    t,
  } as const;
}

describe('JiraActivitySummaryView', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('JiraActivitySummarySkeleton renders skeleton placeholders', () => {
    const { container } = render(<JiraActivitySummarySkeleton />);
    expect(container.querySelectorAll('[data-slot="skeleton"]').length).toBeGreaterThan(0);
  });

  it('renders the section heading when items exist', () => {
    render(<JiraActivitySummaryView {...buildProps()} />);
    expect(screen.getByText('Recent Jira Activity')).toBeInTheDocument();
  });

  it('renders one row per activity item with the issue key as a link aria-label', () => {
    // BaseUI Tooltip wraps the chip in an `<a>` whose accessible name is the
    // open-in-new-tab aria-label; the literal key text lives in a hidden tooltip
    // pre-mount. Assert against the link's aria-label and href instead.
    render(<JiraActivitySummaryView {...buildProps()} />);
    expect(
      screen.getByRole('link', { name: /Open Jira issue ENG-42 in new tab/ }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('link', { name: /Open Jira issue API-100 in new tab/ }),
    ).toBeInTheDocument();
  });

  it('renders the issue summary as the row label', () => {
    render(<JiraActivitySummaryView {...buildProps()} />);
    expect(screen.getByText('Fix authentication bug')).toBeInTheDocument();
    expect(screen.getByText('Improve rate limiting')).toBeInTheDocument();
  });

  it('renders the relative time for each item', () => {
    render(<JiraActivitySummaryView {...buildProps()} />);
    expect(screen.getAllByText('1m ago').length).toBe(mockItems.length);
  });
});
