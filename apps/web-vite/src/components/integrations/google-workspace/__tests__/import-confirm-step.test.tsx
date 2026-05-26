/**
 * ImportConfirmStep is a leaf component (no hook split) — props are concrete,
 * and i18n resolves through the real EN bundle via the shared harness.
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';

import { render, screen, setup } from '@/test/test-utils';
import { ImportConfirmStep } from '../import-confirm-step';

interface BuildOpts {
  userCount?: number;
  roleBreakdown?: Array<{
    role:
      | 'admin'
      | 'finance_admin'
      | 'ops_manager'
      | 'team_manager'
      | 'legal_compliance_viewer'
      | 'it_admin'
      | 'external_accountant'
      | 'readonly';
    count: number;
    source: string;
  }>;
  isImporting?: boolean;
  onConfirm?: () => void;
  onBack?: () => void;
}

function buildProps(overrides: BuildOpts = {}): React.ComponentProps<typeof ImportConfirmStep> {
  const {
    userCount = 5,
    roleBreakdown = [
      { role: 'admin', count: 2, source: 'default' },
      { role: 'readonly', count: 3, source: 'default' },
    ],
    isImporting = false,
    onConfirm = vi.fn(),
    onBack = vi.fn(),
  } = overrides;
  return { userCount, roleBreakdown, isImporting, onConfirm, onBack };
}

describe('ImportConfirmStep', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders the "ready to import" heading with the user count', () => {
    render(<ImportConfirmStep {...buildProps({ userCount: 5 })} />);
    expect(screen.getByText(/Ready to import 5 users/)).toBeInTheDocument();
  });

  it('renders one row per role breakdown entry', () => {
    render(<ImportConfirmStep {...buildProps()} />);
    expect(screen.getByText(/2 as Admin/)).toBeInTheDocument();
    expect(screen.getByText(/3 as Read Only/)).toBeInTheDocument();
  });

  it('renders the back and import buttons', () => {
    render(<ImportConfirmStep {...buildProps()} />);
    expect(screen.getByRole('button', { name: 'Back' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Import \d+ users/ })).toBeInTheDocument();
  });

  it('disables both buttons while importing', () => {
    render(<ImportConfirmStep {...buildProps({ isImporting: true })} />);
    expect(screen.getByRole('button', { name: 'Back' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Importing users...' })).toBeDisabled();
  });

  it('swaps the import label to the in-flight copy when importing', () => {
    render(<ImportConfirmStep {...buildProps({ isImporting: true })} />);
    expect(screen.getByText('Importing users...')).toBeInTheDocument();
  });

  it('calls onConfirm when the import button is clicked', async () => {
    const onConfirm = vi.fn();
    const { user } = setup(<ImportConfirmStep {...buildProps({ onConfirm })} />);
    await user.click(screen.getByRole('button', { name: /Import \d+ users/ }));
    expect(onConfirm).toHaveBeenCalledTimes(1);
  });

  it('calls onBack when the back button is clicked', async () => {
    const onBack = vi.fn();
    const { user } = setup(<ImportConfirmStep {...buildProps({ onBack })} />);
    await user.click(screen.getByRole('button', { name: 'Back' }));
    expect(onBack).toHaveBeenCalledTimes(1);
  });
});
