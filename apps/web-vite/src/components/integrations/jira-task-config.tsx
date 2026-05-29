import { Button } from '@contractor-ops/ui/components/shadcn/button';
import { Label } from '@contractor-ops/ui/components/shadcn/label';
import { Switch } from '@contractor-ops/ui/components/shadcn/switch';

import type { useJiraTaskConfig } from './hooks/use-jira-task-config.js';
import { JiraProjectMappingDialog } from './jira-project-mapping-dialog-container.js';

export type JiraTaskConfigViewProps = Omit<ReturnType<typeof useJiraTaskConfig>, 'connection'> & {
  connection: NonNullable<ReturnType<typeof useJiraTaskConfig>['connection']>;
};

export function JiraTaskConfigView({
  taskTemplateId,
  connection,
  jiraEnabled,
  hasMappingConfigured,
  mappingSummary,
  handleToggle,
  saveMutation,
  dialogOpen,
  setDialogOpen,
  openConfigureDialog,
  t,
}: JiraTaskConfigViewProps) {
  return (
    <>
      <div className="flex items-center gap-3">
        <div className="flex items-center gap-2">
          <Switch
            id={`jira-toggle-${taskTemplateId}`}
            checked={jiraEnabled}
            onCheckedChange={handleToggle}
            disabled={!hasMappingConfigured || saveMutation.isPending}
          />
          <Label htmlFor={`jira-toggle-${taskTemplateId}`} className="cursor-pointer text-sm">
            {t('enableToggle')}
          </Label>
        </div>

        <span className={`flex-1 text-sm ${hasMappingConfigured ? '' : 'text-muted-foreground'}`}>
          {mappingSummary}
        </span>

        <Button variant="ghost" size="sm" onClick={openConfigureDialog}>
          {t('configure')}
        </Button>
      </div>

      <JiraProjectMappingDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        taskTemplateId={taskTemplateId}
        connectionId={connection.id}
      />
    </>
  );
}
