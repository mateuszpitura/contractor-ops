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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@contractor-ops/ui/components/shadcn/select';
import { Switch } from '@contractor-ops/ui/components/shadcn/switch';
import { Loader2 } from 'lucide-react';
import { useId } from 'react';

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

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{t('jira.projectMapping.title')}</DialogTitle>
          <DialogDescription>{t('jira.projectMapping.description')}</DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
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
