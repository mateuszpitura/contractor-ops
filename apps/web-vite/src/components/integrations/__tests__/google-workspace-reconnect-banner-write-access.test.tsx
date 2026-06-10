// GoogleWorkspaceReconnectBanner write-access variant (3rd state).
// The shared harness wires the real en.json bundle, so visible strings match.

import type { ScopeCapabilities } from '@contractor-ops/db';
import { describe, expect, it } from 'vitest';
import { render, screen } from '@/test/test-utils';
import { GoogleWorkspaceReconnectBanner } from '../google-workspace-reconnect-banner';

const caps = (capabilities: ScopeCapabilities['capabilities']): ScopeCapabilities => ({
  provider: 'google',
  scopes: ['https://www.googleapis.com/auth/admin.directory.user.readonly'],
  capabilities,
  grantedAt: '2026-04-26T00:00:00.000Z',
});

describe('GoogleWorkspaceReconnectBanner — write-access variant (Phase 76 SC#3)', () => {
  it('renders write-access variant when capabilities have user.deprovision but lack directory.write', () => {
    render(
      <GoogleWorkspaceReconnectBanner
        scopeCapabilities={caps(['directory.read', 'user.deprovision'])}
      />,
    );
    expect(screen.getByRole('region', { name: /write access/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /grant write access/i })).toBeInTheDocument();
  });

  it('hides when capabilities contain both user.deprovision and directory.write', () => {
    const { container } = render(
      <GoogleWorkspaceReconnectBanner
        scopeCapabilities={caps(['directory.read', 'user.deprovision', 'directory.write'])}
      />,
    );
    expect(container.querySelector('[role="region"]')).toBeNull();
  });

  it('falls back to the Phase 70 "Reconnect required" variant when user.deprovision is absent', () => {
    render(<GoogleWorkspaceReconnectBanner scopeCapabilities={caps(['directory.read'])} />);
    expect(screen.getByRole('region', { name: /reconnect google workspace/i })).toBeInTheDocument();
    // The write-access CTA must NOT render in the reconnect state.
    expect(screen.queryByRole('button', { name: /grant write access/i })).toBeNull();
  });

  it('reconnect button routes to the OAuth start URL (write-access flow adds prompt=consent server-side)', () => {
    render(
      <GoogleWorkspaceReconnectBanner
        scopeCapabilities={caps(['directory.read', 'user.deprovision'])}
      />,
    );
    const cta = screen.getByRole('button', { name: /grant write access/i });
    expect(cta.getAttribute('href')).toBe('/api/oauth/google_workspace/start');
  });
});
