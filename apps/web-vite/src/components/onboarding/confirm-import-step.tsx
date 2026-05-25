import { Button } from '@contractor-ops/ui/components/shadcn/button';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from '@contractor-ops/ui/components/shadcn/card';
import { FolderKanban, Users } from 'lucide-react';

import { useTranslations } from '../../i18n/useTranslations.js';
import type { RoleBreakdownEntry } from './hooks/use-onboarding-confirm.js';
import { ImportProgressTrackerContainer } from './import-progress-tracker-container.js';

export interface ConfirmImportStepProps {
  jobId: string | null;
  peopleToImportCount: number;
  projectsToImportCount: number;
  totalSteps: number;
  roleBreakdown: RoleBreakdownEntry[];
  isStarting: boolean;
  canStart: boolean;
  onStartImport: () => void;
}

export function ConfirmImportStep({
  jobId,
  peopleToImportCount,
  projectsToImportCount,
  totalSteps,
  roleBreakdown,
  isStarting,
  canStart,
  onStartImport,
}: ConfirmImportStepProps) {
  const t = useTranslations('OnboardingImport.step4');

  if (jobId) {
    return <ImportProgressTrackerContainer jobId={jobId} />;
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="font-display text-xl font-semibold leading-[1.2]">{t('heading')}</h2>
        <p className="mt-1 text-sm text-muted-foreground">{t('subtitle')}</p>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <Users className="size-5 text-primary" aria-hidden="true" />
              <CardTitle>{t('peopleCard')}</CardTitle>
            </div>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">{peopleToImportCount}</p>
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

        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <FolderKanban className="size-5 text-primary" aria-hidden="true" />
              <CardTitle>{t('projectsCard')}</CardTitle>
            </div>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">{projectsToImportCount}</p>
            <p className="mt-1 text-sm text-muted-foreground">{totalSteps} total steps</p>
          </CardContent>
        </Card>
      </div>

      <div className="flex justify-center">
        <Button size="lg" onClick={onStartImport} disabled={isStarting || !canStart}>
          {isStarting ? 'Starting...' : t('startImport')}
        </Button>
      </div>
    </div>
  );
}
