/**
 * Tests for `useContractorFilters` — the nuqs URL-state hook driving the
 * contractor list filters. Adapted from the legacy
 * apps/web/src/components/invoices/invoice-table/__tests__/use-invoice-filters.test.tsx
 * pattern; the contractor side never had a legacy unit test, so this
 * fills a gap as part of the Step 10 port.
 *
 * Renders with `react-dom/client` + React's `act` directly because
 * apps/web-vite does not depend on @testing-library/react.
 */

import { NuqsTestingAdapter } from 'nuqs/adapters/testing';
import { act } from 'react';
import type { Root } from 'react-dom/client';
import { createRoot } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { useContractorFilters } from '../use-contractor-filters.js';

type State = ReturnType<typeof useContractorFilters>[0];
type Probe = {
  state: State | null;
  setSearch: (s: string) => void;
  setStatus: (s: string[]) => void;
};

function FiltersProbe({ probe }: { probe: Probe }) {
  const [state, setState] = useContractorFilters();
  probe.state = state;
  probe.setSearch = (s: string) => {
    void setState({ search: s });
  };
  probe.setStatus = (s: string[]) => {
    void setState({ status: s });
  };
  return null;
}

function renderWithAdapter(initialSearchParams: string, hasMemory = false) {
  const probe: Probe = {
    state: null,
    setSearch: () => undefined,
    setStatus: () => undefined,
  };
  const container = document.createElement('div');
  document.body.appendChild(container);
  let root: Root;
  void act(() => {
    root = createRoot(container);
    root.render(
      <NuqsTestingAdapter searchParams={initialSearchParams} hasMemory={hasMemory}>
        <FiltersProbe probe={probe} />
      </NuqsTestingAdapter>,
    );
  });
  return {
    probe,
    cleanup: () => {
      void act(() => {
        root.unmount();
      });
      container.remove();
    },
  };
}

let cleanups: Array<() => void> = [];

beforeEach(() => {
  cleanups = [];
});

afterEach(() => {
  for (const fn of cleanups) fn();
});

describe('useContractorFilters', () => {
  it('exposes documented defaults when no search params are provided', () => {
    const { probe, cleanup } = renderWithAdapter('');
    cleanups.push(cleanup);
    expect(probe.state?.page).toBe(1);
    expect(probe.state?.pageSize).toBe(25);
    expect(probe.state?.search).toBe('');
    expect(probe.state?.sortBy).toBe('createdAt');
    expect(probe.state?.sortOrder).toBe('desc');
    expect(probe.state?.status).toEqual([]);
    expect(probe.state?.lifecycleStage).toEqual([]);
    expect(probe.state?.type).toEqual([]);
    expect(probe.state?.owner).toEqual([]);
    expect(probe.state?.team).toEqual([]);
    expect(probe.state?.billingModel).toEqual([]);
    expect(probe.state?.health).toEqual([]);
  });

  it('hydrates scalar params from initial searchParams', () => {
    const { probe, cleanup } = renderWithAdapter(
      '?page=3&pageSize=50&search=acme&sortBy=name&sortOrder=asc',
    );
    cleanups.push(cleanup);
    expect(probe.state?.page).toBe(3);
    expect(probe.state?.pageSize).toBe(50);
    expect(probe.state?.search).toBe('acme');
    expect(probe.state?.sortBy).toBe('name');
    expect(probe.state?.sortOrder).toBe('asc');
  });

  it('hydrates array params (lifecycleStage, status, owner) from comma-separated lists', () => {
    const { probe, cleanup } = renderWithAdapter(
      '?lifecycleStage=DRAFT,ACTIVE&status=onboarded&owner=u1,u2',
    );
    cleanups.push(cleanup);
    expect(probe.state?.lifecycleStage).toEqual(['DRAFT', 'ACTIVE']);
    expect(probe.state?.status).toEqual(['onboarded']);
    expect(probe.state?.owner).toEqual(['u1', 'u2']);
  });

  it('updates search through setState (hasMemory)', async () => {
    const { probe, cleanup } = renderWithAdapter('', true);
    cleanups.push(cleanup);
    expect(probe.state?.search).toBe('');

    await act(async () => {
      probe.setSearch('foo bar');
    });

    expect(probe.state?.search).toBe('foo bar');
  });

  it('updates array params through setState (hasMemory)', async () => {
    const { probe, cleanup } = renderWithAdapter('', true);
    cleanups.push(cleanup);
    expect(probe.state?.status).toEqual([]);

    await act(async () => {
      probe.setStatus(['ACTIVE', 'ONBOARDING']);
    });

    expect(probe.state?.status).toEqual(['ACTIVE', 'ONBOARDING']);
  });
});
