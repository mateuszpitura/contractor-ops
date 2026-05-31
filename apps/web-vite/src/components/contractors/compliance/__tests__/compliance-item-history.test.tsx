// Phase 73 · Plan 08 — compliance item history disclosure tests (D-13).

import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';

import { applyLocale, initI18n } from '../../../../i18n/index.js';
import { mount } from './_render.js';

const useComplianceItemHistoryMock = vi.fn();
vi.mock('../hooks/use-compliance-item-history.js', () => ({
  useComplianceItemHistory: (itemId: string, enabled: boolean) =>
    useComplianceItemHistoryMock(itemId, enabled),
}));
// useDateFormatter reads org settings via tRPC — stub it so the test needs no provider.
vi.mock('../../../../lib/format/use-date-formatter.js', () => ({
  useDateFormatter: () => ({
    formatDate: (d: Date) => d.toISOString().slice(0, 10),
    formatTime: (d: Date) => d.toISOString(),
    formatDateTime: (d: Date) => d.toISOString(),
  }),
}));

import { ComplianceItemHistory } from '../compliance-item-history.js';

beforeAll(async () => {
  initI18n();
  await applyLocale('en');
});

afterEach(() => {
  document.body.innerHTML = '';
  vi.clearAllMocks();
});

describe('compliance-item-history', () => {
  it('exports a ComplianceItemHistory component and renders a History toggle', async () => {
    useComplianceItemHistoryMock.mockReturnValue({
      isPending: false,
      error: null,
      isEmpty: false,
      entries: [],
    });
    const { container } = await mount(<ComplianceItemHistory itemId="item_1" />);
    expect(container.textContent).toMatch(/history/i);
  });

  it('renders the audit-log entries when expanded (timeline)', async () => {
    useComplianceItemHistoryMock.mockReturnValue({
      isPending: false,
      error: null,
      isEmpty: false,
      entries: [
        {
          id: 'a1',
          action: 'compliance.item.overridden',
          actorName: 'Admin Jane',
          createdAt: new Date('2026-05-01T10:00:00Z'),
        },
      ],
    });
    const { container } = await mount(<ComplianceItemHistory itemId="item_1" />);
    const trigger = container.querySelector('button');
    const { act } = await import('react');
    await act(async () => {
      trigger?.click();
    });
    expect(container.textContent).toMatch(/Admin Jane/);
  });

  it('renders an empty state inside the disclosure when there are no entries', async () => {
    useComplianceItemHistoryMock.mockReturnValue({
      isPending: false,
      error: null,
      isEmpty: true,
      entries: [],
    });
    const { container } = await mount(<ComplianceItemHistory itemId="item_1" />);
    const trigger = container.querySelector('button');
    const { act } = await import('react');
    await act(async () => {
      trigger?.click();
    });
    expect(container.textContent).toMatch(/no history/i);
  });
});
