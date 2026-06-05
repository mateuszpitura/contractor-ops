/**
 * In web-vite, Stripe price ids read from `import.meta.env.VITE_STRIPE_PRICE_*`.
 * vitest exposes `vi.stubEnv` for `import.meta.env`, but the PLANS array
 * is captured at module load — we stub via the top-level test setup using
 * `vi.hoisted` so the constants resolve to non-empty price ids when the
 * component imports.
 */

import { describe, expect, it, vi } from 'vitest';

// PLANS in plan-comparison-grid.tsx captures `import.meta.env.VITE_STRIPE_PRICE_*`
// at module load. We need to stub the env BEFORE the module is imported, so
// the stubs run via `vi.hoisted` and we use a dynamic import below.
vi.hoisted(() => {
  // biome-ignore lint/correctness/noUndeclaredVariables: vitest globals
  vi.stubEnv('VITE_STRIPE_PRICE_STARTER', 'price_starter_test');
  vi.stubEnv('VITE_STRIPE_PRICE_PRO', 'price_pro_test');
  vi.stubEnv('VITE_STRIPE_PRICE_ENTERPRISE', 'price_enterprise_test');
});

import { render, screen, setup } from '@/test/test-utils';

import { PlanComparisonGrid } from '../plan-comparison-grid';

describe('PlanComparisonGrid (web-vite)', () => {
  it('renders all three plan tiers', () => {
    render(<PlanComparisonGrid onSelectPlan={vi.fn()} />);
    expect(screen.getByText('Starter')).toBeInTheDocument();
    expect(screen.getByText('Pro')).toBeInTheDocument();
    expect(screen.getByText('Enterprise')).toBeInTheDocument();
  });

  it('has an accessible radiogroup role with localized aria-label', () => {
    render(<PlanComparisonGrid onSelectPlan={vi.fn()} />);
    expect(screen.getByRole('radiogroup')).toHaveAttribute('aria-label', 'Select a plan');
  });

  it('renders three plan cards', () => {
    const { container } = render(<PlanComparisonGrid onSelectPlan={vi.fn()} />);
    const grid = container.querySelector("[role='radiogroup']");
    expect(grid?.children.length).toBe(3);
  });

  it("shows 'current plan' CTA for the current tier", () => {
    render(<PlanComparisonGrid currentTier="PRO" onSelectPlan={vi.fn()} />);
    expect(screen.getByRole('button', { name: /current plan/i })).toBeInTheDocument();
  });

  it('renders Choose a plan CTAs for every plan when no current tier', () => {
    render(<PlanComparisonGrid onSelectPlan={vi.fn()} />);
    const buttons = screen.getAllByRole('button', { name: /choose a plan/i });
    expect(buttons.length).toBe(3);
  });

  it('renders plan descriptions', () => {
    render(<PlanComparisonGrid onSelectPlan={vi.fn()} />);
    expect(screen.getByText('Everything you need to manage contractors')).toBeInTheDocument();
    expect(screen.getByText('Integrations, OCR, and advanced workflows')).toBeInTheDocument();
  });

  it('renders Enterprise plan features including API access', () => {
    render(<PlanComparisonGrid onSelectPlan={vi.fn()} />);
    expect(screen.getByText('Everything in Pro')).toBeInTheDocument();
    expect(screen.getAllByText('API access').length).toBeGreaterThanOrEqual(1);
  });

  it('marks Enterprise tier as current when currentTier is ENTERPRISE', () => {
    render(<PlanComparisonGrid currentTier="ENTERPRISE" onSelectPlan={vi.fn()} />);
    expect(screen.getByRole('button', { name: /current plan/i })).toBeInTheDocument();
  });

  it('calls onSelectPlan once when a plan button is clicked', async () => {
    const onSelectPlan = vi.fn();
    const { user } = setup(<PlanComparisonGrid onSelectPlan={onSelectPlan} />);
    const buttons = screen.getAllByRole('button', { name: /choose a plan/i });
    await user.click(buttons[0]);
    expect(onSelectPlan).toHaveBeenCalledTimes(1);
  });

  it('calls onSelectPlan for each plan button click', async () => {
    const onSelectPlan = vi.fn();
    const { user } = setup(<PlanComparisonGrid onSelectPlan={onSelectPlan} />);
    const buttons = screen.getAllByRole('button', { name: /choose a plan/i });
    await user.click(buttons[0]);
    await user.click(buttons[1]);
    await user.click(buttons[2]);
    expect(onSelectPlan).toHaveBeenCalledTimes(3);
  });

  it('disables plan buttons while isSelecting', () => {
    render(<PlanComparisonGrid currentTier="STARTER" onSelectPlan={vi.fn()} isSelecting />);
    // Pro + Enterprise are both upgrades from STARTER; isSelecting disables both.
    const upgradeButtons = screen.getAllByRole('button', { name: /upgrade plan/i });
    expect(upgradeButtons.length).toBeGreaterThan(0);
    for (const btn of upgradeButtons) expect(btn).toBeDisabled();
  });

  it('renders Pro plan description for compact mode', () => {
    render(<PlanComparisonGrid onSelectPlan={vi.fn()} compact />);
    expect(screen.getByText('Integrations, OCR, and advanced workflows')).toBeInTheDocument();
  });
});
