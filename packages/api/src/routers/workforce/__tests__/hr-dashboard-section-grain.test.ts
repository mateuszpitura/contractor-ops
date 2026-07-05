// Per-section grain for the HR-dashboard document-expiry widget.
//
// getDocumentExpiry filters each personnel-file document row through
// `hasSectionPermission(ctx, section)` BEFORE deriving expiry bands, so a role
// never sees expiry for a section it cannot read. This proves the exact section
// visibility matrix the filter enforces (RESEARCH C7):
//   - payroll_officer → section C only (pay)
//   - leave_approver  → section A only (master/leave)
//   - hr_admin        → all four sections
//   - hr_manager      → all four sections (C is read-only, but read is granted)

import type { PersonnelFileSection } from '@contractor-ops/compliance-policy';
import { describe, expect, it } from 'vitest';
import { hasSectionPermission } from '../../core/personnel-file/section-access';

const SECTIONS: PersonnelFileSection[] = ['SECTION_A', 'SECTION_B', 'SECTION_C', 'SECTION_D'];

function ctxForRole(role: string) {
  return { session: { user: { role } } };
}

function readableSections(role: string): PersonnelFileSection[] {
  return SECTIONS.filter(s => hasSectionPermission(ctxForRole(role), s));
}

describe('hrDashboard doc-expiry section grain', () => {
  it('payroll_officer sees only section C', () => {
    expect(readableSections('payroll_officer')).toEqual(['SECTION_C']);
  });

  it('leave_approver sees only section A', () => {
    expect(readableSections('leave_approver')).toEqual(['SECTION_A']);
  });

  it('hr_admin sees all four sections', () => {
    expect(readableSections('hr_admin')).toEqual(SECTIONS);
  });

  it('hr_manager sees all four sections (C read-only still grants read)', () => {
    expect(readableSections('hr_manager')).toEqual(SECTIONS);
  });

  it('a non-HR role sees no personnel-file section', () => {
    expect(readableSections('finance_admin')).toEqual([]);
  });
});
