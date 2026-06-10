/**
 * Step 4 confirm-import — presentational View + empty/error siblings.
 * tRPC lives in hooks; wired ConfirmImportStep covered via hook tests.
 */

import { afterEach, describe, expect, it, vi } from 'vitest';

import type { RoleBreakdownEntry } from '../hooks/use-onboarding-confirm.js';
import {
  ConfirmImportEmpty,
  ConfirmImportError,
  ConfirmImportStepView,
} from '../confirm-import-step.js';
import { click, findButton, mount } from './_render.js';

afterEach(() => {
  document.body.innerHTML = '';
  vi.clearAllMocks();
});

const roleBreakdown: RoleBreakdownEntry[] = [{ role: 'admin', count: 2 }];

const baseViewProps = {
  peopleToImportCount: 3,
  projectsToImportCount: 1,
  totalSteps: 4,
  roleBreakdown,
  isStarting: false,
  onStartImport: vi.fn(),
};

describe('ConfirmImportStepView (web-vite)', () => {
  it('renders summary cards and start button', async () => {
    const { container } = await mount(<ConfirmImportStepView {...baseViewProps} />);
    expect(container.textContent).toContain('3');
    expect(container.textContent).toContain('4');
    expect(findButton(container, /start import/i)).not.toBeNull();
  });

  it('shows starting label while mutation pending', async () => {
    const { container } = await mount(
      <ConfirmImportStepView {...baseViewProps} isStarting={true} />,
    );
    expect(container.textContent).toMatch(/starting/i);
  });

  it('calls onStartImport when start is clicked', async () => {
    const onStartImport = vi.fn();
    const { container } = await mount(
      <ConfirmImportStepView {...baseViewProps} onStartImport={onStartImport} />,
    );
    const start = findButton(container, /start import/i);
    expect(start).not.toBeNull();
    await click(start as HTMLButtonElement);
    expect(onStartImport).toHaveBeenCalledTimes(1);
  });
});

describe('ConfirmImportEmpty (web-vite)', () => {
  it('renders nothing-to-import copy', async () => {
    const { container } = await mount(<ConfirmImportEmpty />);
    expect(container.textContent).toMatch(/nothing to import|no.*import/i);
  });
});

describe('ConfirmImportError (web-vite)', () => {
  it('renders retry button', async () => {
    const onRetry = vi.fn();
    const { container } = await mount(<ConfirmImportError onRetry={onRetry} />);
    const retry = findButton(container, /retry|try again/i);
    expect(retry).not.toBeNull();
    await click(retry as HTMLButtonElement);
    expect(onRetry).toHaveBeenCalledTimes(1);
  });
});
