import { Button } from '@contractor-ops/ui/components/shadcn/button';
import {
  Dialog,
  DialogBody,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@contractor-ops/ui/components/shadcn/dialog';
import { Label } from '@contractor-ops/ui/components/shadcn/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@contractor-ops/ui/components/shadcn/select';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@contractor-ops/ui/components/shadcn/tooltip';
import type { ColumnDef } from '@tanstack/react-table';
import { AlertTriangle, Loader2 } from 'lucide-react';
import { memo, useCallback, useMemo, useState } from 'react';
import { tKey } from '../../i18n/typed-keys.js';
import { WorkbenchDataTable } from '../table-kit/workbench-data-table.js';
import { useLinearStatusMappingDialog } from './hooks/use-linear-status-mapping-dialog.js';
import { WORKFLOW_STATUS_VALUES } from './status-mapping.constants.js';

export type LinearStatusMappingDialogViewProps = ReturnType<typeof useLinearStatusMappingDialog>;

type LinearTeamState = LinearStatusMappingDialogViewProps['teamStates'][number];

interface WorkflowStatusCellProps {
  workflowStatusLabel: string;
  isUnmapped: boolean;
  unmappedTooltip: string;
}

const WorkflowStatusCell = memo(function WorkflowStatusCell({
  workflowStatusLabel,
  isUnmapped,
  unmappedTooltip,
}: WorkflowStatusCellProps) {
  return (
    <div className="flex items-center gap-2">
      <span className="text-sm font-medium">{workflowStatusLabel}</span>
      {isUnmapped && (
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger>
              <AlertTriangle className="size-3.5 text-warning" />
            </TooltipTrigger>
            <TooltipContent>{unmappedTooltip}</TooltipContent>
          </Tooltip>
        </TooltipProvider>
      )}
    </div>
  );
});

interface LinearStateSelectCellProps {
  workflowStatusValue: string;
  mappedId: string | undefined;
  isExistingMappingLoading: boolean;
  teamStates: LinearTeamState[];
  notMappedLabel: string;
  onStateSelect: (workflowStatus: string, stateId: string) => void;
}

const LinearStateSelectCell = memo(function LinearStateSelectCell({
  workflowStatusValue,
  mappedId,
  isExistingMappingLoading,
  teamStates,
  notMappedLabel,
  onStateSelect,
}: LinearStateSelectCellProps) {
  const handleValueChange = useCallback(
    (v: string | null) => {
      if (v) onStateSelect(workflowStatusValue, v);
    },
    [workflowStatusValue, onStateSelect],
  );
  return (
    <Select value={mappedId ?? undefined} onValueChange={handleValueChange}>
      <SelectTrigger className="w-full" loading={isExistingMappingLoading}>
        <SelectValue placeholder={notMappedLabel} />
      </SelectTrigger>
      <SelectContent>
        {teamStates.map(state => (
          <SelectItem key={state.id} value={state.id}>
            <div className="flex items-center gap-2">
              <span className="size-2 shrink-0 rounded-full" aria-hidden="true" />
              {state.name}
            </div>
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
});

interface WorkflowStatusRow {
  value: string;
  label: string;
}

const WS_LABEL_KEYS: Record<string, string> = {
  TODO: 'workflowStatus.todo',
  IN_PROGRESS: 'workflowStatus.inProgress',
  DONE: 'workflowStatus.done',
  BLOCKED: 'workflowStatus.blocked',
  SKIPPED: 'workflowStatus.skipped',
  CANCELLED: 'workflowStatus.cancelled',
};

export function LinearStatusMappingDialogView({
  open,
  onOpenChange,
  selectedTeamId,
  setSelectedTeamId,
  teamsQuery,
  teams,
  existingMappingQuery,
  selectedTeam,
  hasChanges,
  handleStateSelect,
  handleSave,
  getMappedStateId,
  saveMutation,
  teamStates,
  t,
  tI,
}: LinearStatusMappingDialogViewProps) {
  const handleTeamChange = useCallback(
    (v: string | null) => setSelectedTeamId(v),
    [setSelectedTeamId],
  );
  const handleDiscard = useCallback(() => onOpenChange(false), [onOpenChange]);

  const unmappedTooltip = t('unmappedTooltip');
  const notMappedLabel = tI('notMapped');
  const isExistingMappingLoading = existingMappingQuery.isLoading;

  const [pageIndex, setPageIndex] = useState(0);
  const [pageSize, setPageSize] = useState(25);

  const tableData = useMemo<WorkflowStatusRow[]>(
    () =>
      WORKFLOW_STATUS_VALUES.map(wsValue => ({
        value: wsValue,
        label: tKey(tI, WS_LABEL_KEYS[wsValue] ?? ''),
      })),
    [tI],
  );

  const columns = useMemo<ColumnDef<WorkflowStatusRow, unknown>[]>(
    () => [
      {
        id: 'workflowStatus',
        accessorKey: 'label',
        header: t('workflowStatus'),
        enableSorting: false,
        cell: ({ row }) => {
          const mappedId = getMappedStateId(row.original.value);
          return (
            <WorkflowStatusCell
              workflowStatusLabel={row.original.label}
              isUnmapped={!mappedId}
              unmappedTooltip={unmappedTooltip}
            />
          );
        },
      },
      {
        id: 'linearState',
        header: t('linearState'),
        enableSorting: false,
        cell: ({ row }) => (
          <LinearStateSelectCell
            workflowStatusValue={row.original.value}
            mappedId={getMappedStateId(row.original.value)}
            isExistingMappingLoading={isExistingMappingLoading}
            teamStates={teamStates}
            notMappedLabel={notMappedLabel}
            onStateSelect={handleStateSelect}
          />
        ),
      },
    ],
    [
      t,
      unmappedTooltip,
      notMappedLabel,
      isExistingMappingLoading,
      teamStates,
      getMappedStateId,
      handleStateSelect,
    ],
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>{t('title')}</DialogTitle>
          <DialogDescription>
            {selectedTeam ? t('description', { teamName: selectedTeam.name }) : t('selectTeam')}
          </DialogDescription>
        </DialogHeader>

        <DialogBody className="space-y-4">
          <div className="space-y-2">
            <Label>{t('selectTeam')}</Label>
            <Select value={selectedTeamId ?? undefined} onValueChange={handleTeamChange}>
              <SelectTrigger className="w-full" loading={teamsQuery.isLoading}>
                <SelectValue placeholder={t('selectTeam')} />
              </SelectTrigger>
              <SelectContent>
                {teams.map(team => (
                  <SelectItem key={team.id} value={team.id}>
                    {team.name} ({team.key})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {!teamsQuery.isLoading && teams.length === 0 && (
            <div className="rounded-md border border-dashed p-6 text-center">
              <p className="text-sm font-medium">{t('noTeams')}</p>
              <p className="mt-1 text-sm text-muted-foreground">{t('noTeamsBody')}</p>
            </div>
          )}

          {selectedTeamId && teamStates.length > 0 && (
            <div className="max-h-[400px] overflow-auto">
              <WorkbenchDataTable
                sectionClassName=""
                columns={columns}
                data={tableData}
                totalRows={tableData.length}
                clientPagination
                pageIndex={pageIndex}
                pageSize={pageSize}
                onPageChange={setPageIndex}
                onPageSizeChange={size => {
                  setPageSize(size);
                  setPageIndex(0);
                }}
                constrainHeight={false}
                hideDensityToggle
                hideChrome
                hideFooter
                getRowId={row => row.value}
                entityLabel={t('workflowStatus')}
                emptyTitle={t('workflowStatus')}
                noResultsTitle={t('workflowStatus')}
              />
            </div>
          )}
        </DialogBody>

        <DialogFooter>
          <Button variant="outline" onClick={handleDiscard}>
            {t('discard')}
          </Button>
          <Button
            onClick={handleSave}
            disabled={!hasChanges || saveMutation.isPending || !selectedTeamId}>
            {!!saveMutation.isPending && <Loader2 className="me-1.5 size-3.5 animate-spin" />}
            {saveMutation.isPending ? t('saving') : t('save')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

interface LinearStatusMappingDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function LinearStatusMappingDialog(props: LinearStatusMappingDialogProps) {
  const viewProps = useLinearStatusMappingDialog(props);
  return <LinearStatusMappingDialogView {...viewProps} />;
}
