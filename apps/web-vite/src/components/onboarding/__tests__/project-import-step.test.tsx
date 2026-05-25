/**
 * Step 10 port of apps/web/src/components/onboarding/__tests__/project-import-step.test.tsx.
 *
 * The web-vite ProjectImportStep is presentational — `projects`,
 * `getProjectKey`, `getSelectionFor`, `onSelectionChange` are passed in
 * directly. We pin the heading, empty-state, error, and per-card
 * "Skip this project" wiring; deeper step-editing combinatorics belong
 * to the ProjectCard's own tests if/when extracted.
 */

import type { FetchProjectsOutput } from '@contractor-ops/validators';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { ProjectSelection } from '../import-wizard.js';
import {
  ProjectImportEmpty,
  ProjectImportError,
  ProjectImportStep,
} from '../project-import-step.js';
import { click, findButton, mount } from './_render.js';

afterEach(() => {
  document.body.innerHTML = '';
  vi.clearAllMocks();
});

const sampleProjects: FetchProjectsOutput = [
  {
    sourceProvider: 'JIRA',
    externalId: 'p1',
    name: 'Project A',
    statuses: [
      { id: 'todo', name: 'Todo' },
      { id: 'done', name: 'Done' },
    ],
  },
  {
    sourceProvider: 'LINEAR',
    externalId: 'p2',
    name: 'Project B',
    statuses: [{ id: 'open', name: 'Open' }],
  },
];

function makeProps(overrides: Partial<React.ComponentProps<typeof ProjectImportStep>> = {}) {
  const selectionsByKey = new Map<string, ProjectSelection>([
    [
      'JIRA-p1',
      {
        skip: false,
        name: 'Project A',
        steps: [
          { name: 'Todo', sortOrder: 0 },
          { name: 'Done', sortOrder: 1 },
        ],
      },
    ],
    ['LINEAR-p2', { skip: false, name: 'Project B', steps: [{ name: 'Open', sortOrder: 0 }] }],
  ]);

  return {
    projects: sampleProjects,
    getProjectKey: (p: FetchProjectsOutput[number]) => `${p.sourceProvider}-${p.externalId}`,
    getSelectionFor: (p: FetchProjectsOutput[number]) =>
      selectionsByKey.get(`${p.sourceProvider}-${p.externalId}`) ?? {
        skip: false,
        name: p.name,
        steps: [],
      },
    onSelectionChange: vi.fn(),
    ...overrides,
  };
}

describe('ProjectImportStep (web-vite)', () => {
  it('renders the heading + sync note when projects are present', async () => {
    const { container } = await mount(<ProjectImportStep {...makeProps()} />);
    expect(container.textContent).toContain('Import projects');
    expect(container.textContent).toContain('Bidirectional sync');
  });

  it('renders one ProjectCard per project, with the editable name input populated', async () => {
    const { container } = await mount(<ProjectImportStep {...makeProps()} />);
    const inputs = Array.from(container.querySelectorAll<HTMLInputElement>('input'));
    // Each card has a project-name input at minimum.
    expect(inputs.length).toBeGreaterThanOrEqual(2);
    const values = inputs.map(i => i.value);
    expect(values).toContain('Project A');
    expect(values).toContain('Project B');
  });

  it('renders the chip preview for each project status when collapsed', async () => {
    const { container } = await mount(<ProjectImportStep {...makeProps()} />);
    expect(container.textContent).toContain('Todo');
    expect(container.textContent).toContain('Done');
    expect(container.textContent).toContain('Open');
  });

  it('renders the empty sibling', async () => {
    const { container } = await mount(<ProjectImportEmpty />);
    expect(container.textContent).toContain('No projects found');
  });

  it('renders the error sibling with retry button', async () => {
    const onRefetch = vi.fn();
    const { container } = await mount(<ProjectImportError onRefetch={onRefetch} />);
    const retry = findButton(container, /try again/i);
    expect(retry).not.toBeNull();
    await click(retry as HTMLButtonElement);
    expect(onRefetch).toHaveBeenCalledTimes(1);
  });

  it('invokes onSelectionChange when a project Skip button is clicked', async () => {
    const onSelectionChange = vi.fn();
    const { container } = await mount(<ProjectImportStep {...makeProps({ onSelectionChange })} />);
    const skipBtn = Array.from(container.querySelectorAll<HTMLButtonElement>('button')).find(b =>
      (b.textContent ?? '').includes('Skip this project'),
    );
    expect(skipBtn).toBeDefined();
    await click(skipBtn as HTMLButtonElement);
    expect(onSelectionChange).toHaveBeenCalled();
    const [key, sel] = onSelectionChange.mock.calls[0];
    expect(typeof key).toBe('string');
    expect(sel.skip).toBe(true);
  });
});
