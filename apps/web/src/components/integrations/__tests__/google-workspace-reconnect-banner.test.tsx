// Phase 70-10 · FOUND6-05 (D-16) — GoogleWorkspaceReconnectBanner unit tests.
//
// Replaces the Wave-0 stub from Plan 70-01-07. Verifies:
//   - banner renders for legacy v3.0 connections (scopeCapabilities is null)
//   - banner renders when capabilities lack `user.deprovision`
//   - banner is hidden once capabilities include `user.deprovision`
//   - reconnect link points to the existing OAuth start URL with NO new
//     `scope=` query string (T-70-10-01)

import type { ScopeCapabilities } from '@contractor-ops/db';
import { render, screen } from '@testing-library/react';
import { NextIntlClientProvider } from 'next-intl';
import type { ReactElement } from 'react';
import { describe, expect, it } from 'vitest';

import enMessages from '../../../../messages/en.json' with { type: 'json' };
import { GoogleWorkspaceReconnectBanner } from '../google-workspace-reconnect-banner';

function renderWithI18n(ui: ReactElement) {
  return render(
    <NextIntlClientProvider locale="en" messages={enMessages} timeZone="UTC">
      {ui}
    </NextIntlClientProvider>,
  );
}

describe('GoogleWorkspaceReconnectBanner (FOUND6-05 — D-16)', () => {
  it('renders when scopeCapabilities is null (legacy v3.0 connection)', () => {
    renderWithI18n(<GoogleWorkspaceReconnectBanner scopeCapabilities={null} />);
    expect(screen.getByRole('region', { name: /reconnect google workspace/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /reconnect google workspace/i })).toBeInTheDocument();
  });

  it('renders when capabilities lack user.deprovision', () => {
    const caps: ScopeCapabilities = {
      provider: 'google',
      scopes: ['https://www.googleapis.com/auth/admin.directory.user.readonly'],
      capabilities: ['directory.read'],
      grantedAt: '2026-04-26T00:00:00.000Z',
    };
    renderWithI18n(<GoogleWorkspaceReconnectBanner scopeCapabilities={caps} />);
    expect(screen.getByRole('region')).toBeInTheDocument();
  });

  it('hides when capabilities include user.deprovision', () => {
    const caps: ScopeCapabilities = {
      provider: 'google',
      scopes: ['https://www.googleapis.com/auth/admin.directory.user.readonly'],
      capabilities: ['directory.read', 'user.deprovision'],
      grantedAt: '2026-04-26T00:00:00.000Z',
    };
    const { container } = renderWithI18n(
      <GoogleWorkspaceReconnectBanner scopeCapabilities={caps} />,
    );
    expect(container).toBeEmptyDOMElement();
  });

  it('reconnect button points to the existing OAuth start URL (no new scope params)', () => {
    renderWithI18n(<GoogleWorkspaceReconnectBanner scopeCapabilities={null} />);
    const cta = screen.getByRole('button', {
      name: /reconnect google workspace/i,
    });
    // Base-ui Button renders the underlying <a> element with role="button";
    // the href lives on the same element.
    expect(cta.tagName).toBe('A');
    expect(cta.getAttribute('href')).toBe('/api/oauth/google_workspace/start');
    expect(cta.getAttribute('href')).not.toContain('scope=');
  });
});
