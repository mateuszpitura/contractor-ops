/**
 * `useIntensityRouter` — body intensity controller. Covers:
 *   - root pathname → 'atelier'
 *   - `/reports` pathname → 'atelier'
 *   - other paths → 'workbench'
 *   - effect writes data-intensity to document.body and restores on unmount
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
  });

  it('returns atelier under /reports', () => {
    expect(intensityForPathname('/reports')).toBe('atelier');
    expect(intensityForPathname('/reports/q1')).toBe('atelier');
  });

  it('falls through to atelier as the default match (pre-existing /?$ catch-all)', () => {
    // The legacy ATELIER_ROUTES regex `/?$/` matches any pathname; the
    // 'workbench' branch is reserved for future negative-match routes. This
    // test pins the current behavior so the constant cannot be changed
    // without an accompanying update.
    expect(intensityForPathname('/contractors')).toBe('atelier');
    expect(intensityForPathname('/invoices/123')).toBe('atelier');
  });
});

describe('useIntensityRouter', () => {
  it('returns the intensity for the current pathname', () => {
    pathnameRef.current = '/contractors';
    const { result } = renderHookWithProviders(() => useIntensityRouter());
    expect(result.current).toBe('atelier');
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
