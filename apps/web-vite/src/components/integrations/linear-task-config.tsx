import { Label } from '@contractor-ops/ui/components/shadcn/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@contractor-ops/ui/components/shadcn/select';
import { Switch } from '@contractor-ops/ui/components/shadcn/switch';
import { useCallback } from 'react';

import { useLinearTaskConfig } from './hooks/use-linear-task-config.js';
import { LinearLogo } from './linear-logo.js';

export type LinearTaskConfigViewProps = Omit<
  ReturnType<typeof useLinearTaskConfig>,
  'connection' | 'isConnected'
>;

export function LinearTaskConfigView({
  taskTemplateId,
  teams,
  linearEnabled,
  selectedTeamId,
  handleToggle,
  handleTeamChange,
  saveMutation,
  teamSummary,
  t,
}: LinearTaskConfigViewProps) {
  const handleTeamValueChange = useCallback(
    (v: string | null) => {
      if (v) handleTeamChange(v);
    },
    [handleTeamChange],
  );

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-3">
        <div className="flex items-center gap-2">
          <Switch
            id={`linear-toggle-${taskTemplateId}`}
            checked={linearEnabled}
            onCheckedChange={handleToggle}
            disabled={!selectedTeamId || saveMutation.isPending}
          />
          <Label htmlFor={`linear-toggle-${taskTemplateId}`} className="cursor-pointer text-sm">
            {t('enableToggle')}
          </Label>
        </div>

        <span className={`flex-1 text-sm ${selectedTeamId ? '' : 'text-muted-foreground'}`}>
          {teamSummary}
        </span>
      </div>

      <div className="flex items-center gap-2">
        <LinearLogo className="size-4" />
        <Label className="text-sm">{t('teamLabel')}</Label>
        <Select value={selectedTeamId ?? undefined} onValueChange={handleTeamValueChange}>
          <SelectTrigger className="w-[200px]">
            <SelectValue placeholder={t('teamPlaceholder')} />
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
    </div>
  );
}

interface LinearTaskConfigProps {
  taskTemplateId: string;
}

export function LinearTaskConfig({ taskTemplateId }: LinearTaskConfigProps) {
  const { connection, isConnected, ...rest } = useLinearTaskConfig(taskTemplateId);
  if (!(connection && isConnected)) return null;
  return <LinearTaskConfigView {...rest} />;
}
