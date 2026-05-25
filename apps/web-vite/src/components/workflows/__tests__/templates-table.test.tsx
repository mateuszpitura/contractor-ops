/**
 * Ported from apps/web/src/components/workflows/__tests__/templates-table.test.tsx.
 *
 * Web-vite split: TemplatesTable takes the full `useTemplatesTable` return
 * value as props. We supply shaped stubs to cover loading, empty, and
 * populated render branches. Wrapped in MemoryRouter because the
 * empty-state CTA renders an internal `<Link>` from i18n/navigation.
 */

import type { ComponentProps, ReactElement } from 'react';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { TemplatesTable } from '../templates-table.js';
import { findByText, mount } from './_render.js';

function withRouter(ui: ReactElement): ReactElement {
  return <MemoryRouter initialEntries={['/en/workflows/templates']}>{ui}</MemoryRouter>;
}

afterEach(() => {
  document.body.innerHTML = '';
});

type Props = ComponentProps<typeof TemplatesTable>;
type TemplateRow = Props['templates'][number];

function makeTemplate(overrides: Partial<TemplateRow> = {}): TemplateRow {
  return {
    id: 't1',
    name: 'Onboarding template',
    type: 'ONBOARDING',
    status: 'ACTIVE',
    updatedAt: new Date('2026-04-15'),
    _count: { tasks: 4, runs: 0 },
    ...overrides,
  } as TemplateRow;
}

const baseHandlers = {
  deleteTarget: null,
  setDeleteTarget: vi.fn(),
  handleActivate: vi.fn(),
  handleArchive: vi.fn(),
  handleDuplicate: vi.fn(),
  handleDelete: vi.fn(),
  handleRowNavigate: vi.fn(),
  isError: false,
  handleRetry: vi.fn(),
};

describe('TemplatesTable (web-vite)', () => {
  it('renders the empty state when no templates are returned', async () => {
    await mount(withRouter(<TemplatesTable {...baseHandlers} templates={[]} isLoading={false} />));
    expect(findByText(document.body, /no.*template/i)).not.toBeNull();
  });

  it('renders skeleton rows while loading', async () => {
    const { container } = await mount(
      withRouter(<TemplatesTable {...baseHandlers} templates={[]} isLoading={true} />),
    );
    expect(container.querySelectorAll("[data-slot='skeleton']").length).toBeGreaterThan(0);
  });

  it('renders one row per template with the name', async () => {
    await mount(
      withRouter(
        <TemplatesTable
          {...baseHandlers}
          templates={[
            makeTemplate({ id: 't1', name: 'Onboarding template' }),
            makeTemplate({ id: 't2', name: 'Offboarding template', type: 'OFFBOARDING' }),
          ]}
          isLoading={false}
        />,
      ),
    );
    expect(findByText(document.body, 'Onboarding template')).not.toBeNull();
    expect(findByText(document.body, 'Offboarding template')).not.toBeNull();
  });

  it('renders the task count cell', async () => {
    await mount(
      withRouter(
        <TemplatesTable
          {...baseHandlers}
          templates={[makeTemplate({ _count: { tasks: 7, runs: 0 } })]}
          isLoading={false}
        />,
      ),
    );
    expect(findByText(document.body, '7')).not.toBeNull();
  });

  it('renders the delete confirmation when deleteTarget is set', async () => {
    await mount(
      withRouter(
        <TemplatesTable
          {...baseHandlers}
          templates={[makeTemplate()]}
          isLoading={false}
          deleteTarget={makeTemplate({ name: 'About to be deleted' })}
        />,
      ),
    );
    expect(findByText(document.body, /about to be deleted/i)).not.toBeNull();
  });
});
