import { act, renderHook } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { useReportTableState } from '../use-report-table-state.js';

describe('useReportTableState', () => {
  it('calls onSortChange when sorting changes', () => {
    const onSortChange = vi.fn();
    const { result } = renderHook(() =>
      useReportTableState({
        sortBy: 'createdAt',
        sortOrder: 'desc',
        onSortChange,
      }),
    );

    act(() => {
      result.current.handleSortingChange([{ id: 'amount', desc: false }]);
    });

    expect(onSortChange).toHaveBeenCalledWith('amount', 'asc');
  });
});
