// GoogleWorkspaceReconnectBanner unit tests ported from apps/web. Web-vite uses
// `useTranslations` from `@/i18n` instead of `NextIntlClientProvider`, but the
// shared harness wires the same en.json bundle so the visible strings match.

import type { ScopeCapabilities } from '@contractor-ops/db';
import { describe, expect, it } from 'vitest';

import { render, screen } from '@/test/test-utils';
import { GoogleWorkspaceReconnectBanner } from '../google-workspace-reconnect-banner';

describe('GoogleWorkspaceReconnectBanner (FOUND6-05 — D-16)', () => {
  it('renders when scopeCapabilities is null (legacy v3.0 connection)', () => {
    render(<GoogleWorkspaceReconnectBanner scopeCapabilities={null} />);
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
    render(<GoogleWorkspaceReconnectBanner scopeCapabilities={caps} />);
    expect(screen.getByRole('region')).toBeInTheDocument();
  });

  it('hides only when capabilities include BOTH user.deprovision AND directory.write (Phase 76 3-state)', () => {
    const caps: ScopeCapabilities = {
      provider: 'google',
      scopes: ['https://www.googleapis.com/auth/admin.directory.user'],
      capabilities: ['directory.read', 'user.deprovision', 'directory.write'],
      grantedAt: '2026-04-26T00:00:00.000Z',
    };
    const { container } = render(<GoogleWorkspaceReconnectBanner scopeCapabilities={caps} />);
    expect(container.querySelector('[role="region"]')).toBeNull();
  });

  it('reconnect link points to the existing OAuth start URL (no new scope params)', () => {
    render(<GoogleWorkspaceReconnectBanner scopeCapabilities={null} />);
    const cta = screen.getByRole('button', { name: /reconnect google workspace/i });
    expect(cta.getAttribute('href')).toBe('/api/oauth/google_workspace/start');
    expect(cta.getAttribute('href')).not.toContain('scope=');
  });
});
