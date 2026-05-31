// Phase 73 Wave 0 — Nyquist failing scaffold (web-vite)
// Maps to COMPL-01 admin dashboard; container lives in
// apps/web-vite/src/components/compliance/dashboard/compliance-dashboard-container.tsx (Plan 73-06).

import { describe, expect, it } from 'vitest';

// Vite resolves a static `await import('literal')` at transform time, which would
// fail the whole suite (collection error) instead of the assertion. Indirecting the
// specifier through a variable + `@vite-ignore` keeps the failure at runtime so the
// named test case fails as a deterministic Nyquist RED until Plan 73-06 lands the container.
const CONTAINER_PATH = '../compliance-dashboard-container';

describe('compliance-dashboard-container render', () => {
  it('exports a ComplianceDashboardContainer component', async () => {
    const mod = await import(/* @vite-ignore */ CONTAINER_PATH);
    expect(mod.ComplianceDashboardContainer).toBeTypeOf('function');
    throw new Error('ComplianceDashboardContainer not yet implemented');
  });

  it('renders 3 KPI cards (At risk, Upcoming renewals, Blocked payments) + 3 matching tabs', async () => {
    throw new Error('KPI cards + tab region not yet implemented');
  });
});

describe('compliance-dashboard-container default-tab-at-risk', () => {
  it('lands on "At risk" tab by default', async () => {
    throw new Error('default-tab semantics not yet implemented');
  });
});

describe('compliance-dashboard-container card-click-switches-tab', () => {
  it('clicking the "Upcoming renewals" KPI card switches the active tab', async () => {
    throw new Error('card-click tab switch not yet implemented');
  });
});

describe('compliance-dashboard-container blocked-payments-poll', () => {
  it('the blocked-payments hook query uses refetchInterval=60000', async () => {
    throw new Error('60s polling not yet implemented');
  });
});

describe('compliance-dashboard-container row-click-drilldown', () => {
  it('a row links to /contractors/{id}/compliance#item-{itemId} via the locale-aware Link', async () => {
    throw new Error('drilldown link not yet implemented');
  });
});

describe('compliance-dashboard-container ui-states', () => {
  it('renders loading skeleton / empty / error variants from the hook flags', async () => {
    throw new Error('loading/empty/error variants not yet implemented');
  });
});
