import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { NuqsTestingAdapter } from 'nuqs/adapters/testing';
import { describe, expect, it } from 'vitest';

import { useInvoiceFilters } from '../use-invoice-filters';

function FiltersProbe() {
  const [state, setState] = useInvoiceFilters();
  return (
    <div>
      <span data-testid="page">{state.page}</span>
      <span data-testid="pageSize">{state.pageSize}</span>
      <span data-testid="search">{state.search}</span>
      <button type="button" onClick={() => void setState({ page: 4 })}>
        setPage4
      </button>
    </div>
  );
}

describe('useInvoiceFilters', () => {
  it('hydrates page, pageSize, and search from initial searchParams', () => {
    render(
      <NuqsTestingAdapter searchParams="?page=2&pageSize=50&search=hello">
        <FiltersProbe />
      </NuqsTestingAdapter>,
    );

    expect(screen.getByTestId('page')).toHaveTextContent('2');
    expect(screen.getByTestId('pageSize')).toHaveTextContent('50');
    expect(screen.getByTestId('search')).toHaveTextContent('hello');
  });

  it('updates page when setState is called (hasMemory)', async () => {
    const user = userEvent.setup();
    render(
      <NuqsTestingAdapter searchParams="?page=1" hasMemory>
        <FiltersProbe />
      </NuqsTestingAdapter>,
    );

    expect(screen.getByTestId('page')).toHaveTextContent('1');

    await user.click(screen.getByRole('button', { name: /setpage4/i }));

    await waitFor(() => {
      expect(screen.getByTestId('page')).toHaveTextContent('4');
    });
  });
});
