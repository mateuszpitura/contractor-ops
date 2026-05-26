/**
 * Ported from apps/web/src/components/offboarding/__tests__/override-badge.test.tsx.
 *
 * OverrideBadge is presentational — returns `null` when metadata absent,
 * otherwise renders a destructive Badge wrapped in a TooltipTrigger button.
 */

import { afterEach, describe, expect, it } from 'vitest';

import type { OverrideMetadata } from '../override-badge.js';
import { OverrideBadge } from '../override-badge.js';
import { findByLabel, findByText, mount } from './_render.js';

afterEach(() => {
  document.body.innerHTML = '';
});

const metadata: OverrideMetadata = {
  reason: 'Contractor exited before IP verification could be completed.',
  acknowledged: true,
  overriddenByUserId: 'user-owner-1',
  overriddenAt: '2026-04-27T12:00:00Z',
  blockedTaskKind: 'IP_VERIFICATION',
};

describe('OverrideBadge (web-vite)', () => {
  it('renders the label when overrideMetadata is present', async () => {
    await mount(<OverrideBadge overrideMetadata={metadata} />);
    expect(findByText(document.body, 'IP verification overridden')).not.toBeNull();
  });

  it('renders nothing when overrideMetadata is null', async () => {
    const { container } = await mount(<OverrideBadge overrideMetadata={null} />);
    expect(container.innerHTML).toBe('');
  });

  it('renders nothing when overrideMetadata is undefined', async () => {
    const { container } = await mount(<OverrideBadge overrideMetadata={undefined} />);
    expect(container.innerHTML).toBe('');
  });

  it('exposes the badge as a keyboard-focusable button with aria-label (a11y)', async () => {
    await mount(<OverrideBadge overrideMetadata={metadata} actorName="Alice" />);
    const trigger = findByLabel(document.body, 'IP verification overridden');
    expect(trigger).not.toBeNull();
    expect((trigger as HTMLElement).tagName).toBe('BUTTON');
    expect((trigger as HTMLElement).getAttribute('type') ?? 'button').toBe('button');
  });
});
