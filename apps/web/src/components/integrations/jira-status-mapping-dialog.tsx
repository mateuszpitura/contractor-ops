'use client';

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
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { AlertTriangle, Loader2 } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useEffect, useMemo, useState } from 'react';
import { toast } from 'sonner';
import { trpc } from '@/trpc/init';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const WORKFLOW_STATUSES = [
  { value: 'TODO', label: 'To Do' },
  { value: 'IN_PROGRESS', label: 'In Progress' },
  { value: 'DONE', label: 'Done' },
  { value: 'BLOCKED', label: 'Blocked' },
  { value: 'SKIPPED', label: 'Skipped' },
  { value: 'CANCELLED', label: 'Cancelled' },
] as const;

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface MappingEntry {
  workflowStatus: string;
  jiraTransitionId: string;
  jiraTransitionName: string;
  jiraTargetStatusName: string;
  jiraTargetStatusCategory: 'new' | 'indeterminate' | 'done';
}

interface JiraStatusMappingDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  connectionId: string;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function JiraStatusMappingDialog({
  open,
  onOpenChange,
  connectionId,
}: JiraStatusMappingDialogProps) {
  const t = useTranslations('Integrations.jira.statusMapping');
  const queryClient = useQueryClient();
  const [selectedProjectId, setSelectedProjectId] = useState<string | null>(null);
  const [mappings, setMappings] = useState<MappingEntry[]>([]);
  const [initialMappings, setInitialMappings] = useState<MappingEntry[]>([]);

  // ---- Fetch projects ----
  const projectsQuery = useQuery({
    ...trpc.jira.listProjects.queryOptions({ connectionId }),
    enabled: open,
  });
  const projects = (projectsQuery.data ?? []) as Array<{
    id: string;
    key: string;
    name: string;
  }>;

  // ---- Fetch project statuses ----
  const statusesQuery = useQuery({
    ...trpc.jira.listProjectStatuses.queryOptions({
      connectionId,
      projectId: selectedProjectId ?? '',
    }),
    enabled: !!selectedProjectId,
  });
  const jiraStatuses = (statusesQuery.data ?? []) as Array<{
    id: string;
    name: string;
    statusCategory: { key: string; name: string };
  }>;

  // ---- Fetch existing mapping ----
  const existingMappingQuery = useQuery({
    ...trpc.jira.getStatusMapping.queryOptions({
      connectionId,
      projectId: selectedProjectId ?? '',
    }),
    enabled: !!selectedProjectId,
  });

  // Initialize mappings from server data
  useEffect(() => {
    if (existingMappingQuery.data) {
      const serverMappings = existingMappingQuery.data as MappingEntry[];
      setMappings([...serverMappings]);
      setInitialMappings([...serverMappings]);
    } else if (selectedProjectId) {
      setMappings([]);
      setInitialMappings([]);
    }
  }, [existingMappingQuery.data, selectedProjectId]);

  // ---- Save mutation ----
  const saveMutation = useMutation({
    ...trpc.jira.saveStatusMapping.mutationOptions(),
    onSuccess: () => {
      toast.success(t('toast.saved'));
      queryClient.invalidateQueries({
        queryKey: trpc.jira.getStatusMapping.queryKey({
          connectionId,
          projectId: selectedProjectId ?? '',
        }),
      });
      onOpenChange(false);
    },
    onError: () => {
      toast.error(t('toast.saveFailed'));
    },
  });

  // ---- Derived state ----
  const selectedProject = projects.find(p => p.id === selectedProjectId);

  const hasChanges = useMemo(() => {
    if (mappings.length !== initialMappings.length) return true;
    return mappings.some((m, i) => {
      const initial = initialMappings[i];
      if (!initial) return true;
      return (
        m.workflowStatus !== initial.workflowStatus ||
        m.jiraTransitionId !== initial.jiraTransitionId
      );
    });
  }, [mappings, initialMappings]);

  // ---- Handlers ----
  function handleStatusSelect(workflowStatus: string, jiraStatusId: string) {
    const jiraStatus = jiraStatuses.find(s => s.id === jiraStatusId);
    if (!jiraStatus) return;

    setMappings(prev => {
      const existing = prev.findIndex(m => m.workflowStatus === workflowStatus);
      const entry: MappingEntry = {
        workflowStatus,
        jiraTransitionId: jiraStatus.id,
        jiraTransitionName: jiraStatus.name,
        jiraTargetStatusName: jiraStatus.name,
        jiraTargetStatusCategory: jiraStatus.statusCategory.key as 'new' | 'indeterminate' | 'done',
      };
      if (existing >= 0) {
        const next = [...prev];
        next[existing] = entry;
        return next;
      }
      return [...prev, entry];
    });
  }

  function handleSave() {
    if (!selectedProjectId) return;
    saveMutation.mutate({
      connectionId,
      projectId: selectedProjectId,
      mappings,
    });
  }

  function getMappedJiraStatusId(workflowStatus: string): string | undefined {
    return mappings.find(m => m.workflowStatus === workflowStatus)?.jiraTransitionId;
  }

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

        {/* Project selector */}
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

        {/* Status mapping table */}
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
