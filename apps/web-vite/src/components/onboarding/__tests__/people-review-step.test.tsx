/**
 * Step 10 port of apps/web/src/components/onboarding/__tests__/people-review-step.test.tsx.
 *
 * The web-vite PeopleReviewStep is presentational — it consumes already-shaped
 * `filteredPeople`, `counts`, `personSelections`, etc. and exposes callbacks
 * for every interaction. We focus on the visible top-level UI (header,
 * summary chip, empty/loading/error states) rather than the full table
 * combinatorics (those live in dedicated row tests).
 */

import { afterEach, describe, expect, it, vi } from 'vitest';
import type { PersonSelection } from '../import-wizard.js';
import type { PeopleReviewStepProps } from '../people-review-step.js';
import { PeopleReviewEmpty, PeopleReviewError, PeopleReviewStep } from '../people-review-step.js';
import { click, findButton, mount } from './_render.js';

afterEach(() => {
  document.body.innerHTML = '';
  vi.clearAllMocks();
});

const baseCounts = { new: 2, conflict: 1, exists: 1, total: 4 };

const samplePeople = [
  {
    email: 'alice@test.com',
    name: 'Alice',
    status: 'new' as const,
    sources: [{ source: 'JIRA', value: 'Alice' }],
    conflicts: [],
  },
  {
    email: 'bob@test.com',
    name: 'Bob',
    status: 'exists' as const,
    sources: [{ source: 'SLACK', value: 'Bob' }],
    conflicts: [],
  },
];

const baseSelections = new Map<string, PersonSelection>([
  ['alice@test.com', { role: 'readonly', skip: false, resolvedConflicts: {} }],
  ['bob@test.com', { role: 'readonly', skip: false, resolvedConflicts: {} }],
]);

function baseProps(): PeopleReviewStepProps {
  return {
    filteredPeople: samplePeople,
    counts: baseCounts,
    activeFilter: 'all',
    setActiveFilter: vi.fn(),
    personSelections: baseSelections,
    checkedEmails: new Set<string>(),
    allSelected: false,
    someSelected: false,
    onSelectAll: vi.fn(),
    onRowCheck: vi.fn(),
    onSkipRow: vi.fn(),
    onRoleChange: vi.fn(),
    onResolveConflict: vi.fn(),
    onBatchImport: vi.fn(),
    onBatchSkip: vi.fn(),
    onBatchRole: vi.fn(),
  } as unknown as PeopleReviewStepProps;
}

describe('PeopleReviewStep (web-vite)', () => {
  it('renders the heading + summary chips with provided counts', async () => {
    const { container } = await mount(<PeopleReviewStep {...baseProps()} />);
    expect(container.textContent).toContain('Review team members');
    // Numbers from baseCounts show up in the summary chip.
    expect(container.textContent).toContain('2');
    expect(container.textContent).toContain('1');
    expect(container.textContent).toContain('4');
  });

  it('renders one body row per filtered person', async () => {
    const { container } = await mount(<PeopleReviewStep {...baseProps()} />);
    expect(container.textContent).toContain('Alice');
    expect(container.textContent).toContain('Bob');
    const bodyRows = container.querySelectorAll('tbody tr');
    expect(bodyRows.length).toBe(2);
  });

  it('renders the error sibling with retry button', async () => {
    const onRefetch = vi.fn();
    const { container } = await mount(<PeopleReviewError onRefetch={onRefetch} />);
    const retry = findButton(container, /try again/i);
    expect(retry).not.toBeNull();
    await click(retry as HTMLButtonElement);
    expect(onRefetch).toHaveBeenCalledTimes(1);
  });

  it('renders the empty sibling', async () => {
    const { container } = await mount(<PeopleReviewEmpty />);
    expect(container.textContent).toContain('No team members found');
  });

  it('renders the batch-action bar only when emails are checked', async () => {
    const { container: empty } = await mount(<PeopleReviewStep {...baseProps()} />);
    expect(empty.textContent).not.toContain('Import Selected');

    const { container } = await mount(
      <PeopleReviewStep {...baseProps()} checkedEmails={new Set(['alice@test.com'])} />,
    );
    expect(container.textContent).toContain('Import Selected');
    expect(container.textContent).toContain('Skip Selected');
  });

  it('invokes onBatchImport when the batch import button is clicked', async () => {
    const onBatchImport = vi.fn();
    const { container } = await mount(
      <PeopleReviewStep
        {...baseProps()}
        checkedEmails={new Set(['alice@test.com'])}
        onBatchImport={onBatchImport}
      />,
    );
    const btn = findButton(container, 'Import Selected');
    expect(btn).not.toBeNull();
    await click(btn as HTMLButtonElement);
    expect(onBatchImport).toHaveBeenCalledTimes(1);
  });
});
