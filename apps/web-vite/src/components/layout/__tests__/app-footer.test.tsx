/**
 * AppFooter is the authenticated shell footer — the only piece of layout
 * chrome that surfaces the policy links and the dynamic copyright year.
 * Wrapped in MemoryRouter because react-router-dom's `<Link>` needs a
 * router context.
 */

import type { ReactElement } from 'react';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, describe, expect, it } from 'vitest';

import { AppFooter } from '../app-footer.js';
import { findAllByText, mount } from './_render.js';

afterEach(() => {
  document.body.innerHTML = '';
});

function withRouter(node: ReactElement): ReactElement {
  return <MemoryRouter initialEntries={['/en/dashboard']}>{node}</MemoryRouter>;
}

describe('AppFooter (web-vite)', () => {
  it('renders a footer landmark', async () => {
    const { container } = await mount(withRouter(<AppFooter />));
    expect(container.querySelector('footer')).not.toBeNull();
  });

  it('renders the privacy link with the legal/privacy href', async () => {
    const { container } = await mount(withRouter(<AppFooter />));
    const privacy = Array.from(container.querySelectorAll('a')).find(
      a => (a.textContent ?? '').trim() === 'Privacy',
    );
    expect(privacy).toBeDefined();
    // react-router resolves the relative `to="legal/privacy"` against the
    // current location, so the rendered href is prefixed with the active path.
    expect(privacy?.getAttribute('href') ?? '').toContain('legal/privacy');
  });

  it('renders the terms link with the legal/terms href', async () => {
    const { container } = await mount(withRouter(<AppFooter />));
    const terms = Array.from(container.querySelectorAll('a')).find(
      a => (a.textContent ?? '').trim() === 'Terms',
    );
    expect(terms).toBeDefined();
    expect(terms?.getAttribute('href') ?? '').toContain('legal/terms');
  });

  it('renders the copyright with the current year', async () => {
    const { container } = await mount(withRouter(<AppFooter />));
    const year = new Date().getFullYear();
    expect(container.textContent ?? '').toContain(`© ${year} Contractor Ops`);
  });

  it('renders accessible tap targets (min-h 44px) on every link', async () => {
    const { container } = await mount(withRouter(<AppFooter />));
    const links = Array.from(container.querySelectorAll('a'));
    expect(links.length).toBeGreaterThan(0);
    for (const link of links) {
      expect(link.className).toContain('min-h-[44px]');
    }
  });

  it('renders the Privacy and Terms labels exactly once each', async () => {
    const { container } = await mount(withRouter(<AppFooter />));
    expect(findAllByText(container, 'Privacy')).toHaveLength(1);
    expect(findAllByText(container, 'Terms')).toHaveLength(1);
  });
});
