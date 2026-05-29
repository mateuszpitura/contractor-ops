import { Button } from '@contractor-ops/ui/components/shadcn/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@contractor-ops/ui/components/shadcn/dialog';
import { Label } from '@contractor-ops/ui/components/shadcn/label';
import { ScrollArea } from '@contractor-ops/ui/components/shadcn/scroll-area';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@contractor-ops/ui/components/shadcn/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@contractor-ops/ui/components/shadcn/table';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@contractor-ops/ui/components/shadcn/tooltip';
import { AlertTriangle, Loader2 } from 'lucide-react';
import { memo, useCallback } from 'react';
import type { useJiraStatusMappingDialog } from './hooks/use-jira-status-mapping-dialog.js';
import { WORKFLOW_STATUSES } from './status-mapping.constants.js';

export type JiraStatusMappingDialogViewProps = ReturnType<typeof useJiraStatusMappingDialog>;

type JiraStatus = JiraStatusMappingDialogViewProps['jiraStatuses'][number];

interface StatusMappingRowProps {
  workflowStatusValue: string;
  workflowStatusLabel: string;
  isUnmapped: boolean;
  unmappedTooltip: string;
  isStatusesLoading: boolean;
  jiraStatuses: JiraStatus[];
  mappedId: string | undefined;
  notMappedLabel: string;
  onStatusSelect: (workflowStatus: string, jiraStatusId: string) => void;
}

const StatusMappingRow = memo(function StatusMappingRow({
  workflowStatusValue,
  workflowStatusLabel,
  isUnmapped,
  unmappedTooltip,
  isStatusesLoading,
  jiraStatuses,
  mappedId,
  notMappedLabel,
  onStatusSelect,
}: StatusMappingRowProps) {
  const handleValueChange = useCallback(
    (v: string | null) => {
      if (v) onStatusSelect(workflowStatusValue, v);
    },
    [workflowStatusValue, onStatusSelect],
  );
  return (
    <TableRow>
      <TableCell>
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
      </TableCell>
      <TableCell>
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
      </TableCell>
    </TableRow>
  );
});

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
          <ScrollArea className="max-h-[400px]">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t('workflowStatus')}</TableHead>
                  <TableHead>{t('jiraTransition')}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {WORKFLOW_STATUSES.map(ws => {
                  const mappedId = getMappedJiraStatusId(ws.value);
                  return (
                    <StatusMappingRow
                      key={ws.value}
                      workflowStatusValue={ws.value}
                      workflowStatusLabel={ws.label}
                      isUnmapped={!mappedId}
                      unmappedTooltip={unmappedTooltip}
                      isStatusesLoading={isStatusesLoading}
                      jiraStatuses={jiraStatuses}
                      mappedId={mappedId}
                      notMappedLabel={notMappedLabel}
                      onStatusSelect={handleStatusSelect}
                    />
                  );
                })}
              </TableBody>
            </Table>
          </ScrollArea>
        )}

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
