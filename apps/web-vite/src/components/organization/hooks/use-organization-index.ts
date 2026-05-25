import { useQuery } from '@tanstack/react-query';

import { useTRPC } from '../../../providers/trpc-provider.js';

type OrgListResult = {
  items: unknown[];
  nextCursor?: string | null;
  total?: number;
};

function countFromListData(data: OrgListResult | undefined): number | undefined {
  if (!data) return;
  if (typeof data.total === 'number') return data.total;
  if (data.nextCursor) return;
  return data.items.length;
}

const SUMMARY_LIMIT = 200;

export function useOrganizationIndex() {
  const trpc = useTRPC();
  const teams = useQuery(
    trpc.organizationDefinitions.team.list.queryOptions({ limit: SUMMARY_LIMIT }),
  );
  const projects = useQuery(
    trpc.organizationDefinitions.project.list.queryOptions({ limit: SUMMARY_LIMIT }),
  );
  const costCenters = useQuery(
    trpc.organizationDefinitions.costCenter.list.queryOptions({ limit: SUMMARY_LIMIT }),
  );

  return {
    isLoading: teams.isLoading || projects.isLoading || costCenters.isLoading,
    teamsCount: countFromListData(teams.data as OrgListResult | undefined),
    projectsCount: countFromListData(projects.data as OrgListResult | undefined),
    costCentersCount: countFromListData(costCenters.data as OrgListResult | undefined),
  } as const;
}
