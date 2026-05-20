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
import { tKey } from '@/i18n/typed-keys';
import { trpc } from '@/trpc/init';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const WORKFLOW_STATUS_VALUES = [
  'TODO',
  'IN_PROGRESS',
  'DONE',
  'BLOCKED',
  'SKIPPED',
  'CANCELLED',
] as const;

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface LinearState {
  id: string;
  name: string;
  type: string;
  color: string;
  position: number;
}

interface LinearTeam {
  id: string;
  name: string;
  key: string;
  states: LinearState[];
}

type LinearStateType = 'triage' | 'backlog' | 'unstarted' | 'started' | 'completed' | 'cancelled';

interface MappingEntry {
  workflowStatus: string;
  linearStateId: string;
  linearStateName: string;
  linearStateType: LinearStateType;
}

interface LinearStatusMappingDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

// ---------------------------------------------------------------------------
// Smart default algorithm (D-02) -- delegates core logic to utility
// ---------------------------------------------------------------------------

import { computeSmartDefaultMappings } from '@/lib/linear-status-mapping';

function computeSmartDefaults(states: LinearState[]): MappingEntry[] {
  const smartMap = computeSmartDefaultMappings(states);
  const stateByName = new Map(states.map(s => [s.name, s]));

  return Object.entries(smartMap)
    .map(([workflowStatus, stateName]) => {
      const state = stateByName.get(stateName);
      if (!state) return null;
      return {
        workflowStatus,
        linearStateId: state.id,
        linearStateName: state.name,
        linearStateType: state.type as LinearStateType,
      };
    })
    .filter((e): e is MappingEntry => e !== null);
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function LinearStatusMappingDialog({ open, onOpenChange }: LinearStatusMappingDialogProps) {
  const t = useTranslations('Settings.integrations.linear.mapping');
  const tI = useTranslations('Integrations.linear.statusMapping');
  const queryClient = useQueryClient();
  const [selectedTeamId, setSelectedTeamId] = useState<string | null>(null);
  const [mappings, setMappings] = useState<MappingEntry[]>([]);
  const [initialMappings, setInitialMappings] = useState<MappingEntry[]>([]);

  // ---- Fetch connection status (for connectionId) ----
  const connectionQuery = useQuery({
    ...trpc.linear.connectionStatus.queryOptions(),
    enabled: open,
  });
  const connection = connectionQuery.data as { id: string; status: string } | null | undefined;

  // ---- Fetch teams ----
  const teamsQuery = useQuery({
    ...trpc.linear.teams.queryOptions(),
    enabled: open && !!connection,
  });
  const teams = (teamsQuery.data ?? []) as LinearTeam[];

  // ---- Fetch existing mapping for selected team ----
  const existingMappingQuery = useQuery({
    ...trpc.linear.getStatusMapping.queryOptions({
      teamId: selectedTeamId ?? '',
    }),
    enabled: !!selectedTeamId,
  });

  // ---- Initialize mappings ----
  useEffect(() => {
    if (!selectedTeamId) return;

    const serverMappings = existingMappingQuery.data as MappingEntry[] | undefined;

    if (serverMappings && serverMappings.length > 0) {
      setMappings([...serverMappings]);
      setInitialMappings([...serverMappings]);
    } else {
      // No existing mapping -- apply smart defaults (D-02)
      const team = teams.find(t => t.id === selectedTeamId);
      if (team) {
        const defaults = computeSmartDefaults(team.states);
        setMappings(defaults);
        setInitialMappings([]);
      }
    }
  }, [existingMappingQuery.data, selectedTeamId, teams]);

  // ---- Save mutation ----
  const saveMutation = useMutation({
    ...trpc.linear.saveStatusMapping.mutationOptions(),
    onSuccess: () => {
      toast.success(tI('toast.saved'));
      queryClient.invalidateQueries({
        queryKey: trpc.linear.getStatusMapping.queryKey({
          teamId: selectedTeamId ?? '',
        }),
      });
      queryClient.invalidateQueries({
        queryKey: trpc.integration.getHealth.queryKey({ provider: 'linear' }),
      });
      queryClient.invalidateQueries({
        queryKey: trpc.linear.connectionStatus.queryKey(),
      });
      onOpenChange(false);
    },
    onError: () => {
      toast.error(tI('toast.saveFailed'));
    },
  });

  // ---- Derived state ----
  const selectedTeam = teams.find(t => t.id === selectedTeamId);

  const hasChanges = useMemo(() => {
    if (mappings.length !== initialMappings.length) return true;
    return mappings.some((m, i) => {
      const initial = initialMappings[i];
      if (!initial) return true;
      return (
        m.workflowStatus !== initial.workflowStatus || m.linearStateId !== initial.linearStateId
      );
    });
  }, [mappings, initialMappings]);

  // ---- Handlers ----
  function handleStateSelect(workflowStatus: string, linearStateId: string) {
    const team = teams.find(t => t.id === selectedTeamId);
    const linearState = team?.states.find(s => s.id === linearStateId);
    if (!linearState) return;

    setMappings(prev => {
      const existing = prev.findIndex(m => m.workflowStatus === workflowStatus);
      const entry: MappingEntry = {
        workflowStatus,
        linearStateId: linearState.id,
        linearStateName: linearState.name,
        linearStateType: linearState.type as LinearStateType,
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
    if (!(selectedTeamId && connection)) return;
    saveMutation.mutate({
      connectionId: connection.id,
      teamId: selectedTeamId,
      mappings,
    });
  }

  function getMappedStateId(workflowStatus: string): string | undefined {
    return mappings.find(m => m.workflowStatus === workflowStatus)?.linearStateId;
  }

  const teamStates = selectedTeam?.states ?? [];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>{t('title')}</DialogTitle>
          <DialogDescription>
            {selectedTeam ? t('description', { teamName: selectedTeam.name }) : t('selectTeam')}
          </DialogDescription>
        </DialogHeader>

        {/* Team selector */}
        <div className="space-y-2">
          <Label>{t('selectTeam')}</Label>
          {/* biome-ignore lint/nursery/noJsxPropsBind: controlled component handler */}
          <Select value={selectedTeamId ?? undefined} onValueChange={v => setSelectedTeamId(v)}>
            <SelectTrigger className="w-full">
              <SelectValue placeholder={t('selectTeam')}>
                {!!teamsQuery.isLoading && <Loader2 className="size-3.5 animate-spin" />}
              </SelectValue>
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

        {/* No teams state */}
        {!teamsQuery.isLoading && teams.length === 0 && (
          <div className="rounded-md border border-dashed p-6 text-center">
            <p className="text-sm font-medium">{t('noTeams')}</p>
            <p className="mt-1 text-sm text-muted-foreground">{t('noTeamsBody')}</p>
          </div>
        )}

        {/* Status mapping table */}
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
                  const isUnmapped = !mappedId;
                  const wsLabelKey = {
                    TODO: 'workflowStatus.todo',
                    IN_PROGRESS: 'workflowStatus.inProgress',
                    DONE: 'workflowStatus.done',
                    BLOCKED: 'workflowStatus.blocked',
                    SKIPPED: 'workflowStatus.skipped',
                    CANCELLED: 'workflowStatus.cancelled',
                  }[wsValue];

                  return (
                    <TableRow key={wsValue}>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-medium">{tKey(tI, wsLabelKey)}</span>
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
                        {existingMappingQuery.isLoading ? (
                          <Loader2 className="size-3.5 animate-spin" />
                        ) : (
                          <Select
                            value={mappedId ?? undefined}
                            // biome-ignore lint/nursery/noJsxPropsBind: controlled component handler
                            onValueChange={v => {
                              if (v) handleStateSelect(wsValue, v);
                            }}>
                            <SelectTrigger className="w-full">
                              <SelectValue placeholder={tI('notMapped')} />
                            </SelectTrigger>
                            <SelectContent>
                              {teamStates.map(state => (
                                <SelectItem key={state.id} value={state.id}>
                                  <div className="flex items-center gap-2">
                                    <span
                                      className="size-2 shrink-0 rounded-full"
                                      aria-hidden="true"
                                    />
                                    {state.name}
                                  </div>
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
            {t('discard')}
          </Button>
          <Button
            // biome-ignore lint/nursery/noJsxPropsBind: callback in JSX prop
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
