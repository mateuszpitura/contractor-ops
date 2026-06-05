/**
 * TrialBanner is presentational — visibility window is computed from
 * `Date.now()` so we need a deterministic clock. We mock `Date.now` directly
 * (rather than vi.useFakeTimers) so async i18n bootstrap inside `mount()`
 * isn't starved of its setTimeout-driven init path.
 */

import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

import { applyLocale, initI18n } from '../../../i18n/index.js';
import { TrialBanner } from '../trial-banner.js';
import { click, findButton, findByText, mount } from './_render.js';

const NOW = new Date('2026-04-02T12:00:00Z').getTime();

function trialEndInDays(days: number): Date {
  return new Date(NOW + days * 24 * 60 * 60 * 1000);
}

beforeAll(async () => {
  // Boot i18n before any test pins Date.now() so the bundle Promise resolves.
  initI18n();
  await applyLocale('en');
});

describe('TrialBanner (web-vite)', () => {
  let dateNowSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    dateNowSpy = vi.spyOn(Date, 'now').mockReturnValue(NOW);
  });

  afterEach(() => {
    dateNowSpy.mockRestore();
    document.body.innerHTML = '';
    vi.clearAllMocks();
  });

  it('renders nothing when the trial ends in more than 7 days', async () => {
    const { container } = await mount(
      <TrialBanner trialEnd={trialEndInDays(10)} onUpgrade={vi.fn()} />,
    );
    expect(container.innerHTML).toBe('');
  });

  it('renders nothing when the trial has expired (negative days)', async () => {
    const { container } = await mount(
      <TrialBanner trialEnd={trialEndInDays(-1)} onUpgrade={vi.fn()} />,
    );
    expect(container.innerHTML).toBe('');
  });

  it('shows the 7-day message when exactly 7 days remain', async () => {
    await mount(<TrialBanner trialEnd={trialEndInDays(7)} onUpgrade={vi.fn()} />);
    expect(
      findByText(
        document.body,
        'Your trial ends in 7 days. Upgrade to keep your data and full access.',
      ),
    ).not.toBeNull();
  });

  it('shows the 1-day "tomorrow" message when 1 day remains', async () => {
    await mount(<TrialBanner trialEnd={trialEndInDays(1)} onUpgrade={vi.fn()} />);
    expect(findByText(document.body, /Your trial ends tomorrow/)).not.toBeNull();
  });

  it('renders alert role and aria-live polite for assistive tech (a11y)', async () => {
    const { container } = await mount(
      <TrialBanner trialEnd={trialEndInDays(5)} onUpgrade={vi.fn()} />,
    );
    const alert = container.querySelector('[role="alert"]');
    expect(alert).not.toBeNull();
    expect(alert?.getAttribute('aria-live')).toBe('polite');
  });

  it('invokes onUpgrade when the Choose a plan button is clicked', async () => {
    const onUpgrade = vi.fn();
    await mount(<TrialBanner trialEnd={trialEndInDays(5)} onUpgrade={onUpgrade} />);
    const btn = findButton(document.body, 'Choose a plan');
    expect(btn).not.toBeNull();
    await click(btn as HTMLButtonElement);
    expect(onUpgrade).toHaveBeenCalledTimes(1);
  });

  it('removes the banner when the dismiss button is clicked', async () => {
    const { container } = await mount(
      <TrialBanner trialEnd={trialEndInDays(5)} onUpgrade={vi.fn()} />,
    );
    expect(container.querySelector('[role="alert"]')).not.toBeNull();
    const dismissBtn = container.querySelector('button[aria-label="Dismiss trial banner"]');
    expect(dismissBtn).not.toBeNull();
    await click(dismissBtn as HTMLButtonElement);
    expect(container.querySelector('[role="alert"]')).toBeNull();
  });
});
