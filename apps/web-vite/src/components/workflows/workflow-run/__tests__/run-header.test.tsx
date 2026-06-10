/**
 * RunHeader takes the `useRunHeader` bag merged with the shaped `run` object.
 * We mock `useDateFormatter` to avoid the tRPC org settings call and wrap in
 * MemoryRouter for the contractor/template Link.
 */

import type { ReactElement } from 'react';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, describe, expect, it, vi } from 'vitest';

vi.mock('../../../../lib/format/use-date-formatter.js', () => ({
  useDateFormatter: () => ({
    formatDate: (v: unknown) => (typeof v === 'string' ? v : ''),
    formatTime: (v: unknown) => (typeof v === 'string' ? v : ''),
    formatDateTime: (v: unknown) => (typeof v === 'string' ? v : ''),
  }),
}));

import { findByText, mount } from '../../__tests__/_render.js';
import type { RunHeaderRun } from '../../hooks/use-run-header.js';
import { RunHeaderView } from '../run-header.js';

afterEach(() => {
  document.body.innerHTML = '';
});

function withRouter(ui: ReactElement): ReactElement {
  return <MemoryRouter initialEntries={['/en/workflows/run-1']}>{ui}</MemoryRouter>;
}

const sampleRun: RunHeaderRun = {
  id: 'run-1',
  status: 'IN_PROGRESS',
  startedAt: '2026-04-01',
  dueAt: '2026-12-01',
  startedByUserId: 'u-jane',
  workflowTemplate: { id: 'tpl-1', name: 'Onboarding', type: 'ONBOARDING' },
  contractor: { id: 'c1', legalName: 'Acme sp. z o.o.', displayName: 'Acme' },
  tasks: [
    { status: 'DONE', resultJson: null, isOverdue: false, taskType: 'MANUAL' },
    { status: 'IN_PROGRESS', resultJson: null, isOverdue: false, taskType: 'MANUAL' },
  ],
};

type Props = Parameters<typeof RunHeaderView>[0];

function makeHeader(overrides: Partial<Omit<Props, 'run'>> = {}): Omit<Props, 'run'> {
  const merged = {
    progress: { done: 1, total: 2, percent: 50 },
    isOverdue: false,
    showOverride: false,
    canCancel: true,
    cancelOpen: false,
    setCancelOpen: vi.fn(),
    overrideOpen: false,
    setOverrideOpen: vi.fn(),
    cancelMutation: { isPending: false } as Props['cancelMutation'],
    overrideMutation: { isPending: false } as Props['overrideMutation'],
    handleCancel: vi.fn(),
    handleOverride: vi.fn(),
    ...overrides,
  };
  return {
    ...merged,
    showActions: merged.canCancel || merged.showOverride,
  };
}

describe('RunHeader (web-vite)', () => {
  it('renders the workflow template name as the heading', async () => {
    await mount(withRouter(<RunHeaderView run={sampleRun} {...makeHeader()} />));
    expect(findByText(document.body, 'Onboarding')).not.toBeNull();
  });

  it('renders the contractor display name link', async () => {
    await mount(withRouter(<RunHeaderView run={sampleRun} {...makeHeader()} />));
    const links = Array.from(document.body.querySelectorAll('a'));
    expect(links.some(a => (a.textContent ?? '').includes('Acme'))).toBe(true);
  });

  it('renders the actions trigger when canCancel is true', async () => {
    await mount(withRouter(<RunHeaderView run={sampleRun} {...makeHeader({ canCancel: true })} />));
    const buttons = Array.from(document.body.querySelectorAll('button'));
    expect(buttons.length).toBeGreaterThan(0);
  });

  it('hides the actions trigger when neither canCancel nor showOverride', async () => {
    await mount(
      withRouter(
        <RunHeaderView run={sampleRun} {...makeHeader({ canCancel: false, showOverride: false })} />,
      ),
    );
    // Only the progress + template chrome render — no overflow dropdown.
    const triggers = Array.from(document.body.querySelectorAll('button')).filter(
      b => (b.textContent ?? '').trim() === '',
    );
    expect(triggers.length).toBe(0);
  });

  it('renders the cancel confirmation when cancelOpen is true', async () => {
    await mount(withRouter(<RunHeaderView run={sampleRun} {...makeHeader({ cancelOpen: true })} />));
    // Workflows.cancelWorkflowTitle copy
    expect(document.body.textContent).toMatch(/cancel/i);
  });

  it('renders the workflow template link to /workflows/templates/:id', async () => {
    await mount(withRouter(<RunHeaderView run={sampleRun} {...makeHeader()} />));
    const links = Array.from(document.body.querySelectorAll('a'));
    expect(links.some(a => a.getAttribute('href')?.includes('/workflows/templates/tpl-1'))).toBe(
      true,
    );
  });
});
