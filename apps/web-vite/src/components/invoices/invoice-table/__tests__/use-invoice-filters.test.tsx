/**
 * Tests for the nuqs-backed `useInvoiceFilters` URL state hook.
 *
 * @testing-library/react + user-event are not declared dependencies of
 * apps/web-vite. To stay within the "no new deps" constraint we render
 * with `react-dom/client` + React's `act` directly and assert on the
 * values pulled out of the hook through a probe component.
 */

import { NuqsTestingAdapter } from 'nuqs/adapters/testing';
import { act } from 'react';
import type { Root } from 'react-dom/client';
import { createRoot } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { useInvoiceFilters } from '../use-invoice-filters.js';

type Probe = {
  state: ReturnType<typeof useInvoiceFilters>[0] | null;
  setPage: (n: number) => void;
};

function FiltersProbe({ probe }: { probe: Probe }) {
  const [state, setState] = useInvoiceFilters();
  probe.state = state;
  probe.setPage = (n: number) => {
    void setState({ page: n });
  };
  return null;
}

function renderWithAdapter(initialSearchParams: string, hasMemory = false) {
  const probe: Probe = { state: null, setPage: () => undefined };
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

describe('useInvoiceFilters', () => {
  it('exposes defaults when no search params are provided', () => {
    const { probe, cleanup } = renderWithAdapter('');
    cleanups.push(cleanup);
    expect(probe.state).not.toBeNull();
    expect(probe.state?.page).toBe(1);
    expect(probe.state?.pageSize).toBe(25);
    expect(probe.state?.search).toBe('');
    expect(probe.state?.sortBy).toBe('receivedAt');
    expect(probe.state?.sortOrder).toBe('desc');
    expect(probe.state?.status).toEqual([]);
    expect(probe.state?.matchStatus).toEqual([]);
    expect(probe.state?.contractorId).toBe('');
  });

  it('hydrates page, pageSize and search from initial searchParams', () => {
    const { probe, cleanup } = renderWithAdapter('?page=2&pageSize=50&search=hello');
    cleanups.push(cleanup);
    expect(probe.state?.page).toBe(2);
    expect(probe.state?.pageSize).toBe(50);
    expect(probe.state?.search).toBe('hello');
  });

  it('parses array params (status, matchStatus) from a comma-separated list', () => {
    const { probe, cleanup } = renderWithAdapter('?status=APPROVED,PAID&matchStatus=MATCHED');
    cleanups.push(cleanup);
    expect(probe.state?.status).toEqual(['APPROVED', 'PAID']);
    expect(probe.state?.matchStatus).toEqual(['MATCHED']);
  });

  it('updates page when setState is called (with hasMemory)', async () => {
    const { probe, cleanup } = renderWithAdapter('?page=1', true);
    cleanups.push(cleanup);
    expect(probe.state?.page).toBe(1);

    await act(async () => {
      probe.setPage(4);
    });

    expect(probe.state?.page).toBe(4);
  });
});
