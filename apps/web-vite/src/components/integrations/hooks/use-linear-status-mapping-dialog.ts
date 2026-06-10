import { useQuery } from '@tanstack/react-query';
import { useEffect, useMemo, useState } from 'react';

import { useResourceMutation } from '../../../hooks/use-resource-mutation.js';
import { useTranslations } from '../../../i18n/useTranslations.js';
import { computeSmartDefaultMappings } from '../../../lib/linear-status-mapping.js';
import { useTRPC } from '../../../providers/trpc-provider.js';
import { WORKFLOW_STATUS_VALUES } from '../status-mapping.constants.js';

export { WORKFLOW_STATUS_VALUES };

export interface LinearState {
  id: string;
  name: string;
  type: string;
  color: string;
  position: number;
}

export interface LinearTeam {
  id: string;
  name: string;
  key: string;
  states: LinearState[];
}

export type LinearStateType =
  | 'triage'
  | 'backlog'
  | 'unstarted'
  | 'started'
  | 'completed'
  | 'cancelled';

export interface MappingEntry {
  workflowStatus: string;
  linearStateId: string;
  linearStateName: string;
  linearStateType: LinearStateType;
}

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

export interface UseLinearStatusMappingDialogParams {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function useLinearStatusMappingDialog({
  open,
  onOpenChange,
}: UseLinearStatusMappingDialogParams) {
  const trpc = useTRPC();
  const t = useTranslations('Settings.integrations.linear.mapping');
  const tI = useTranslations('Integrations.linear.statusMapping');
  const [selectedTeamId, setSelectedTeamId] = useState<string | null>(null);
  const [mappings, setMappings] = useState<MappingEntry[]>([]);
  const [initialMappings, setInitialMappings] = useState<MappingEntry[]>([]);

  const connectionQuery = useQuery({
    ...trpc.linear.connectionStatus.queryOptions(),
    enabled: open,
  });
  const connection = connectionQuery.data as { id: string; status: string } | null | undefined;

  const teamsQuery = useQuery({
    ...trpc.linear.teams.queryOptions(),
    enabled: open && !!connection,
  });
  const teams = (teamsQuery.data ?? []) as LinearTeam[];

  const existingMappingQuery = useQuery({
    ...trpc.linear.getStatusMapping.queryOptions({
      teamId: selectedTeamId ?? '',
    }),
    enabled: !!selectedTeamId,
  });

  useEffect(() => {
    if (!selectedTeamId) return;

    const serverMappings = existingMappingQuery.data as MappingEntry[] | undefined;

    if (serverMappings && serverMappings.length > 0) {
      setMappings([...serverMappings]);
      setInitialMappings([...serverMappings]);
    } else {
      const team = teams.find(tm => tm.id === selectedTeamId);
      if (team) {
        const defaults = computeSmartDefaults(team.states);
        setMappings(defaults);
        setInitialMappings([...defaults]);
      }
    }
  }, [existingMappingQuery.data, selectedTeamId, teams]);

  const saveMutation = useResourceMutation(trpc.linear.saveStatusMapping.mutationOptions(), {
    successMessage: tI('toast.saved'),
    errorMessage: tI('toast.saveFailed'),
    invalidate: [
      trpc.linear.getStatusMapping.queryKey({ teamId: selectedTeamId ?? '' }),
      trpc.integration.getHealth.queryKey({ provider: 'linear' }),
      trpc.linear.connectionStatus.queryKey(),
    ],
    onClose: () => onOpenChange(false),
  });

  const selectedTeam = teams.find(tm => tm.id === selectedTeamId);

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

  const handleStateSelect = (workflowStatus: string, linearStateId: string) => {
    const team = teams.find(tm => tm.id === selectedTeamId);
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
  };

  const handleSave = () => {
    if (!(selectedTeamId && connection)) return;
    saveMutation.mutate({
      connectionId: connection.id,
      teamId: selectedTeamId,
      mappings,
    });
  };

  const getMappedStateId = (workflowStatus: string): string | undefined => {
    return mappings.find(m => m.workflowStatus === workflowStatus)?.linearStateId;
  };

  const teamStates = selectedTeam?.states ?? [];

  return {
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
  } as const;
}
