'use client';

import { Button } from '@contractor-ops/ui/components/shadcn/button';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from '@contractor-ops/ui/components/shadcn/card';
import type { FetchProjectsOutput, MergedPerson } from '@contractor-ops/validators';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { FolderKanban, Users } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useCallback, useMemo } from 'react';
import { toast } from 'sonner';
import { trpc } from '@/trpc/init';
import { ImportProgressTracker } from './import-progress-tracker';
import type { PersonSelection, ProjectSelection } from './import-wizard';

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

interface ConfirmImportStepProps {
  mergedPeople: MergedPerson[];
  personSelections: Map<string, PersonSelection>;
  projects: FetchProjectsOutput;
  projectSelections: Map<string, ProjectSelection>;
  jobId: string | null;
  onJobIdChange: (jobId: string) => void;
}

// ---------------------------------------------------------------------------
// ConfirmImportStep
// ---------------------------------------------------------------------------

export function ConfirmImportStep({
  mergedPeople,
  personSelections,
  projects,
  projectSelections,
  jobId,
  onJobIdChange,
}: ConfirmImportStepProps) {
  const t = useTranslations('OnboardingImport.step4');

  // Compute people to import (not skipped, not existing)
  const peopleToImport = useMemo(() => {
    return mergedPeople.filter(p => {
      const sel = personSelections.get(p.email);
      return sel && !sel.skip && p.status !== 'exists';
    });
  }, [mergedPeople, personSelections]);

  // Role breakdown
  const roleBreakdown = useMemo(() => {
    const counts = new Map<string, number>();
    for (const person of peopleToImport) {
      const sel = personSelections.get(person.email);
      const role = sel?.role ?? 'readonly';
      counts.set(role, (counts.get(role) ?? 0) + 1);
    }
    return Array.from(counts.entries()).map(([role, count]) => ({
      role,
      count,
    }));
  }, [peopleToImport, personSelections]);

  // Projects to import (not skipped)
  const projectsToImport = useMemo(() => {
    return projects.filter(p => {
      const key = `${p.sourceProvider}-${p.externalId}`;
      const sel = projectSelections.get(key);
      return sel && !sel.skip;
    });
  }, [projects, projectSelections]);

  // Total steps count
  const totalSteps = useMemo(() => {
    let count = 0;
    for (const project of projectsToImport) {
      const key = `${project.sourceProvider}-${project.externalId}`;
      const sel = projectSelections.get(key);
      count += sel?.steps.length ?? project.statuses.length;
    }
    return count;
  }, [projectsToImport, projectSelections]);

  // Start import mutation
  const queryClient = useQueryClient();
  const startImportMutation = useMutation({
    ...trpc.onboardingImport.startImport.mutationOptions(),
    onSuccess: data => {
      onJobIdChange(data.jobId);
      toast.success('Done.');
      queryClient.invalidateQueries(trpc.onboardingImport.pathFilter());
    },

    onError: err => toast.error(err.message),
  });

  const handleStartImport = useCallback(() => {
    const people = peopleToImport.map(p => {
      const sel = personSelections.get(p.email);
      return {
        email: p.email,
        name: p.name,
        role: sel?.role ?? 'readonly',
        skip: false,
      };
    });

    const projectsPayload = projectsToImport.map(p => {
      const key = `${p.sourceProvider}-${p.externalId}`;
      const sel = projectSelections.get(key);
      return {
        sourceProvider: p.sourceProvider,
        externalId: p.externalId,
        name: sel?.name ?? p.name,
        skip: false,
        steps: sel?.steps ?? p.statuses.map((s, i) => ({ name: s.name, sortOrder: i })),
      };
    });

    startImportMutation.mutate({
      people,
      projects: projectsPayload,
    });
  }, [peopleToImport, personSelections, projectsToImport, projectSelections, startImportMutation]);

  // If import has started, show progress tracker
  if (jobId) {
    return <ImportProgressTracker jobId={jobId} />;
  }

  return (
    <div className="space-y-6">
      {/* Heading */}
      <div>
        <h2 className="font-display text-xl font-semibold leading-[1.2]">{t('heading')}</h2>
        <p className="mt-1 text-sm text-muted-foreground">{t('subtitle')}</p>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        {/* People card */}
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <Users className="size-5 text-primary" aria-hidden="true" />
              <CardTitle>{t('peopleCard')}</CardTitle>
            </div>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">{peopleToImport.length}</p>
            {roleBreakdown.length > 0 && (
              <ul className="mt-2 space-y-1">
                {roleBreakdown.map(({ role, count }) => (
                  <li key={role} className="text-sm text-muted-foreground">
                    {count} x {role}
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>

        {/* Projects card */}
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <FolderKanban className="size-5 text-primary" aria-hidden="true" />
              <CardTitle>{t('projectsCard')}</CardTitle>
            </div>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">{projectsToImport.length}</p>
            <p className="mt-1 text-sm text-muted-foreground">{totalSteps} total steps</p>
          </CardContent>
        </Card>
      </div>

      {/* Start Import button */}
      <div className="flex justify-center">
        <Button
          size="lg"
          onClick={handleStartImport}
          disabled={
            startImportMutation.isPending ||
            (peopleToImport.length === 0 && projectsToImport.length === 0)
          }>
          {startImportMutation.isPending ? 'Starting...' : t('startImport')}
        </Button>
      </div>
    </div>
  );
}
