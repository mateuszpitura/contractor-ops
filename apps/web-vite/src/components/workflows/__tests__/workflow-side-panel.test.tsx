/**
 * WorkflowSidePanelView is presentational. We pass a shaped
 * `run` object plus loading/error stubs. The Jira/Linear linked-issues
 * containers are mocked because they have their own tRPC dependencies.
 */

import type { ReactElement } from 'react';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, describe, expect, it, vi } from 'vitest';

vi.mock('../workflow-side-panel-linked-jira-container.js', () => ({
  LinkedJiraIssuesSection: () => null,
}));
vi.mock('../workflow-side-panel-linked-linear-container.js', () => ({
  LinkedLinearIssuesSection: () => null,
}));

import { WorkflowSidePanelView } from '../workflow-side-panel.js';
import { findButton, findByText, mount } from './_render.js';

function withRouter(ui: ReactElement): ReactElement {
  return <MemoryRouter initialEntries={['/en/workflows']}>{ui}</MemoryRouter>;
}

afterEach(() => {
  document.body.innerHTML = '';
});

const sampleRun = {
  id: 'run-1',
  status: 'IN_PROGRESS',
  startedAt: '2026-04-10T00:00:00Z',
  workflowTemplate: { name: 'Onboarding' },
  contractor: {
    id: 'c1',
    displayName: 'Acme',
    legalName: 'Acme sp. z o.o.',
  },
  tasks: [
    { status: 'DONE', isOverdue: false },
    { status: 'IN_PROGRESS', isOverdue: false },
    { status: 'NOT_STARTED', isOverdue: true },
  ],
};

describe('WorkflowSidePanelView (web-vite)', () => {
  it('renders the workflow template title when run is populated', async () => {
    await mount(
      withRouter(
        <WorkflowSidePanelView
          runId="run-1"
          run={sampleRun}
          isLoading={false}
          isError={false}
          handleRetry={vi.fn()}
          onClose={vi.fn()}
        />,
      ),
    );
    expect(findByText(document.body, 'Onboarding')).not.toBeNull();
  });

  it('renders skeleton placeholders while loading', async () => {
    await mount(
      withRouter(
        <WorkflowSidePanelView
          runId="run-1"
          run={undefined}
          isLoading={true}
          isError={false}
          handleRetry={vi.fn()}
          onClose={vi.fn()}
        />,
      ),
    );
    expect(document.body.querySelectorAll("[data-slot='skeleton']").length).toBeGreaterThan(0);
  });

  it('renders the error heading and retry CTA when isError', async () => {
    const handleRetry = vi.fn();
    await mount(
      withRouter(
        <WorkflowSidePanelView
          runId="run-1"
          run={undefined}
          isLoading={false}
          isError={true}
          handleRetry={handleRetry}
          onClose={vi.fn()}
        />,
      ),
    );
    const retry = findButton(document.body, /retry|try again/i);
    expect(retry).not.toBeNull();
  });

  it('renders the contractor display name', async () => {
    await mount(
      withRouter(
        <WorkflowSidePanelView
          runId="run-1"
          run={sampleRun}
          isLoading={false}
          isError={false}
          handleRetry={vi.fn()}
          onClose={vi.fn()}
        />,
      ),
    );
    expect(findByText(document.body, 'Acme')).not.toBeNull();
  });

  it('renders the open workflow CTA linking to the run', async () => {
    await mount(
      withRouter(
        <WorkflowSidePanelView
          runId="run-1"
          run={sampleRun}
          isLoading={false}
          isError={false}
          handleRetry={vi.fn()}
          onClose={vi.fn()}
        />,
      ),
    );
    const anchors = Array.from(document.body.querySelectorAll('a'));
    expect(anchors.some(a => a.getAttribute('href')?.endsWith('/workflows/run-1'))).toBe(true);
  });

  it('renders nothing visible when runId is null', async () => {
    await mount(
      withRouter(
        <WorkflowSidePanelView
          runId={null}
          run={undefined}
          isLoading={false}
          isError={false}
          handleRetry={vi.fn()}
          onClose={vi.fn()}
        />,
      ),
    );
    // Sheet closes when open is false; no template name should appear.
    expect(findByText(document.body, 'Onboarding')).toBeNull();
  });
});
