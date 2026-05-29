import {
  Kanban,
  KanbanBoard,
  KanbanColumn,
  KanbanColumnContent,
  KanbanItem,
} from '@contractor-ops/ui/components/reui/kanban';

import { useDashboardContext } from '../layout/dashboard-context.js';
import type { BoardColumns, BoardItem } from './hooks/use-workflow-board.js';
import { useWorkflowBoard } from './hooks/use-workflow-board.js';

const COLUMN_LABELS: Record<string, string> = {
  todo: 'To do',
  in_progress: 'In progress',
  blocked: 'Blocked',
  done: 'Done',
};

const COLUMN_ORDER = ['todo', 'in_progress', 'blocked', 'done'];

function getBoardItemValue(item: BoardItem): string {
  return item.id;
}

// Decisive container: gates render on org context (board is org-scoped) and
// branches to an empty-state when every column is empty. Hook ships
// placeholder data today; the gates + empty branch survive the tRPC swap.
export function WorkflowBoardContainer() {
  const { activeOrg } = useDashboardContext();
  const { columns, handleMove } = useWorkflowBoard();

  if (!activeOrg) return null;
  if (isBoardEmpty(columns)) return <WorkflowBoardEmpty />;

  return (
    <Kanban<BoardItem> value={columns} onValueChange={handleMove} getItemValue={getBoardItemValue}>
      <KanbanBoard className="grid grid-cols-1 gap-4 md:grid-cols-4">
        {COLUMN_ORDER.map(columnId => (
          <KanbanColumn
            key={columnId}
            value={columnId}
            className="flex flex-col gap-2 rounded-lg border border-border bg-card/40 p-3">
            <header className="flex items-center justify-between">
              <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                {COLUMN_LABELS[columnId]}
              </h3>
              <span className="text-xs text-muted-foreground">{columns[columnId].length}</span>
            </header>
            <KanbanColumnContent value={columnId} className="flex flex-col gap-2">
              {columns[columnId].map(item => (
                <KanbanItem
                  key={item.id}
                  value={item.id}
                  className="cursor-grab rounded-md border border-border bg-background p-3 text-sm shadow-sm">
                  <div className="font-medium text-foreground">{item.title}</div>
                  {item.assignee ? (
                    <div className="mt-1 text-xs text-muted-foreground">{item.assignee}</div>
                  ) : null}
                </KanbanItem>
              ))}
            </KanbanColumnContent>
          </KanbanColumn>
        ))}
      </KanbanBoard>
    </Kanban>
  );
}

function isBoardEmpty(columns: BoardColumns): boolean {
  return COLUMN_ORDER.every(id => (columns[id]?.length ?? 0) === 0);
}

function WorkflowBoardEmpty() {
  return (
    <div className="flex min-h-[16rem] items-center justify-center rounded-lg border border-dashed border-border bg-muted/20 p-6 text-center">
      <div>
        <p className="text-sm font-medium text-foreground">No board tasks yet</p>
        <p className="mt-1 text-xs text-muted-foreground">
          Tasks created from workflow runs will appear here.
        </p>
      </div>
    </div>
  );
}
