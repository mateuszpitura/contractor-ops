import { act, renderHook } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { useListDataTable } from '../use-list-data-table.js';

describe('useListDataTable', () => {
  it('calls onSortChange when sorting updates', () => {
    const onSortChange = vi.fn();
    const { result } = renderHook(() =>
      useListDataTable({
        storageKey: 'test-table-columns',
        filters: { sortBy: 'name', sortOrder: 'asc' },
        onSortChange,
        defaultSortBy: 'createdAt',
      }),
    );

    act(() => {
      result.current.handleSortingChange([{ id: 'email', desc: true }]);
    });

    expect(onSortChange).toHaveBeenCalledWith('email', 'desc');
  });
});
