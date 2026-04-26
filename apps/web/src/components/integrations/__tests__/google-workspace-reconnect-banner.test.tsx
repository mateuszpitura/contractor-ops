// Phase 70-01 · FOUND6-05 (D-16) — failing component test scaffold for the
// GoogleWorkspaceReconnectBanner. Plan 70-10 implements the component.

import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

vi.mock('next-intl', () => ({
  useTranslations: () => (key: string, values?: Record<string, string>) => {
    if (values) return `${key}:${JSON.stringify(values)}`;
    return key;
  },
}));

vi.mock('@/i18n/navigation', () => ({
  Link: ({
    children,
    href,
    ...props
  }: {
    children: React.ReactNode;
    href: string;
    [key: string]: unknown;
  }) => (
    <a href={href} {...(props as React.AnchorHTMLAttributes<HTMLAnchorElement>)}>
      {children}
    </a>
  ),
}));

// biome-ignore lint/correctness/noUnresolvedImports: target of Plan 70-10
import { GoogleWorkspaceReconnectBanner } from '../google-workspace-reconnect-banner.js';

describe('GoogleWorkspaceReconnectBanner (FOUND6-05 — D-16)', () => {
  it('renders when scopeCapabilities lacks user.deprovision', () => {
    render(
      <GoogleWorkspaceReconnectBanner
        scopeCapabilities={{
          provider: 'google',
          scopes: [],
          capabilities: ['directory.read'],
          grantedAt: '2026-04-26T00:00:00.000Z',
        }}
      />,
    );
    expect(screen.getByRole('button', { name: /reconnect/i })).toBeInTheDocument();
  });

  it('does not render when capabilities already include user.deprovision', () => {
    const { container } = render(
      <GoogleWorkspaceReconnectBanner
        scopeCapabilities={{
          provider: 'google',
          scopes: [],
          capabilities: ['directory.read', 'user.deprovision'],
          grantedAt: '2026-04-26T00:00:00.000Z',
        }}
      />,
    );
    expect(container).toBeEmptyDOMElement();
  });

  it('renders the banner when scopeCapabilities is null (legacy v3.0 connection)', () => {
    render(<GoogleWorkspaceReconnectBanner scopeCapabilities={null} />);
    expect(screen.getByRole('button', { name: /reconnect/i })).toBeInTheDocument();
  });
});
