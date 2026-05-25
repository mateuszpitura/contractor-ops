import { Label } from '@contractor-ops/ui/components/shadcn/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@contractor-ops/ui/components/shadcn/select';
import { Switch } from '@contractor-ops/ui/components/shadcn/switch';

import type { useLinearTaskConfig } from './hooks/use-linear-task-config.js';
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
  return (
    <div className="space-y-2">
      <div className="flex items-center gap-3">
        <div className="flex items-center gap-2">
          <Switch
            id={`linear-toggle-${taskTemplateId}`}
            checked={linearEnabled}
            // biome-ignore lint/nursery/noJsxPropsBind: controlled component handler
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
        <Select
          value={selectedTeamId ?? undefined}
          // biome-ignore lint/nursery/noJsxPropsBind: controlled component handler
          onValueChange={v => {
            if (v) handleTeamChange(v);
          }}>
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
