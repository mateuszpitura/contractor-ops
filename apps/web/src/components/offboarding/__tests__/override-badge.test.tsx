// Phase 74 Plan 08 — RTL tests for the permanent OverrideBadge.

import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import type { OverrideMetadata } from '../override-badge';
import { OverrideBadge } from '../override-badge';

vi.mock('next-intl', () => ({
  useTranslations: () => (key: string, vars?: Record<string, string>) => {
    const map: Record<string, string> = {
      label: 'IP verification overridden',
      tooltipReason: `Reason: ${vars?.reason ?? ''}`,
      tooltipActor: `Overridden by ${vars?.name ?? ''} on ${vars?.date ?? ''}`,
      tooltipBlockedTask: 'Blocked task: IP_VERIFICATION',
    };
    return map[key] ?? key;
  },
}));

const metadata: OverrideMetadata = {
  reason: 'Contractor exited before IP verification could be completed.',
  acknowledged: true,
  overriddenByUserId: 'user-owner-1',
  overriddenAt: '2026-04-27T12:00:00Z',
  blockedTaskKind: 'IP_VERIFICATION',
};

describe('OverrideBadge — D-11 permanent badge', () => {
  it('renders when WorkflowRun.overrideMetadata is present', () => {
    render(<OverrideBadge overrideMetadata={metadata} />);
    expect(screen.getByText('IP verification overridden')).toBeInTheDocument();
  });

  it('does not render when overrideMetadata is null', () => {
    const { container } = render(<OverrideBadge overrideMetadata={null} />);
    expect(container).toBeEmptyDOMElement();
  });

  it('badge is keyboard-focusable button (a11y)', () => {
    render(<OverrideBadge overrideMetadata={metadata} actorName="Alice" />);
    const button = screen.getByLabelText('IP verification overridden');
    expect(button).toBeInTheDocument();
    expect(button.tagName).toBe('BUTTON');
    expect(button).toHaveAttribute('type', 'button');
  });
});
