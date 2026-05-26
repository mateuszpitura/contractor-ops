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
import type { useJiraStatusMappingDialog } from './hooks/use-jira-status-mapping-dialog.js';
import { WORKFLOW_STATUSES } from './status-mapping.constants.js';

export type JiraStatusMappingDialogViewProps = ReturnType<typeof useJiraStatusMappingDialog>;

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
          <Select
            value={selectedProjectId ?? undefined}
            // biome-ignore lint/nursery/noJsxPropsBind: controlled component handler
            onValueChange={v => setSelectedProjectId(v as string)}>
            <SelectTrigger className="w-full">
              <SelectValue placeholder={t('selectProject')}>
                {!!projectsQuery.isLoading && <Loader2 className="size-3.5 animate-spin" />}
              </SelectValue>
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
                  const isUnmapped = !mappedId;

                  return (
                    <TableRow key={ws.value}>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-medium">{ws.label}</span>
                          {isUnmapped && (
                            <TooltipProvider>
                              <Tooltip>
                                <TooltipTrigger>
                                  <AlertTriangle className="size-3.5 text-warning" />
                                </TooltipTrigger>
                                <TooltipContent>{t('unmappedTooltip')}</TooltipContent>
                              </Tooltip>
                            </TooltipProvider>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        {statusesQuery.isLoading ? (
                          <Loader2 className="size-3.5 animate-spin" />
                        ) : (
                          <Select
                            value={mappedId ?? undefined}
                            // biome-ignore lint/nursery/noJsxPropsBind: controlled component handler
                            onValueChange={v => handleStatusSelect(ws.value, v as string)}>
                            <SelectTrigger className="w-full">
                              <SelectValue placeholder={t('notMapped')} />
                            </SelectTrigger>
                            <SelectContent>
                              {jiraStatuses.map(status => (
                                <SelectItem key={status.id} value={status.id}>
                                  {status.name}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        )}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </ScrollArea>
        )}

        <DialogFooter>
          {/* biome-ignore lint/nursery/noJsxPropsBind: dialog/popover state handler */}
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            {t('discardChanges')}
          </Button>
          <Button
            // biome-ignore lint/nursery/noJsxPropsBind: callback in JSX prop
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
