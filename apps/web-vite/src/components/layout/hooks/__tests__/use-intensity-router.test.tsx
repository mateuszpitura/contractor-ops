/**
 * `useIntensityRouter` — body intensity controller.
 * Atelier: dashboard root + /reports. Everything else: workbench.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const pathnameRef: { current: string } = { current: '/' };

vi.mock('../../../../i18n/navigation.js', () => ({
  usePathname: () => pathnameRef.current,
}));

import { renderHookWithProviders } from '../../../../test-utils/render-hook.js';
import { intensityForPathname, useIntensityRouter } from '../use-intensity-router.js';

beforeEach(() => {
  pathnameRef.current = '/';
  delete document.body.dataset.intensity;
});

afterEach(() => {
  delete document.body.dataset.intensity;
});

describe('intensityForPathname (pure)', () => {
  it('returns atelier on the root pathname', () => {
    expect(intensityForPathname('/')).toBe('atelier');
    expect(intensityForPathname('')).toBe('atelier');
  });

  it('returns atelier under /reports', () => {
    expect(intensityForPathname('/reports')).toBe('atelier');
    expect(intensityForPathname('/reports/q1')).toBe('atelier');
  });

  it('returns workbench for operational routes', () => {
    expect(intensityForPathname('/contractors')).toBe('workbench');
    expect(intensityForPathname('/invoices/123')).toBe('workbench');
  });
});

describe('useIntensityRouter', () => {
  it('returns the intensity for the current pathname', () => {
    pathnameRef.current = '/contractors';
    const { result } = renderHookWithProviders(() => useIntensityRouter());
    expect(result.current).toBe('workbench');
  });

  it('writes data-intensity on the body and restores the previous value on unmount', () => {
    document.body.dataset.intensity = 'workbench';
    pathnameRef.current = '/reports';
    const { unmount, result } = renderHookWithProviders(() => useIntensityRouter());
    expect(document.body.dataset.intensity).toBe('atelier');
    expect(result.current).toBe('atelier');
    unmount();
    expect(document.body.dataset.intensity).toBe('workbench');
  });

  it('cleans up the dataset key entirely when no previous value existed', () => {
    pathnameRef.current = '/reports';
    const { unmount } = renderHookWithProviders(() => useIntensityRouter());
    expect(document.body.dataset.intensity).toBe('atelier');
    unmount();
    expect(document.body.dataset.intensity).toBeUndefined();
  });
});
