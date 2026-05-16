'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Loader2 } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useEffect, useId, useMemo, useState } from 'react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { trpc } from '@/trpc/init';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface JiraProjectMappingDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  taskTemplateId: string;
  connectionId: string;
}

interface TaskConfig {
  jiraEnabled: boolean;
  jiraProjectId?: string;
  jiraProjectKey?: string;
  jiraProjectName?: string;
  jiraIssueTypeId?: string;
  jiraIssueTypeName?: string;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function JiraProjectMappingDialog({
  open,
  onOpenChange,
  taskTemplateId,
  connectionId,
}: JiraProjectMappingDialogProps) {
  const queryClient = useQueryClient();
  const reactId = useId();
  const t = useTranslations('Integrations');

  // ---- Local state ----
  const [projectId, setProjectId] = useState<string | undefined>(undefined);
  const [projectKey, setProjectKey] = useState<string | undefined>(undefined);
  const [projectName, setProjectName] = useState<string | undefined>(undefined);
  const [issueTypeId, setIssueTypeId] = useState<string | undefined>(undefined);
  const [issueTypeName, setIssueTypeName] = useState<string | undefined>(undefined);
  const [jiraEnabled, setJiraEnabled] = useState(false);
  const [initialConfig, setInitialConfig] = useState<TaskConfig | null>(null);

  // ---- Fetch existing config ----
  const configQuery = useQuery({
    ...trpc.jira.getTaskConfig.queryOptions({ taskTemplateId }),
    enabled: open,
  });

  // Initialize from server data
  useEffect(() => {
    if (configQuery.data) {
      const config = configQuery.data as TaskConfig;
      setProjectId(config.jiraProjectId);
      setProjectKey(config.jiraProjectKey);
      setProjectName(config.jiraProjectName);
      setIssueTypeId(config.jiraIssueTypeId);
      setIssueTypeName(config.jiraIssueTypeName);
      setJiraEnabled(config.jiraEnabled ?? false);
      setInitialConfig(config);
    }
  }, [configQuery.data]);

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

  // ---- Fetch issue types ----
  const issueTypesQuery = useQuery({
    ...trpc.jira.listIssueTypes.queryOptions({
      connectionId,
      projectId: projectId ?? '',
    }),
    enabled: !!projectId,
  });
  const issueTypes = (issueTypesQuery.data ?? []) as Array<{
    id: string;
    name: string;
  }>;

  // ---- Save mutation ----
  const saveMutation = useMutation({
    ...trpc.jira.saveTaskConfig.mutationOptions(),
    onSuccess: () => {
      toast.success(t('jira.projectMapping.toast.saved'));
      queryClient.invalidateQueries({
        queryKey: trpc.jira.getTaskConfig.queryKey({ taskTemplateId }),
      });
      onOpenChange(false);
    },
    onError: () => {
      toast.error(t('jira.projectMapping.toast.saveFailed'));
    },
  });

  // ---- Derived state ----
  const hasChanges = useMemo(() => {
    if (!initialConfig) return true;
    return (
      projectId !== initialConfig.jiraProjectId ||
      issueTypeId !== initialConfig.jiraIssueTypeId ||
      jiraEnabled !== initialConfig.jiraEnabled
    );
  }, [projectId, issueTypeId, jiraEnabled, initialConfig]);

  // ---- Handlers ----
  function handleProjectChange(value: string | null) {
    if (!value) return;
    const project = projects.find(p => p.id === value);
    if (project) {
      setProjectId(project.id);
      setProjectKey(project.key);
      setProjectName(project.name);
      // Reset issue type when project changes
      setIssueTypeId(undefined);
      setIssueTypeName(undefined);
    }
  }

  function handleIssueTypeChange(value: string | null) {
    if (!value) return;
    const issueType = issueTypes.find(t => t.id === value);
    if (issueType) {
      setIssueTypeId(issueType.id);
      setIssueTypeName(issueType.name);
    }
  }

  function handleSave() {
    saveMutation.mutate({
      taskTemplateId,
      config: {
        jiraEnabled,
        jiraProjectId: projectId,
        jiraProjectKey: projectKey,
        jiraProjectName: projectName,
        jiraIssueTypeId: issueTypeId,
        jiraIssueTypeName: issueTypeName,
      },
    });
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{t('jira.projectMapping.title')}</DialogTitle>
          <DialogDescription>{t('jira.projectMapping.description')}</DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Jira Project selector */}
          <div className="space-y-2">
            <Label>{t('jira.projectMapping.jiraProject')}</Label>
            {/* biome-ignore lint/nursery/noJsxPropsBind: controlled component handler */}
            <Select value={projectId} onValueChange={handleProjectChange}>
              <SelectTrigger className="w-full">
                <SelectValue placeholder={t('jira.projectMapping.selectProject')}>
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

          {/* Issue Type selector */}
          <div className="space-y-2">
            <Label>{t('jira.projectMapping.issueType')}</Label>
            {/* biome-ignore lint/nursery/noJsxPropsBind: controlled component handler */}
            <Select value={issueTypeId} onValueChange={handleIssueTypeChange} disabled={!projectId}>
              <SelectTrigger className="w-full">
                <SelectValue placeholder={t('jira.projectMapping.selectIssueType')}>
                  {!!issueTypesQuery.isLoading && <Loader2 className="size-3.5 animate-spin" />}
                </SelectValue>
              </SelectTrigger>
              <SelectContent>
                {issueTypes.map(type => (
                  <SelectItem key={type.id} value={type.id}>
                    {type.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Auto-create switch */}
          <div className="flex items-center justify-between gap-4 rounded-md border p-3">
            <Label htmlFor={`${reactId}-jira-auto-create`} className="cursor-pointer">
              {t('jira.taskConfig.enableToggle')}
            </Label>
            <Switch
              id={`${reactId}-jira-auto-create`}
              checked={jiraEnabled}
              // biome-ignore lint/nursery/noJsxPropsBind: controlled component handler
              onCheckedChange={checked => setJiraEnabled(checked as boolean)}
            />
          </div>
        </div>

        <DialogFooter>
          {/* biome-ignore lint/nursery/noJsxPropsBind: dialog/popover state handler */}
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            {t('jira.projectMapping.discardChanges')}
          </Button>
          {/* biome-ignore lint/nursery/noJsxPropsBind: callback in JSX prop */}
          <Button onClick={handleSave} disabled={!hasChanges || saveMutation.isPending}>
            {!!saveMutation.isPending && <Loader2 className="me-1.5 size-3.5 animate-spin" />}
            {t('jira.projectMapping.saveMapping')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
