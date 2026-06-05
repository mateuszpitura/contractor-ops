/**
 * SeatCountCard renders the seat-usage tile in the billing dashboard:
 *   - "Active Seats" label + numeric value
 *   - overage warning when active > included
 *   - progressbar gauge for a11y
 */

import { afterEach, describe, expect, it } from 'vitest';

import { SeatCountCard } from '../seat-count-card.js';
import { findByText, mount } from './_render.js';

afterEach(() => {
  document.body.innerHTML = '';
});

describe('SeatCountCard (web-vite)', () => {
  it('renders the active-seats label and numeric count', async () => {
    await mount(<SeatCountCard activeContractors={5} includedSeats={10} seatPriceMinor={1500} />);
    expect(findByText(document.body, 'Active Seats')).not.toBeNull();
    expect(findByText(document.body, '5')).not.toBeNull();
  });

  it('omits the overage warning when active is within included seats', async () => {
    const { container } = await mount(
      <SeatCountCard activeContractors={5} includedSeats={10} seatPriceMinor={1500} />,
    );
    expect(container.textContent ?? '').not.toContain('additional seats');
  });

  it('renders the overage warning when active exceeds included seats', async () => {
    const { container } = await mount(
      <SeatCountCard activeContractors={12} includedSeats={10} seatPriceMinor={1500} />,
    );
    // Copy fragment is stable; numeric values depend on ICU interpolation
    // which may or may not run in jsdom — we only assert on the literal portion.
    expect(container.textContent ?? '').toContain('additional seats');
  });

  it('exposes the seat usage as a progressbar (a11y)', async () => {
    const { container } = await mount(
      <SeatCountCard activeContractors={5} includedSeats={10} seatPriceMinor={1500} />,
    );
    expect(container.querySelector('[role="progressbar"]')).not.toBeNull();
  });

  it('applies the warning ring class when active equals or exceeds 80% of included', async () => {
    const { container } = await mount(
      <SeatCountCard activeContractors={9} includedSeats={10} seatPriceMinor={1500} />,
    );
    const card = container.querySelector('[data-slot="card"]');
    expect(card?.className ?? '').toContain('warning');
  });

  it('applies the destructive ring class when active exceeds included seats', async () => {
    const { container } = await mount(
      <SeatCountCard activeContractors={12} includedSeats={10} seatPriceMinor={1500} />,
    );
    const card = container.querySelector('[data-slot="card"]');
    expect(card?.className ?? '').toContain('destructive');
  });
});
