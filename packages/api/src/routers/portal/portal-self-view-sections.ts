// Server-fixed allowlist of personnel-file ("akta osobowe") sections an employee
// may see in the portal self-view. The portal self-view is a different trust
// boundary from the staff section gate (which reads a server-side staff role) —
// a portal employee has no staff role, so the entitled sections are this fixed,
// conservative constant instead.
//
// Section C (pay / national-PII) is deliberately excluded: an employee
// self-serve view must not surface the payroll/PII section pending legal review.
// The read never accepts a client-supplied section — it filters strictly on this
// allowlist so an excluded section's document rows are never read into a response.

import type { PersonnelFileSection } from '@contractor-ops/compliance-policy';

export const PERSONNEL_FILE_SELF_VIEW_SECTIONS = [
  'SECTION_A',
  'SECTION_B',
  'SECTION_D',
] as const satisfies readonly PersonnelFileSection[];

/** Whether the given section is in the employee self-view allowlist. */
export function isSelfViewableSection(section: PersonnelFileSection): boolean {
  return (PERSONNEL_FILE_SELF_VIEW_SECTIONS as readonly PersonnelFileSection[]).includes(section);
}
