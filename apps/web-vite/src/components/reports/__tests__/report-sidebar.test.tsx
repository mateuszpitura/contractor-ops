/**
 * Step 10 port of apps/web/src/components/reports/__tests__/report-sidebar.test.tsx.
 *
 * `ReportSidebar` is fully presentational (props in, JSX out) — no tRPC,
 * no router. The legacy test mocked `next-intl`; the port resolves the
 * real ICU bundle via `setupTestI18n()` inside `mount()`.
 */

import { afterEach, describe, expect, it, vi } from 'vitest';

import { ReportSidebar } from '../report-sidebar.js';
import { click, findAllButtons, findByText, mount } from './_render.js';

afterEach(() => {
  document.body.innerHTML = '';
});

describe('ReportSidebar (web-vite)', () => {
  it('renders every report entry (mobile + desktop)', async () => {
    const { container } = await mount(
      <ReportSidebar activeReport="spend-contractor" onSelect={vi.fn()} />,
    );
    // Two nav lists (mobile pill bar + desktop sidebar) each carry one
    // button per report. 5 reports × 2 = 10 buttons.
    expect(findAllButtons(container).length).toBe(10);
  });

  it('marks the active entry with the active classes (desktop)', async () => {
    const { container } = await mount(
      <ReportSidebar activeReport="spend-team" onSelect={vi.fn()} />,
    );
    const desktopButtons = container.querySelectorAll('nav.hidden button');
    const activeButton = Array.from(desktopButtons).find(b =>
      b.className.includes('border-primary'),
    );
    expect(activeButton).toBeDefined();
    expect((activeButton?.textContent ?? '').trim().length).toBeGreaterThan(0);
  });

  it('invokes onSelect with the clicked report id', async () => {
    const onSelect = vi.fn();
    const { container } = await mount(
      <ReportSidebar activeReport="spend-contractor" onSelect={onSelect} />,
    );
    // Find a button on the desktop sidebar that is NOT the currently
    // active one and click it.
    const desktopButtons = Array.from(
      container.querySelectorAll<HTMLButtonElement>('nav.hidden button'),
    );
    const inactive = desktopButtons.find(b => !b.className.includes('border-primary'));
    expect(inactive).toBeDefined();
    await click(inactive as HTMLButtonElement);
    expect(onSelect).toHaveBeenCalledTimes(1);
    expect(typeof onSelect.mock.calls[0][0]).toBe('string');
    expect(['spend-team', 'expiring-contracts', 'overdue-invoices', 'compliance-gaps']).toContain(
      onSelect.mock.calls[0][0] as string,
    );
  });

  it('renders the mobile pill bar with the same number of report buttons', async () => {
    const { container } = await mount(
      <ReportSidebar activeReport="spend-contractor" onSelect={vi.fn()} />,
    );
    const mobileButtons = container.querySelectorAll('nav.lg\\:hidden button');
    expect(mobileButtons.length).toBe(5);
  });

  it('falls back to the i18n key text for each report label', async () => {
    // The labelKey values (`spendByContractor`, `spendByTeam`, …) are
    // present in the real Reports namespace, so setupTestI18n resolves them
    // to translated strings. Assert each maps to a non-empty rendered text.
    const { container } = await mount(
      <ReportSidebar activeReport="spend-contractor" onSelect={vi.fn()} />,
    );
    const desktopButtons = Array.from(container.querySelectorAll('nav.hidden button'));
    for (const btn of desktopButtons) {
      expect((btn.textContent ?? '').trim().length).toBeGreaterThan(0);
    }
  });

  it('switches the active border styling when activeReport prop changes', async () => {
    const { container, unmount } = await mount(
      <ReportSidebar activeReport="spend-contractor" onSelect={vi.fn()} />,
    );
    const firstActive = container.querySelector('nav.hidden button.border-primary');
    expect(firstActive).not.toBeNull();
    const firstActiveText = (firstActive?.textContent ?? '').trim();
    unmount();

    const second = await mount(
      <ReportSidebar activeReport="overdue-invoices" onSelect={vi.fn()} />,
    );
    const secondActive = second.container.querySelector('nav.hidden button.border-primary');
    expect(secondActive).not.toBeNull();
    expect((secondActive?.textContent ?? '').trim()).not.toBe(firstActiveText);
    expect(findByText(second.container, /./)).not.toBeNull();
  });
});
