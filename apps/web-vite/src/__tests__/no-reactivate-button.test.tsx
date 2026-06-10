import { execSync } from 'node:child_process';
import { describe, expect, it, vi } from 'vitest';

// Mock the two tRPC-bound dialog containers so the header render stays presentational
// (mirrors contractor-profile/__tests__/profile-header.test.tsx).
vi.mock('../components/contracts/contract-wizard/wizard-dialog.js', () => ({
  ContractWizardDialog: () => null,
}));
vi.mock('../components/workflows/template-picker-dialog.js', () => ({
  TemplatePickerDialog: () => null,
}));

import type { ProfileHeaderContractor } from '../components/contractors/contractor-profile/profile-header.js';
import { ProfileHeaderView } from '../components/contractors/contractor-profile/profile-header.js';
import { render, screen } from '../test/test-utils.js';

function renderHeader(lifecycleStage: string) {
  return render(
    <ProfileHeaderView
      contractor={
        {
          id: 'c1',
          displayName: 'ACME Corp',
          legalName: 'ACME Sp. z o.o.',
          type: 'COMPANY',
          lifecycleStage,
          owner: { id: 'u1', name: 'Jan Kowalski', image: null },
        } as ProfileHeaderContractor
      }
      transitionLifecycle={vi.fn()}
      archive={vi.fn()}
      isPending={false}
    />,
  );
}

describe('No "Reactivate contractor" button anywhere (Phase 76 SC#7 / IDP-15)', () => {
  it('static grep across apps/web-vite returns no matches for /reactivate.*contractor/i', () => {
    // Scans shipped UI source + locale messages only. Test files are excluded —
    // this very test mentions the forbidden phrase in its own assertions.
    const out = execSync(
      'grep -rIE -i --exclude-dir=__tests__ "reactivate.*contractor|re-?activate.{0,3}contractor" src messages || true',
      { encoding: 'utf8', cwd: process.cwd() },
    );
    expect(out.trim()).toBe('');
  });

  it('RTL: ENDED contractor profile header renders no "Reactivate" button', () => {
    renderHeader('ENDED');
    expect(screen.queryAllByRole('button', { name: /reactivate/i })).toEqual([]);
    expect(screen.queryByText(/reactivate/i)).toBeNull();
  });

  it('RTL: OFFBOARDING contractor profile header renders no "Reactivate" button', () => {
    renderHeader('OFFBOARDING');
    expect(screen.queryAllByRole('button', { name: /reactivate/i })).toEqual([]);
    expect(screen.queryByText(/reactivate/i)).toBeNull();
  });
});
