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
import { WorkbenchDataTable } from '../table-kit/workbench-data-table.js';
import type { MappingEntry } from './hooks/use-jira-status-mapping-dialog.js';
import { useJiraStatusMappingDialog } from './hooks/use-jira-status-mapping-dialog.js';
import { WORKFLOW_STATUSES } from './status-mapping.constants.js';

export type JiraStatusMappingDialogViewProps = ReturnType<typeof useJiraStatusMappingDialog>;

type JiraStatus = JiraStatusMappingDialogViewProps['jiraStatuses'][number];

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

interface JiraStatusSelectCellProps {
  workflowStatusValue: MappingEntry['workflowStatus'];
  mappedId: string | undefined;
  isStatusesLoading: boolean;
  jiraStatuses: JiraStatus[];
  notMappedLabel: string;
  onStatusSelect: (workflowStatus: MappingEntry['workflowStatus'], jiraStatusId: string) => void;
}

const JiraStatusSelectCell = memo(function JiraStatusSelectCell({
  workflowStatusValue,
  mappedId,
  isStatusesLoading,
  jiraStatuses,
  notMappedLabel,
  onStatusSelect,
}: JiraStatusSelectCellProps) {
  const handleValueChange = useCallback(
    (v: string | null) => {
      if (v) onStatusSelect(workflowStatusValue, v);
    },
    [workflowStatusValue, onStatusSelect],
  );
  return (
    <Select value={mappedId ?? undefined} onValueChange={handleValueChange}>
      <SelectTrigger className="w-full" loading={isStatusesLoading}>
        <SelectValue placeholder={notMappedLabel} />
      </SelectTrigger>
      <SelectContent>
        {jiraStatuses.map(status => (
          <SelectItem key={status.id} value={status.id}>
            {status.name}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
});

type WorkflowStatusRow = (typeof WORKFLOW_STATUSES)[number];

export function JiraStatusMappingDialogView({
  open,
  onOpenChange,
  selectedProjectId,
  setSelectedProjectId,
  projectsQuery,
  projects,
  statusesQuery,
  jiraStatuses,
  selectedProject,
  hasChanges,
  handleStatusSelect,
  handleSave,
  getMappedJiraStatusId,
  saveMutation,
  t,
}: JiraStatusMappingDialogViewProps) {
  const handleProjectChange = useCallback(
    (v: string | null) => setSelectedProjectId(v),
    [setSelectedProjectId],
  );
  const handleDiscard = useCallback(() => onOpenChange(false), [onOpenChange]);

  const unmappedTooltip = t('unmappedTooltip');
  const notMappedLabel = t('notMapped');
  const isStatusesLoading = statusesQuery.isLoading;

  const [pageIndex, setPageIndex] = useState(0);
  const [pageSize, setPageSize] = useState(25);

  const columns = useMemo<ColumnDef<WorkflowStatusRow, unknown>[]>(
    () => [
      {
        id: 'workflowStatus',
        accessorKey: 'label',
        header: t('workflowStatus'),
        enableSorting: false,
        cell: ({ row }) => {
          const mappedId = getMappedJiraStatusId(row.original.value);
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
        id: 'jiraTransition',
        header: t('jiraTransition'),
        enableSorting: false,
        cell: ({ row }) => (
          <JiraStatusSelectCell
            workflowStatusValue={row.original.value}
            mappedId={getMappedJiraStatusId(row.original.value)}
            isStatusesLoading={isStatusesLoading}
            jiraStatuses={jiraStatuses}
            notMappedLabel={notMappedLabel}
            onStatusSelect={handleStatusSelect}
          />
        ),
      },
    ],
    [
      t,
      unmappedTooltip,
      notMappedLabel,
      isStatusesLoading,
      jiraStatuses,
      getMappedJiraStatusId,
      handleStatusSelect,
    ],
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>{t('title')}</DialogTitle>
          <DialogDescription>
            {selectedProject
              ? t('description', { projectName: selectedProject.name })
              : t('descriptionDefault')}
          </DialogDescription>
        </DialogHeader>

        <DialogBody className="space-y-4">
          <div className="space-y-2">
            <Label>{t('jiraProject')}</Label>
            <Select value={selectedProjectId ?? undefined} onValueChange={handleProjectChange}>
              <SelectTrigger className="w-full" loading={projectsQuery.isLoading}>
                <SelectValue placeholder={t('selectProject')} />
              </SelectTrigger>
              <SelectContent>
                {projects.map(project => (
                  <SelectItem key={project.id} value={project.id}>
                    {project.key} — {project.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {!!selectedProjectId && (
            <div className="max-h-[400px] overflow-auto">
              <WorkbenchDataTable
                sectionClassName=""
                columns={columns}
                data={WORKFLOW_STATUSES as unknown as WorkflowStatusRow[]}
                totalRows={WORKFLOW_STATUSES.length}
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
            {t('discardChanges')}
          </Button>
          <Button
            onClick={handleSave}
            disabled={!hasChanges || saveMutation.isPending || !selectedProjectId}>
            {!!saveMutation.isPending && <Loader2 className="me-1.5 size-3.5 animate-spin" />}
            {t('saveMapping')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

interface JiraStatusMappingDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  connectionId: string;
}

export function JiraStatusMappingDialog(props: JiraStatusMappingDialogProps) {
  const viewProps = useJiraStatusMappingDialog(props);
  return <JiraStatusMappingDialogView {...viewProps} />;
}
