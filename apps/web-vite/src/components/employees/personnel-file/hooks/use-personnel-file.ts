import type { AppRouter } from '@contractor-ops/api';
import { useQuery } from '@tanstack/react-query';
import type { inferRouterOutputs } from '@trpc/server';
import { useCallback } from 'react';

import { useTRPC } from '../../../../providers/trpc-provider.js';

type GetFileOutput = NonNullable<inferRouterOutputs<AppRouter>['personnelFile']['getFile']>;
type ServerSection = GetFileOutput['sections'][number];

export type SectionRetention = ServerSection['retention'];
export type SectionDocument = Extract<ServerSection, { status: 'unlocked' }>['documents'][number];

export type SectionCode = 'A' | 'B' | 'C' | 'D';
export type SectionState = 'loading' | 'locked' | 'empty' | 'error' | 'populated';

export interface PersonnelFileSectionView {
  id: SectionCode;
  state: SectionState;
  retention: SectionRetention | null;
  documents: SectionDocument[];
}

export interface PersonnelFileView {
  workerId: string;
  jurisdiction: string | null;
  employmentActive: boolean;
  terminatedAt: Date | string | null;
  sections: PersonnelFileSectionView[];
  notFound: boolean;
  isLoading: boolean;
  isError: boolean;
  retry: () => void;
}

const SECTION_CODES: readonly SectionCode[] = ['A', 'B', 'C', 'D'];

/**
 * Sole tRPC boundary for the staff personnel-file surface. It calls the
 * per-section `personnelFile.getFile` procedure — which decides each section's
 * lock at the permission layer and returns NO document payload for a locked
 * section — and maps the server response into presentational per-section view
 * props. The lock is never decided in the view: a `{ status: 'locked' }` section
 * maps straight to the `locked` card state with an empty documents array, so
 * bytes for an ungranted section are neither fetched nor rendered.
 *
 * getFile is atomic, so a query error maps every section to the `error` state
 * (each card renders its own inline error + Retry). The page header and the
 * retention panel — the latter fed by the same per-section retention posture the
 * server returns even for locked sections — stay independent of that failure.
 */
export function usePersonnelFile(workerId: string): PersonnelFileView {
  const trpc = useTRPC();
  const fileQuery = useQuery(trpc.personnelFile.getFile.queryOptions({ workerId }));

  const retry = useCallback(() => {
    void fileQuery.refetch();
  }, [fileQuery]);

  const data = fileQuery.data ?? null;
  const notFound = !(fileQuery.isLoading || fileQuery.isError) && data === null;

  const sections: PersonnelFileSectionView[] = SECTION_CODES.map(code => {
    if (fileQuery.isLoading) {
      return { id: code, state: 'loading', retention: null, documents: [] };
    }
    if (fileQuery.isError) {
      return { id: code, state: 'error', retention: null, documents: [] };
    }

    const server = data?.sections.find(section => section.id === code) ?? null;
    if (!server) {
      return { id: code, state: 'empty', retention: null, documents: [] };
    }
    if (server.status === 'locked') {
      return { id: code, state: 'locked', retention: server.retention, documents: [] };
    }
    return {
      id: code,
      state: server.documents.length === 0 ? 'empty' : 'populated',
      retention: server.retention,
      documents: server.documents,
    };
  });

  return {
    workerId,
    jurisdiction: data?.jurisdiction ?? null,
    employmentActive: data?.employmentActive ?? true,
    terminatedAt: data?.terminatedAt ?? null,
    sections,
    notFound,
    isLoading: fileQuery.isLoading,
    isError: fileQuery.isError,
    retry,
  };
}
