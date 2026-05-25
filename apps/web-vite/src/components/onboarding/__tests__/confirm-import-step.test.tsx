/**
 * Step 10 port of apps/web/src/components/onboarding/__tests__/confirm-import-step.test.tsx.
 *
 * The web-vite ConfirmImportStep is presentational: it takes already-shaped
 * counts and renders the confirm form. The jobId → progress-tracker branch
 * lives in the container (tested separately).
 */

import { afterEach, describe, expect, it, vi } from 'vitest';

import { ConfirmImportStep } from '../confirm-import-step.js';
import { click, findButton, mount } from './_render.js';

afterEach(() => {
  document.body.innerHTML = '';
  vi.clearAllMocks();
});

const baseProps = {
  peopleToImportCount: 3,
  projectsToImportCount: 2,
  totalSteps: 5,
  roleBreakdown: [
    { role: 'admin', count: 1 },
    { role: 'readonly', count: 2 },
  ],
  isStarting: false,
  canStart: true,
  onStartImport: vi.fn(),
};

describe('ConfirmImportStep (web-vite)', () => {
  it('renders the heading + subtitle from the OnboardingImport.step4 namespace', async () => {
    const { container } = await mount(<ConfirmImportStep {...baseProps} />);
    expect(container.textContent).toContain('Ready to import');
    expect(container.textContent).toContain('Review your selections');
  });

  it('renders the people + projects summary cards with their counts', async () => {
    const { container } = await mount(<ConfirmImportStep {...baseProps} />);
    expect(container.textContent).toContain('People to import');
    expect(container.textContent).toContain('Projects to create');
    expect(container.textContent).toContain('3');
    expect(container.textContent).toContain('2');
    expect(container.textContent).toContain('5 total steps');
  });

  it('renders the role breakdown list when entries are present', async () => {
    const { container } = await mount(<ConfirmImportStep {...baseProps} />);
    expect(container.textContent).toContain('1 x admin');
    expect(container.textContent).toContain('2 x readonly');
  });

  it('omits the role breakdown list when no entries are supplied', async () => {
    const { container } = await mount(<ConfirmImportStep {...baseProps} roleBreakdown={[]} />);
    expect(container.querySelectorAll('ul li').length).toBe(0);
  });

  it('renders the Start Import action button when canStart is true', async () => {
    const { container } = await mount(<ConfirmImportStep {...baseProps} />);
    const btn = findButton(container, 'Start Import');
    expect(btn).not.toBeNull();
    expect(btn?.disabled).toBe(false);
  });

  it('disables the start button while a start is in flight', async () => {
    const { container } = await mount(<ConfirmImportStep {...baseProps} isStarting={true} />);
    const btn = findButton(container, /Starting/);
    expect(btn).not.toBeNull();
    expect(btn?.disabled).toBe(true);
  });

  it('disables the start button when canStart is false', async () => {
    const { container } = await mount(<ConfirmImportStep {...baseProps} canStart={false} />);
    const btn = findButton(container, 'Start Import');
    expect(btn).not.toBeNull();
    expect(btn?.disabled).toBe(true);
  });

  it('invokes onStartImport when the start button is clicked', async () => {
    const onStartImport = vi.fn();
    const { container } = await mount(
      <ConfirmImportStep {...baseProps} onStartImport={onStartImport} />,
    );
    const btn = findButton(container, 'Start Import');
    await click(btn as HTMLButtonElement);
    expect(onStartImport).toHaveBeenCalledTimes(1);
  });
});
