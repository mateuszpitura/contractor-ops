/**
 * Covers the SLA countdown logic surfacing on every approval-chain step
 * (approve/reject with comment, delegation): label format, overdue
 * handling, % thresholds with and without an explicit `slaHours`.
 */

import type { ReactElement } from 'react';
import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { SlaBadge } from '../sla-badge.js';

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

const NOW = new Date('2026-01-15T12:00:00Z');

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(NOW);
});

afterEach(() => {
  while (mounted.length > 0) {
    mounted.pop()?.unmount();
  }
  vi.useRealTimers();
});

describe('SlaBadge — empty states', () => {
  it('returns null when status is not PENDING', () => {
    const { container } = renderInto(
      <SlaBadge slaDeadline="2099-12-31T00:00:00Z" status="APPROVED" />,
    );
    expect(container.innerHTML).toBe('');
  });

  it('returns null when slaDeadline is null', () => {
    const { container } = renderInto(<SlaBadge slaDeadline={null} status="PENDING" />);
    expect(container.innerHTML).toBe('');
  });
});

describe('SlaBadge — countdown label', () => {
  it('shows hours remaining for future deadline', () => {
    const deadline = new Date(NOW.getTime() + 10 * 3600000).toISOString();
    const { container } = renderInto(<SlaBadge slaDeadline={deadline} status="PENDING" />);
    expect(container.textContent).toContain('10h left');
  });

  it('shows OVERDUE for past deadline', () => {
    const deadline = new Date(NOW.getTime() - 5 * 3600000).toISOString();
    const { container } = renderInto(<SlaBadge slaDeadline={deadline} status="PENDING" />);
    expect(container.textContent ?? '').toMatch(/^OVERDUE \d+h$/);
  });

  it('rounds up partial hours (2.5h → 3h left)', () => {
    const deadline = new Date(NOW.getTime() + 2.5 * 3600000).toISOString();
    const { container } = renderInto(<SlaBadge slaDeadline={deadline} status="PENDING" />);
    expect(container.textContent).toContain('3h left');
  });
});

describe('SlaBadge — colour thresholds with slaHours', () => {
  it('green when >50% time remaining', () => {
    const deadline = new Date(NOW.getTime() + 20 * 3600000).toISOString();
    const { container } = renderInto(
      <SlaBadge slaDeadline={deadline} status="PENDING" slaHours={24} />,
    );
    expect(container.firstElementChild?.className).toContain('text-green');
  });

  it('amber when 25–50% time remaining', () => {
    const deadline = new Date(NOW.getTime() + 10 * 3600000).toISOString();
    const { container } = renderInto(
      <SlaBadge slaDeadline={deadline} status="PENDING" slaHours={24} />,
    );
    expect(container.firstElementChild?.className).toContain('text-amber');
  });

  it('destructive when <25% time remaining', () => {
    const deadline = new Date(NOW.getTime() + 4 * 3600000).toISOString();
    const { container } = renderInto(
      <SlaBadge slaDeadline={deadline} status="PENDING" slaHours={24} />,
    );
    expect(container.firstElementChild?.className).toContain('text-destructive');
  });

  it('overdue keeps destructive styling + border', () => {
    const deadline = new Date(NOW.getTime() - 2 * 3600000).toISOString();
    const { container } = renderInto(
      <SlaBadge slaDeadline={deadline} status="PENDING" slaHours={24} />,
    );
    const cls = container.firstElementChild?.className ?? '';
    expect(cls).toContain('text-destructive');
    expect(cls).toContain('border');
  });
});

describe('SlaBadge — fallback thresholds (no slaHours)', () => {
  it('green when >24h remaining', () => {
    const deadline = new Date(NOW.getTime() + 48 * 3600000).toISOString();
    const { container } = renderInto(<SlaBadge slaDeadline={deadline} status="PENDING" />);
    expect(container.firstElementChild?.className).toContain('text-green');
  });

  it('amber when 8–24h remaining', () => {
    const deadline = new Date(NOW.getTime() + 12 * 3600000).toISOString();
    const { container } = renderInto(<SlaBadge slaDeadline={deadline} status="PENDING" />);
    expect(container.firstElementChild?.className).toContain('text-amber');
  });

  it('destructive when <8h remaining', () => {
    const deadline = new Date(NOW.getTime() + 3 * 3600000).toISOString();
    const { container } = renderInto(<SlaBadge slaDeadline={deadline} status="PENDING" />);
    expect(container.firstElementChild?.className).toContain('text-destructive');
  });
});

describe('SlaBadge — visual polish', () => {
  it('uses tabular-nums for consistent digit width', () => {
    const deadline = new Date(NOW.getTime() + 5 * 3600000).toISOString();
    const { container } = renderInto(<SlaBadge slaDeadline={deadline} status="PENDING" />);
    expect(container.firstElementChild?.className).toContain('tabular-nums');
  });
});
