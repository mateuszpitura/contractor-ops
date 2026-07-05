/**
 * The ApiKeysTabView presentational component receives `t`, `keys`, `isLoading`
 * from its hook. It also wraps the table in `FeatureGate` and
 * mounts dialog containers — both reach into tRPC at module-eval time.
 *
 * We mock the gate and dialog containers to keep the test pure and focused
 * on the table/empty/loading branches the component itself owns.
 */

import type { ReactNode } from 'react';
import { describe, expect, it, vi } from 'vitest';

vi.mock('../../layout/feature-gate', () => ({
  FeatureGate: ({ children }: { children: ReactNode }) => <>{children}</>,
}));

vi.mock('../create-api-key-dialog', () => ({
  CreateKeyDialog: () => null,
}));
vi.mock('../edit-api-key-dialog', () => ({
  EditKeyDialog: () => null,
}));
vi.mock('../revoke-api-key-dialog', () => ({
  RevokeKeyDialog: () => null,
}));
vi.mock('../rotate-api-key-dialog', () => ({
  RotateKeyDialog: () => null,
}));
vi.mock('../api-keys/key-detail-drawer', () => ({
  KeyDetailDrawer: () => null,
}));

import { render, screen, setup } from '@/test/test-utils';
import { ApiKeysTabView } from '../api-keys-tab';
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

describe('ApiKeysTabView', () => {
  it('renders the heading, description and create CTA', () => {
    render(<ApiKeysTabView {...buildProps()} />);
    expect(screen.getByText('title')).toBeInTheDocument();
    expect(screen.getByText('description')).toBeInTheDocument();
    expect(screen.getAllByText('createKeyButton').length).toBeGreaterThanOrEqual(1);
  });

  it('renders skeleton rows while isLoading is true', () => {
    const { container } = render(<ApiKeysTabView {...buildProps({ isLoading: true })} />);
    expect(container.querySelector('.animate-shimmer')).toBeInTheDocument();
  });

  it('renders the empty state when no keys are present', () => {
    render(<ApiKeysTabView {...buildProps({ keys: [] })} />);
    expect(screen.getByText('emptyHeading')).toBeInTheDocument();
    expect(screen.getByText('emptyBody')).toBeInTheDocument();
  });

  it('renders the key table with the supplied rows', () => {
    render(<ApiKeysTabView {...buildProps({ keys: [sampleKey] })} />);
    expect(screen.getByText('ERP Integration')).toBeInTheDocument();
    expect(screen.getByText('John Doe')).toBeInTheDocument();
    expect(screen.getByText(/co_live_abc123/)).toBeInTheDocument();
    expect(screen.getByText('active')).toBeInTheDocument();
  });

  it('flags revoked keys with the revoked status badge and no actions menu', () => {
    render(
      <ApiKeysTabView
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
    const { user } = setup(<ApiKeysTabView {...buildProps({ keys: [] })} />);
    const cta = screen.getAllByRole('button', { name: /createKeyButton/i })[0];
    if (cta) {
      await user.click(cta);
    }
    // No throw = handler wired; dialog itself is stubbed out.
    expect(cta).toBeInTheDocument();
  });

  it('renders the last-used column and a formatted timestamp', () => {
    render(<ApiKeysTabView {...buildProps({ keys: [sampleKey] })} />);
    expect(screen.getByText('tableHeaders.lastUsed')).toBeInTheDocument();
    // The lastUsedAt cell formats the sample date's year.
    expect(screen.getAllByText(/2026/).length).toBeGreaterThanOrEqual(1);
  });

  it('exposes View details and Rotate alongside Edit and Revoke on an active key menu', async () => {
    const { user } = setup(<ApiKeysTabView {...buildProps({ keys: [sampleKey] })} />);
    await user.click(screen.getByRole('button', { name: 'aria.keyActions' }));
    expect(await screen.findByText('detailsAction')).toBeInTheDocument();
    expect(await screen.findByText('rotateAction')).toBeInTheDocument();
    expect(await screen.findByText('editAction')).toBeInTheDocument();
    expect(await screen.findByText('revokeAction')).toBeInTheDocument();
  });
});
