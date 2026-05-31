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
import { Switch } from '@contractor-ops/ui/components/shadcn/switch';
import { Loader2 } from 'lucide-react';
import { useCallback, useId, useMemo } from 'react';

import type { useJiraProjectMappingDialog } from './hooks/use-jira-project-mapping-dialog.js';

export type JiraProjectMappingDialogViewProps = ReturnType<typeof useJiraProjectMappingDialog>;

export function JiraProjectMappingDialogView({
  open,
  onOpenChange,
  projectId,
  issueTypeId,
  jiraEnabled,
  setJiraEnabled,
  projectsQuery,
  projects,
  issueTypesQuery,
  issueTypes,
  hasChanges,
  handleProjectChange,
  handleIssueTypeChange,
  handleSave,
  saveMutation,
  t,
}: JiraProjectMappingDialogViewProps) {
  const reactId = useId();

  const handleEnabledChange = useCallback(
    (checked: boolean) => setJiraEnabled(checked),
    [setJiraEnabled],
  );
  const handleDiscard = useCallback(() => onOpenChange(false), [onOpenChange]);

  const projectsError = useMemo(
    () => (projectsQuery.error ? { message: t('jira.projectMapping.loadProjectsFailed') } : null),
    [projectsQuery.error, t],
  );
  const issueTypesError = useMemo(
    () =>
      issueTypesQuery.error ? { message: t('jira.projectMapping.loadIssueTypesFailed') } : null,
    [issueTypesQuery.error, t],
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{t('jira.projectMapping.title')}</DialogTitle>
          <DialogDescription>{t('jira.projectMapping.description')}</DialogDescription>
        </DialogHeader>

        <DialogBody className="space-y-4">
          <div className="space-y-2">
            <Label>{t('jira.projectMapping.jiraProject')}</Label>
            <Select value={projectId} onValueChange={handleProjectChange}>
              <SelectTrigger
                className="w-full"
                loading={projectsQuery.isLoading}
                error={projectsError}>
                <SelectValue placeholder={t('jira.projectMapping.selectProject')} />
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

          <div className="space-y-2">
            <Label>{t('jira.projectMapping.issueType')}</Label>
            <Select value={issueTypeId} onValueChange={handleIssueTypeChange} disabled={!projectId}>
              <SelectTrigger
                className="w-full"
                loading={issueTypesQuery.isLoading}
                error={issueTypesError}>
                <SelectValue placeholder={t('jira.projectMapping.selectIssueType')} />
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

          <div className="flex items-center justify-between gap-4 rounded-md border p-3">
            <Label htmlFor={`${reactId}-jira-auto-create`} className="cursor-pointer">
              {t('jira.taskConfig.enableToggle')}
            </Label>
            <Switch
              id={`${reactId}-jira-auto-create`}
              checked={jiraEnabled}
              onCheckedChange={handleEnabledChange}
            />
          </div>
        </DialogBody>

        <DialogFooter>
          <Button variant="outline" onClick={handleDiscard}>
            {t('jira.projectMapping.discardChanges')}
          </Button>
          <Button onClick={handleSave} disabled={!hasChanges || saveMutation.isPending}>
            {!!saveMutation.isPending && <Loader2 className="me-1.5 size-3.5 animate-spin" />}
            {t('jira.projectMapping.saveMapping')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
