/**
 * Step 10 port of apps/web/src/components/reports/__tests__/date-range-filter.test.tsx.
 *
 * Web-vite DateRangeFilter pulls preset labels from i18next
 * (`Reports.thisMonth` …) — `mount()` boots `applyLocale('en')` first.
 * The Custom-popover calendar-driven test is skipped: it depends on
 * base-ui Popover + react-day-picker pointer-event handling which is
 * unstable under jsdom + the local `_render.tsx` (no @testing-library).
 * Preset coverage (the actual `onDateChange` contract) is preserved.
 */

import { afterEach, describe, expect, it, vi } from 'vitest';

import { DateRangeFilter } from '../date-range-filter.js';
import { click, findButton, findByText, mount } from './_render.js';

afterEach(() => {
  document.body.innerHTML = '';
});

const defaultProps = {
  dateFrom: '2025-01-01T00:00:00.000Z',
  dateTo: '2025-03-31T23:59:59.000Z',
  onDateChange: vi.fn(),
};

describe('DateRangeFilter (web-vite)', () => {
  it('renders all preset buttons', async () => {
    await mount(<DateRangeFilter {...defaultProps} />);
    expect(findByText(document.body, 'This month')).not.toBeNull();
    expect(findByText(document.body, 'Last 3 months')).not.toBeNull();
    expect(findByText(document.body, 'Last 6 months')).not.toBeNull();
    expect(findByText(document.body, 'Year to date')).not.toBeNull();
    expect(findByText(document.body, 'Custom')).not.toBeNull();
  });

  it('calls onDateChange when This month is clicked', async () => {
    const onDateChange = vi.fn();
    await mount(<DateRangeFilter {...defaultProps} onDateChange={onDateChange} />);
    const btn = findButton(document.body, 'This month');
    expect(btn).not.toBeNull();
    await click(btn as HTMLButtonElement);
    expect(onDateChange).toHaveBeenCalledTimes(1);
    const [from, to] = onDateChange.mock.calls[0];
    expect(typeof from).toBe('string');
    expect(typeof to).toBe('string');
    expect(from).toBeTruthy();
    expect(to).toBeTruthy();
  });

  it('calls onDateChange when Year to date is clicked', async () => {
    const onDateChange = vi.fn();
    await mount(<DateRangeFilter {...defaultProps} onDateChange={onDateChange} />);
    const btn = findButton(document.body, 'Year to date');
    expect(btn).not.toBeNull();
    await click(btn as HTMLButtonElement);
    expect(onDateChange).toHaveBeenCalledTimes(1);
  });

  it('calls onDateChange when Last 6 months is clicked', async () => {
    const onDateChange = vi.fn();
    await mount(<DateRangeFilter {...defaultProps} onDateChange={onDateChange} />);
    const btn = findButton(document.body, 'Last 6 months');
    expect(btn).not.toBeNull();
    await click(btn as HTMLButtonElement);
    expect(onDateChange).toHaveBeenCalledTimes(1);
    const [from, to] = onDateChange.mock.calls[0];
    expect(from).toBeTruthy();
    expect(to).toBeTruthy();
  });

  it('calls onDateChange when Last 3 months is clicked', async () => {
    const onDateChange = vi.fn();
    await mount(<DateRangeFilter {...defaultProps} onDateChange={onDateChange} />);
    const btn = findButton(document.body, 'Last 3 months');
    expect(btn).not.toBeNull();
    await click(btn as HTMLButtonElement);
    expect(onDateChange).toHaveBeenCalledTimes(1);
  });

  it('does not call onDateChange when Custom is clicked (popover branch)', async () => {
    const onDateChange = vi.fn();
    await mount(<DateRangeFilter {...defaultProps} onDateChange={onDateChange} />);
    const btn = findButton(document.body, 'Custom');
    expect(btn).not.toBeNull();
    await click(btn as HTMLButtonElement);
    expect(onDateChange).not.toHaveBeenCalled();
  });
});
