/**
 * Step 10 port of apps/web/src/components/classification/__tests__/advisory-banner.test.tsx.
 *
 * Banner is pure presentational — no tRPC, no i18n hook (legal text comes
 * from `@contractor-ops/validators` constants), so the local `_render.tsx`
 * helpers are enough and we can drop `@testing-library/react`.
 */

import { BANNER_IR35_ADVISORY_EN, BANNER_SCHEIN_ADVISORY_DE } from '@contractor-ops/validators';
import { afterEach, describe, expect, it } from 'vitest';

import { ClassificationAdvisoryBanner } from '../advisory-banner.js';
import { findByRole, mount } from './_render.js';

afterEach(() => {
  document.body.innerHTML = '';
});

describe('ClassificationAdvisoryBanner (web-vite)', () => {
  it('renders IR35 English phrase for GB jurisdiction', async () => {
    await mount(<ClassificationAdvisoryBanner jurisdiction="GB" />);
    const el = findByRole(document.body, 'note');
    expect(el).not.toBeNull();
    expect(el?.textContent ?? '').toContain(BANNER_IR35_ADVISORY_EN.slice(0, 40));
  });

  it('renders Schein German phrase for DE jurisdiction', async () => {
    await mount(<ClassificationAdvisoryBanner jurisdiction="DE" />);
    const el = findByRole(document.body, 'note');
    expect(el).not.toBeNull();
    expect(el?.textContent ?? '').toContain(BANNER_SCHEIN_ADVISORY_DE.slice(0, 40));
  });

  it('renders Schein German phrase for AT jurisdiction', async () => {
    await mount(<ClassificationAdvisoryBanner jurisdiction="AT" />);
    const el = findByRole(document.body, 'note');
    expect(el?.textContent ?? '').toContain(BANNER_SCHEIN_ADVISORY_DE.slice(0, 40));
  });

  it('renders IR35 phrase by default for unknown jurisdiction', async () => {
    await mount(<ClassificationAdvisoryBanner jurisdiction="PL" />);
    const el = findByRole(document.body, 'note');
    expect(el?.textContent ?? '').toContain(BANNER_IR35_ADVISORY_EN.slice(0, 40));
  });

  it('has role="note" for accessibility', async () => {
    await mount(<ClassificationAdvisoryBanner jurisdiction="GB" />);
    expect(findByRole(document.body, 'note')).not.toBeNull();
  });

  it('does not render a close button (non-dismissible)', async () => {
    const { container } = await mount(<ClassificationAdvisoryBanner jurisdiction="GB" />);
    expect(container.querySelector('button')).toBeNull();
  });

  it('uses amber colour classes (not red/blue/green)', async () => {
    const { container } = await mount(<ClassificationAdvisoryBanner jurisdiction="GB" />);
    const el = container.querySelector('[role="note"]');
    expect(el?.className ?? '').toContain('amber');
  });
});
