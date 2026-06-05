/**
 * Equipment status spans the full assignment + return lifecycle
 * (AVAILABLE → ASSIGNED → IN_TRANSIT → DELIVERED → RETURN_REQUESTED →
 * RETURN_IN_TRANSIT → RETURNED → RETIRED). Verifies translated labels,
 * aria-label parity, the secondary fallback for unknown values, and
 * Polish-locale rendering.
 */

import type { ReactElement } from 'react';
import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { afterEach, beforeAll, describe, expect, it } from 'vitest';

import { applyLocale, initI18n } from '../../../i18n/index.js';
import { EquipmentStatusBadge } from '../equipment-status-badge.js';

interface Rendered {
  container: HTMLDivElement;
  unmount: () => void;
}

const mounted: Rendered[] = [];

function renderInto(node: ReactElement): Rendered {
  const container = document.createElement('div');
  document.body.appendChild(container);
  const root = createRoot(container);
  // `act` returns a thenable; render is synchronous so we discard it.
  void act(() => {
    root.render(node);
  });
  const handle: Rendered = {
    container,
    unmount: () => {
      void act(() => {
        root.unmount();
      });
      container.remove();
    },
  };
  mounted.push(handle);
  return handle;
}

beforeAll(async () => {
  initI18n();
  await applyLocale('en');
});

afterEach(async () => {
  while (mounted.length > 0) {
    mounted.pop()?.unmount();
  }
  await applyLocale('en');
});

const ALL_STATUSES = [
  { status: 'AVAILABLE', label: 'Available' },
  { status: 'ASSIGNED', label: 'Assigned' },
  { status: 'IN_TRANSIT', label: 'In transit' },
  { status: 'DELIVERED', label: 'Delivered' },
  { status: 'RETURN_REQUESTED', label: 'Return requested' },
  { status: 'RETURN_IN_TRANSIT', label: 'Return in transit' },
  { status: 'RETURNED', label: 'Returned' },
  { status: 'RETIRED', label: 'Retired' },
] as const;

describe('EquipmentStatusBadge', () => {
  it.each(ALL_STATUSES)("renders $status with translated label '$label'", ({ status, label }) => {
    const { container } = renderInto(<EquipmentStatusBadge status={status} />);
    expect(container.textContent).toContain(label);
  });

  it.each(ALL_STATUSES)("sets aria-label to '$label' for $status", ({ status, label }) => {
    const { container } = renderInto(<EquipmentStatusBadge status={status} />);
    const badge = container.querySelector(`[aria-label="${label}"]`);
    expect(badge).toBeTruthy();
  });

  it('falls back to a non-colored variant for unknown status', () => {
    const { container } = renderInto(<EquipmentStatusBadge status="UNKNOWN_STATUS" />);
    // Missing-key fallback: i18next returns the full dotted key string.
    const badge = container.querySelector('[aria-label]');
    expect(badge).toBeTruthy();
    const cls = badge?.className ?? '';
    expect(cls).not.toContain('bg-green');
    expect(cls).not.toContain('bg-blue');
    expect(cls).not.toContain('bg-amber');
  });

  it('passes custom className through to the badge root', () => {
    const { container } = renderInto(<EquipmentStatusBadge status="AVAILABLE" className="extra" />);
    const badge = container.querySelector('[aria-label="Available"]');
    expect(badge?.className).toContain('extra');
  });

  it('renders translated label in the Polish locale', async () => {
    await applyLocale('pl');
    const { container } = renderInto(<EquipmentStatusBadge status="AVAILABLE" />);
    expect(container.textContent).toContain('Dostepny');
  });
});
