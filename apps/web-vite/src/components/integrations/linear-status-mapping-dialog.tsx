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

import { tKey } from '../../i18n/typed-keys.js';
import type { useLinearStatusMappingDialog } from './hooks/use-linear-status-mapping-dialog.js';
import { WORKFLOW_STATUS_VALUES } from './status-mapping.constants.js';

export type LinearStatusMappingDialogViewProps = ReturnType<typeof useLinearStatusMappingDialog>;

type LinearTeamState = LinearStatusMappingDialogViewProps['teamStates'][number];

interface StateMappingRowProps {
  workflowStatusValue: string;
  workflowStatusLabel: string;
  isUnmapped: boolean;
  unmappedTooltip: string;
  isExistingMappingLoading: boolean;
  teamStates: LinearTeamState[];
  mappedId: string | undefined;
  notMappedLabel: string;
  onStateSelect: (workflowStatus: string, stateId: string) => void;
}

const StateMappingRow = memo(function StateMappingRow({
  workflowStatusValue,
  workflowStatusLabel,
  isUnmapped,
  unmappedTooltip,
  isExistingMappingLoading,
  teamStates,
  mappedId,
  notMappedLabel,
  onStateSelect,
}: StateMappingRowProps) {
  const handleValueChange = useCallback(
    (v: string | null) => {
      if (v) onStateSelect(workflowStatusValue, v);
    },
    [workflowStatusValue, onStateSelect],
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
          <SelectTrigger className="w-full" loading={isExistingMappingLoading}>
            <SelectValue placeholder={notMappedLabel} />
          </SelectTrigger>
          <SelectContent>
            {teamStates.map(state => (
              <SelectItem key={state.id} value={state.id}>
                <div className="flex items-center gap-2">
                  <span className="size-2 shrink-0 rounded-full" aria-hidden="true" />
                  {state.name}
                </div>
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </TableCell>
    </TableRow>
  );
});

const WS_LABEL_KEYS: Record<string, string> = {
  TODO: 'workflowStatus.todo',
  IN_PROGRESS: 'workflowStatus.inProgress',
  DONE: 'workflowStatus.done',
  BLOCKED: 'workflowStatus.blocked',
  SKIPPED: 'workflowStatus.skipped',
  CANCELLED: 'workflowStatus.cancelled',
};

export function LinearStatusMappingDialogView({
  open,
  onOpenChange,
  selectedTeamId,
  setSelectedTeamId,
  teamsQuery,
  teams,
  existingMappingQuery,
  selectedTeam,
  hasChanges,
  handleStateSelect,
  handleSave,
  getMappedStateId,
  saveMutation,
  teamStates,
  t,
  tI,
}: LinearStatusMappingDialogViewProps) {
  const handleTeamChange = useCallback(
    (v: string | null) => setSelectedTeamId(v),
    [setSelectedTeamId],
  );
  const handleDiscard = useCallback(() => onOpenChange(false), [onOpenChange]);

  const unmappedTooltip = t('unmappedTooltip');
  const notMappedLabel = tI('notMapped');
  const isExistingMappingLoading = existingMappingQuery.isLoading;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>{t('title')}</DialogTitle>
          <DialogDescription>
            {selectedTeam ? t('description', { teamName: selectedTeam.name }) : t('selectTeam')}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-2">
          <Label>{t('selectTeam')}</Label>
          <Select value={selectedTeamId ?? undefined} onValueChange={handleTeamChange}>
            <SelectTrigger className="w-full" loading={teamsQuery.isLoading}>
              <SelectValue placeholder={t('selectTeam')} />
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

        {!teamsQuery.isLoading && teams.length === 0 && (
          <div className="rounded-md border border-dashed p-6 text-center">
            <p className="text-sm font-medium">{t('noTeams')}</p>
            <p className="mt-1 text-sm text-muted-foreground">{t('noTeamsBody')}</p>
          </div>
        )}

        {selectedTeamId && teamStates.length > 0 && (
          <ScrollArea className="max-h-[400px]">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t('workflowStatus')}</TableHead>
                  <TableHead>{t('linearState')}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {WORKFLOW_STATUS_VALUES.map(wsValue => {
                  const mappedId = getMappedStateId(wsValue);
                  const wsLabelKey = WS_LABEL_KEYS[wsValue] ?? '';
                  return (
                    <StateMappingRow
                      key={wsValue}
                      workflowStatusValue={wsValue}
                      workflowStatusLabel={tKey(tI, wsLabelKey)}
                      isUnmapped={!mappedId}
                      unmappedTooltip={unmappedTooltip}
                      isExistingMappingLoading={isExistingMappingLoading}
                      teamStates={teamStates}
                      mappedId={mappedId}
                      notMappedLabel={notMappedLabel}
                      onStateSelect={handleStateSelect}
                    />
                  );
                })}
              </TableBody>
            </Table>
          </ScrollArea>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={handleDiscard}>
            {t('discard')}
          </Button>
          <Button
            onClick={handleSave}
            disabled={!hasChanges || saveMutation.isPending || !selectedTeamId}>
            {!!saveMutation.isPending && <Loader2 className="me-1.5 size-3.5 animate-spin" />}
            {saveMutation.isPending ? t('saving') : t('save')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
