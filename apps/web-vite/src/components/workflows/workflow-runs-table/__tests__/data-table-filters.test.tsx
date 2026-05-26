/**
 * Ported from apps/web/src/components/workflows/workflow-runs-table/__tests__/data-table-filters.test.tsx.
 *
 * Web-vite DataTableFilters takes `templates` as a prop instead of fetching
 * them. We exercise badge / clear-all / overdue toggle render branches.
 */

import { afterEach, describe, expect, it, vi } from 'vitest';
import { click, findButton, findByText, mount } from '../../__tests__/_render.js';
import { DataTableFilters } from '../data-table-filters.js';

afterEach(() => {
  document.body.innerHTML = '';
});

const templates = [
  { id: 'tpl-1', name: 'Onboarding' },
  { id: 'tpl-2', name: 'Offboarding' },
];

const emptyFilters = { status: [], templateId: [], overdueOnly: false };

describe('DataTableFilters (workflow runs)', () => {
  it('renders the filter trigger button', async () => {
    await mount(
      <DataTableFilters filters={emptyFilters} onFiltersChange={vi.fn()} templates={templates} />,
    );
    expect(findButton(document.body, /filter/i)).not.toBeNull();
  });

  it('renders the active filter count badge', async () => {
    await mount(
      <DataTableFilters
        filters={{ status: ['IN_PROGRESS', 'BLOCKED'], templateId: [], overdueOnly: false }}
        onFiltersChange={vi.fn()}
        templates={templates}
      />,
    );
    expect(findByText(document.body, '2')).not.toBeNull();
  });

  it('counts overdueOnly in the filter count', async () => {
    await mount(
      <DataTableFilters
        filters={{ status: [], templateId: [], overdueOnly: true }}
        onFiltersChange={vi.fn()}
        templates={templates}
      />,
    );
    expect(findByText(document.body, '1')).not.toBeNull();
  });

  it('renders status badges for active filters', async () => {
    await mount(
      <DataTableFilters
        filters={{ status: ['IN_PROGRESS'], templateId: [], overdueOnly: false }}
        onFiltersChange={vi.fn()}
        templates={templates}
      />,
    );
    expect(findByText(document.body, /in progress/i)).not.toBeNull();
  });

  it('renders template badge with template name', async () => {
    await mount(
      <DataTableFilters
        filters={{ status: [], templateId: ['tpl-1'], overdueOnly: false }}
        onFiltersChange={vi.fn()}
        templates={templates}
      />,
    );
    expect(findByText(document.body, 'Onboarding')).not.toBeNull();
  });

  it('renders the overdue-only badge when enabled', async () => {
    await mount(
      <DataTableFilters
        filters={{ status: [], templateId: [], overdueOnly: true }}
        onFiltersChange={vi.fn()}
        templates={templates}
      />,
    );
    expect(findByText(document.body, /overdue/i)).not.toBeNull();
  });

  it('shows Clear all when filters are active', async () => {
    await mount(
      <DataTableFilters
        filters={{ status: ['IN_PROGRESS'], templateId: [], overdueOnly: false }}
        onFiltersChange={vi.fn()}
        templates={templates}
      />,
    );
    expect(findByText(document.body, /clear all/i)).not.toBeNull();
  });

  it('invokes onFiltersChange when Clear all is clicked', async () => {
    const onFiltersChange = vi.fn();
    await mount(
      <DataTableFilters
        filters={{ status: ['IN_PROGRESS'], templateId: [], overdueOnly: false }}
        onFiltersChange={onFiltersChange}
        templates={templates}
      />,
    );
    const clearBtn = findByText(document.body, /clear all/i);
    await click(clearBtn as HTMLElement);
    expect(onFiltersChange).toHaveBeenCalledWith({
      status: [],
      templateId: [],
      overdueOnly: false,
    });
  });
});
