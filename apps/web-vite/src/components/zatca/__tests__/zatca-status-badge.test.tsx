/**
 * Ported from apps/web/src/components/zatca/__tests__/zatca-status-badge.test.tsx.
 *
 * Web-vite ZatcaStatusBadge is a pure i18n-free badge — same status →
 * label map (UI-SPEC §2) and same aria-label contract. Audit #13
 * flagged the broader ZATCA cluster as untested; this badge is the
 * surface most other invoice views reuse so it carries the smoke load.
 */

import { afterEach, describe, expect, it } from 'vitest';

import type { ZatcaBadgeStatus } from '../zatca-status-badge.js';
import { ZatcaStatusBadge } from '../zatca-status-badge.js';
import { findByAriaLabel, findByText, mount } from './_render.js';

afterEach(() => {
  document.body.innerHTML = '';
});

const statuses: ReadonlyArray<{ status: ZatcaBadgeStatus; label: string }> = [
  { status: 'PENDING', label: 'ZATCA Pending' },
  { status: 'SUBMITTED', label: 'ZATCA Submitted' },
  { status: 'CLEARED', label: 'ZATCA Cleared' },
  { status: 'REPORTED', label: 'ZATCA Reported' },
  { status: 'REJECTED', label: 'ZATCA Rejected' },
  { status: 'WARNING', label: 'ZATCA Warning' },
];

describe('ZatcaStatusBadge (web-vite)', () => {
  for (const { status, label } of statuses) {
    it(`renders "${label}" for status ${status}`, async () => {
      await mount(<ZatcaStatusBadge status={status} />);
      expect(findByText(document.body, label)).not.toBeNull();
    });
  }

  it('sets an aria-label without a date when only the status is given', async () => {
    await mount(<ZatcaStatusBadge status="CLEARED" />);
    expect(findByAriaLabel(document.body, 'ZATCA status: Cleared')).not.toBeNull();
  });

  it('sets an aria-label that includes the date when one is provided', async () => {
    await mount(<ZatcaStatusBadge status="REJECTED" date="2026-01-15" />);
    expect(findByAriaLabel(document.body, 'ZATCA status: Rejected on 2026-01-15')).not.toBeNull();
  });

  it('applies a custom className', async () => {
    const { container } = await mount(<ZatcaStatusBadge status="PENDING" className="my-class" />);
    expect(container.querySelector('.my-class')).not.toBeNull();
  });

  it('renders nothing for an unknown status', async () => {
    const { container } = await mount(<ZatcaStatusBadge status={'UNKNOWN' as ZatcaBadgeStatus} />);
    expect(container.innerHTML).toBe('');
  });
});
