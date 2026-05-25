/**
 * Step 10 port of apps/web/src/components/onboarding/__tests__/import-progress-tracker.test.tsx.
 *
 * The web-vite ImportProgressTracker is presentational — it consumes flags
 * (`isError`, `hasData`, `isComplete`, `isFailed`, `isRunning`,
 * `percentDone`) plus a shaped `progress` object. The tRPC polling lives
 * in the container.
 */

import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { OnboardingProgressData } from '../hooks/use-onboarding-progress.js';
import { ImportProgressTracker } from '../import-progress-tracker.js';
import { click, findButton, mount } from './_render.js';

afterEach(() => {
  document.body.innerHTML = '';
  vi.clearAllMocks();
});

function withRouter(node: React.ReactElement) {
  return (
    <MemoryRouter initialEntries={['/en']}>
      <Routes>
        <Route path="/:locale/*" element={node} />
      </Routes>
    </MemoryRouter>
  );
}

const baseProps = {
  isError: false,
  hasData: true,
  progress: {
    completedItems: 2,
    totalItems: 5,
    failedItems: [],
    status: 'RUNNING',
  } as unknown as OnboardingProgressData,
  isComplete: false,
  isFailed: false,
  isRunning: true,
  percentDone: 40,
  onRefetch: vi.fn(),
  onRetry: vi.fn(),
  isRetrying: false,
};

describe('ImportProgressTracker (web-vite)', () => {
  it('renders the error branch + retry button when isError is true', async () => {
    const onRefetch = vi.fn();
    const { container } = await mount(
      withRouter(<ImportProgressTracker {...baseProps} isError={true} onRefetch={onRefetch} />),
    );
    const retry = findButton(container, /try again/i);
    expect(retry).not.toBeNull();
    await click(retry as HTMLButtonElement);
    expect(onRefetch).toHaveBeenCalledTimes(1);
  });

  it('renders the loading spinner when hasData is false', async () => {
    const { container } = await mount(
      withRouter(<ImportProgressTracker {...baseProps} hasData={false} />),
    );
    expect(container.querySelector('.animate-spin')).not.toBeNull();
  });

  it('renders the progress label + percentage while running', async () => {
    const { container } = await mount(withRouter(<ImportProgressTracker {...baseProps} />));
    expect(container.textContent).toContain('40%');
    // The ICU label format ("Importing {current} of {total}…") may render
    // verbatim or interpolated; either way the digits surface.
    expect(container.textContent).toMatch(/2.*5/);
  });

  it('renders the progressbar with aria values matching the progress shape', async () => {
    const { container } = await mount(withRouter(<ImportProgressTracker {...baseProps} />));
    const bar = container.querySelector('[role="progressbar"]');
    expect(bar).not.toBeNull();
    expect(bar?.getAttribute('aria-valuenow')).toBe('2');
    expect(bar?.getAttribute('aria-valuemax')).toBe('5');
  });

  it('renders the completion card when the import finishes with no failures', async () => {
    const { container } = await mount(
      withRouter(
        <ImportProgressTracker
          {...baseProps}
          isComplete={true}
          progress={
            {
              completedItems: 5,
              totalItems: 5,
              failedItems: [],
              status: 'COMPLETED',
            } as unknown as OnboardingProgressData
          }
          percentDone={100}
        />,
      ),
    );
    expect(container.textContent).toContain('Import complete');
    expect(container.textContent).toContain('Go to Dashboard');
  });

  it('renders failed items and lets the user retry each one', async () => {
    const onRetry = vi.fn();
    const { container } = await mount(
      withRouter(
        <ImportProgressTracker
          {...baseProps}
          isComplete={false}
          isFailed={true}
          progress={
            {
              completedItems: 3,
              totalItems: 5,
              failedItems: [
                { email: 'alice@test.com', error: 'Email already exists' },
                { email: 'bob@test.com', error: 'Invalid role' },
              ],
              status: 'FAILED',
            } as unknown as OnboardingProgressData
          }
          onRetry={onRetry}
        />,
      ),
    );
    expect(container.textContent).toContain('alice@test.com');
    expect(container.textContent).toContain('bob@test.com');
    expect(container.textContent).toContain('Email already exists');

    const retryButtons = Array.from(container.querySelectorAll<HTMLButtonElement>('button')).filter(
      b => (b.textContent ?? '').toLowerCase().includes('retry'),
    );
    expect(retryButtons.length).toBeGreaterThanOrEqual(2);
    await click(retryButtons[0]);
    expect(onRetry).toHaveBeenCalledWith('alice@test.com');
  });

  it('shows the processing row while items remain', async () => {
    const { container } = await mount(withRouter(<ImportProgressTracker {...baseProps} />));
    expect(container.textContent).toContain('Processing');
  });
});
