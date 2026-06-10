/**
 * ImportConfirmStep is a leaf component (no hook split) — props are concrete,
 * and i18n resolves through the real EN bundle via the shared harness.
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';

import { render, screen } from '@/test/test-utils';
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
}

function buildProps(overrides: BuildOpts = {}): React.ComponentProps<typeof ImportConfirmStep> {
  const {
    userCount = 5,
    roleBreakdown = [
      { role: 'admin', count: 2, source: 'default' },
      { role: 'readonly', count: 3, source: 'default' },
    ],
  } = overrides;
  return { userCount, roleBreakdown };
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
});
