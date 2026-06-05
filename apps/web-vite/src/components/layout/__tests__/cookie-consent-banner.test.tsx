/**
 * Container/component split: CookieConsentBanner is the pure presentational
 * shell — only takes `onAccept`. Visibility is decided by
 * `CookieConsentBannerContainer`, so this test exercises only the rendered
 * chrome and the accept callback.
 */

import type { ReactElement } from 'react';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { CookieConsentBanner } from '../cookie-consent-banner.js';
import { click, findButton, mount } from './_render.js';

afterEach(() => {
  document.body.innerHTML = '';
});

function withRouter(node: ReactElement) {
  return <MemoryRouter initialEntries={['/en']}>{node}</MemoryRouter>;
}

describe('CookieConsentBanner (web-vite)', () => {
  it('renders the banner dialog', async () => {
    await mount(withRouter(<CookieConsentBanner onAccept={vi.fn()} />));
    const dialog = document.querySelector('[role="dialog"]');
    expect(dialog).not.toBeNull();
    expect(dialog?.textContent ?? '').toContain('essential cookies');
  });

  it('renders the "Got it" accept button', async () => {
    const { container } = await mount(withRouter(<CookieConsentBanner onAccept={vi.fn()} />));
    expect(findButton(container, 'Got it')).not.toBeNull();
  });

  it('renders the privacy policy link pointing to legal/privacy', async () => {
    const { container } = await mount(withRouter(<CookieConsentBanner onAccept={vi.fn()} />));
    const link = Array.from(container.querySelectorAll('a')).find(a =>
      (a.textContent ?? '').includes('Privacy policy'),
    );
    expect(link).toBeDefined();
    expect(link?.getAttribute('href') ?? '').toContain('legal/privacy');
  });

  it('invokes onAccept when the accept button is clicked', async () => {
    const onAccept = vi.fn();
    const { container } = await mount(withRouter(<CookieConsentBanner onAccept={onAccept} />));
    const btn = findButton(container, 'Got it');
    expect(btn).not.toBeNull();
    await click(btn as HTMLButtonElement);
    expect(onAccept).toHaveBeenCalledTimes(1);
  });
});
