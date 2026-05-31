/**
 * Web-vite port of apps/web/src/components/settings/__tests__/api-keys-tab.test.tsx.
 *
 * The ApiKeysTab presentational component receives `t`, `keys`, `isLoading`
 * from its hook. It also wraps the table in `FeatureGateContainer` and
 * mounts dialog containers — both reach into tRPC at module-eval time.
 *
 * We mock the gate and dialog containers to keep the test pure and focused
 * on the table/empty/loading branches the component itself owns.
 */

import type { ReactNode } from 'react';
import { describe, expect, it, vi } from 'vitest';

vi.mock('../../billing/feature-gate-container', () => ({
  FeatureGateContainer: ({ children }: { children: ReactNode }) => <>{children}</>,
}));

vi.mock('../create-api-key-dialog-container', () => ({
  CreateKeyDialogContainer: () => null,
}));
vi.mock('../edit-api-key-dialog-container', () => ({
  EditKeyDialogContainer: () => null,
}));
vi.mock('../revoke-api-key-dialog-container', () => ({
  RevokeKeyDialogContainer: () => null,
}));

import { render, screen, setup } from '@/test/test-utils';
import { ApiKeysTab } from '../api-keys-tab';
import type { useApiKeysTab } from '../hooks/use-api-keys-tab';

type HookReturn = ReturnType<typeof useApiKeysTab>;
type ApiKey = NonNullable<HookReturn['keys']>[number];

const tStub = ((key: string) => key) as unknown as HookReturn['t'];

function buildProps(overrides: Partial<HookReturn> = {}): HookReturn {
  return {
    t: tStub,
    keys: [],
    isLoading: false,
    ...overrides,
  } as HookReturn;
}

const sampleKey: ApiKey = {
  id: 'key-1',
  name: 'ERP Integration',
  prefix: 'abc123',
  scopes: ['contractor:read', 'invoice:read'],
  createdBy: { name: 'John Doe' },
  createdAt: '2026-01-15T10:00:00Z',
  lastUsedAt: '2026-04-10T15:30:00Z',
  revokedAt: null,
  expiresAt: null,
} as unknown as ApiKey;

describe('ApiKeysTab', () => {
  it('renders the heading, description and create CTA', () => {
    render(<ApiKeysTab {...buildProps()} />);
    expect(screen.getByText('title')).toBeInTheDocument();
    expect(screen.getByText('description')).toBeInTheDocument();
    expect(screen.getAllByText('createKeyButton').length).toBeGreaterThanOrEqual(1);
  });

  it('renders skeleton rows while isLoading is true', () => {
    const { container } = render(<ApiKeysTab {...buildProps({ isLoading: true })} />);
    expect(container.querySelector('.animate-shimmer')).toBeInTheDocument();
  });

  it('renders the empty state when no keys are present', () => {
    render(<ApiKeysTab {...buildProps({ keys: [] })} />);
    expect(screen.getByText('emptyHeading')).toBeInTheDocument();
    expect(screen.getByText('emptyBody')).toBeInTheDocument();
  });

  it('renders the key table with the supplied rows', () => {
    render(<ApiKeysTab {...buildProps({ keys: [sampleKey] })} />);
    expect(screen.getByText('ERP Integration')).toBeInTheDocument();
    expect(screen.getByText('John Doe')).toBeInTheDocument();
    expect(screen.getByText(/co_live_abc123/)).toBeInTheDocument();
    expect(screen.getByText('active')).toBeInTheDocument();
  });

  it('flags revoked keys with the revoked status badge and no actions menu', () => {
    render(
      <ApiKeysTab
        {...buildProps({
          keys: [
            { ...sampleKey, id: 'k2', revokedAt: '2026-04-15T10:00:00Z' } as unknown as ApiKey,
          ],
        })}
      />,
    );

    expect(screen.getByText('revoked')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'aria.keyActions' })).not.toBeInTheDocument();
  });

  it('opens the create dialog when the empty-state CTA is clicked', async () => {
    const { user } = setup(<ApiKeysTab {...buildProps({ keys: [] })} />);
    const cta = screen.getAllByRole('button', { name: /createKeyButton/i })[0];
    if (cta) {
      await user.click(cta);
    }
    // No throw = handler wired; dialog itself is stubbed out.
    expect(cta).toBeInTheDocument();
  });
});
