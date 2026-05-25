/**
 * Ported from apps/web/src/components/workflows/__tests__/my-tasks-list.test.tsx.
 *
 * Web-vite MyTasksList is presentational (props bag from useMyTasksList).
 * Legacy mocked tRPC + useQuery — here we feed the props directly.
 */

import { MemoryRouter } from 'react-router-dom';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { MyTasksList } from '../my-tasks-list.js';
import { click, findByText, mount } from './_render.js';

afterEach(() => {
  document.body.innerHTML = '';
  vi.clearAllMocks();
});

const baseProps = {
  isLoading: false,
  isError: false,
  handleRetry: vi.fn(),
  overdueOnly: false,
  setOverdueOnly: vi.fn(),
};

const sampleTasks = [
  {
    id: 't1',
    title: 'Collect NDA',
    status: 'TODO',
    taskType: 'DOCUMENT_COLLECTION',
    dueAt: '2026-04-10',
    isOverdue: false,
    workflowRun: {
      id: 'run-1',
      status: 'IN_PROGRESS',
      contractor: { id: 'c1', legalName: 'Acme sp. z o.o.', displayName: 'Acme' },
      workflowTemplate: { name: 'Onboarding', type: 'ONBOARDING' },
    },
  },
  {
    id: 't2',
    title: 'Setup VPN',
    status: 'IN_PROGRESS',
    taskType: 'ACCESS_GRANT',
    dueAt: '2026-04-01',
    isOverdue: true,
    workflowRun: {
      id: 'run-2',
      status: 'IN_PROGRESS',
      contractor: { id: 'c2', legalName: 'Beta LLC', displayName: null },
      workflowTemplate: { name: 'IT Setup', type: 'CUSTOM' },
    },
  },
];

function withRouter(node: React.ReactElement, initial = '/en/workflows'): React.ReactElement {
  // The `<Link>` helper reads `:locale` from useParams; the memory router below
  // matches `/:locale/*` so the prefix derivation matches production behaviour.
  return <MemoryRouter initialEntries={[initial]}>{node}</MemoryRouter>;
}

describe('MyTasksList (web-vite)', () => {
  it('renders skeleton placeholders when loading', async () => {
    const { container } = await mount(
      withRouter(<MyTasksList {...baseProps} tasks={[]} isLoading />),
    );
    // Skeleton primitive renders an element with `data-slot="skeleton"`.
    expect(container.querySelectorAll("[data-slot='skeleton']").length).toBeGreaterThan(0);
  });

  it('renders the empty state when there are no tasks and overdue-only is off', async () => {
    await mount(withRouter(<MyTasksList {...baseProps} tasks={[]} />));
    expect(findByText(document.body, 'No tasks assigned to you')).not.toBeNull();
  });

  it('renders the error heading + retry CTA when isError', async () => {
    const handleRetry = vi.fn();
    await mount(
      withRouter(<MyTasksList {...baseProps} tasks={[]} isError handleRetry={handleRetry} />),
    );
    expect(
      findByText(document.body, 'Could not load workflows. Check your connection and try again.'),
    ).not.toBeNull();
    const retry = Array.from(document.body.querySelectorAll('button')).find(
      b => (b.textContent ?? '').trim() === 'Try again',
    );
    expect(retry).toBeTruthy();
    await click(retry as HTMLButtonElement);
    expect(handleRetry).toHaveBeenCalledTimes(1);
  });

  it('renders task titles and contractor labels', async () => {
    await mount(withRouter(<MyTasksList {...baseProps} tasks={sampleTasks} />));
    expect(findByText(document.body, 'Collect NDA')).not.toBeNull();
    expect(findByText(document.body, 'Setup VPN')).not.toBeNull();
    // displayName falls back to legalName for the second contractor.
    expect(findByText(document.body, /Acme/)).not.toBeNull();
    expect(findByText(document.body, /Beta LLC/)).not.toBeNull();
  });

  it('links each task card to its workflow run', async () => {
    await mount(withRouter(<MyTasksList {...baseProps} tasks={sampleTasks} />));
    const links = document.body.querySelectorAll('a');
    expect(links.length).toBeGreaterThanOrEqual(2);
    const hrefs = Array.from(links).map(a => a.getAttribute('href') ?? '');
    // Locale prefix is derived from `useParams<{locale}>()`; outside a matched
    // Route the helper falls back to `DEFAULT_LOCALE`, so just assert the
    // workflow-run suffix is correct.
    expect(hrefs.some(h => h.endsWith('/workflows/run-1'))).toBe(true);
    expect(hrefs.some(h => h.endsWith('/workflows/run-2'))).toBe(true);
  });

  it('renders the overdue-only switch toggle', async () => {
    await mount(withRouter(<MyTasksList {...baseProps} tasks={sampleTasks} />));
    expect(findByText(document.body, 'Overdue only')).not.toBeNull();
  });
});
