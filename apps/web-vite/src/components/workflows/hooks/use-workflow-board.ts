import { useCallback, useState } from 'react';

export interface BoardItem {
  id: string;
  title: string;
  assignee?: string;
}

export type BoardColumns = Record<string, BoardItem[]>;

const INITIAL: BoardColumns = {
  todo: [
    { id: 'task-1', title: 'Review October invoices', assignee: 'Anna K.' },
    { id: 'task-2', title: 'Draft NDA renewal', assignee: 'Tomasz N.' },
  ],
  in_progress: [{ id: 'task-3', title: 'KSeF reconciliation Q4', assignee: 'Maria W.' }],
  blocked: [{ id: 'task-4', title: 'Awaiting tax-adviser sign-off', assignee: 'Jan Z.' }],
  done: [{ id: 'task-5', title: 'Onboard contractor #042', assignee: 'Anna K.' }],
};

export function useWorkflowBoard() {
  const [columns, setColumns] = useState<BoardColumns>(INITIAL);

  const handleMove = useCallback((next: BoardColumns) => {
    setColumns(next);
  }, []);

  return { columns, handleMove };
}
