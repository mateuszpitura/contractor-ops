import { Button } from '@contractor-ops/ui/components/shadcn/button';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from '@contractor-ops/ui/components/shadcn/card';
import { FolderKanban, RefreshCw, Users } from 'lucide-react';

import type { ImportedProject, MergedPerson } from '@contractor-ops/validators';
import type { InvitableMemberRole } from '@contractor-ops/validators/roles';
import { invitableMemberRoleValues } from '@contractor-ops/validators/roles';

import { useTranslations } from '../../i18n/useTranslations.js';

import type { RoleBreakdownEntry } from './hooks/use-onboarding-confirm.js';
import { useOnboardingConfirm } from './hooks/use-onboarding-confirm.js';
import { ImportProgressTracker } from './import-progress-tracker.js';
import type { PersonSelection, ProjectSelection } from './import-wizard.js';

export interface ConfirmImportStepViewProps {
  peopleToImportCount: number;
  projectsToImportCount: number;
  totalSteps: number;
  roleBreakdown: RoleBreakdownEntry[];
  isStarting: boolean;
  onStartImport: () => void;
}

export function ConfirmImportStepView({
  peopleToImportCount,
  projectsToImportCount,
  totalSteps,
  roleBreakdown,
  isStarting,
  onStartImport,
}: ConfirmImportStepViewProps) {
  const t = useTranslations('OnboardingImport.step4');
  const tRoles = useTranslations('Users.roles');

  const roleKeyMap: Record<InvitableMemberRole, Parameters<typeof tRoles>[0]> = {
    admin: 'admin',
    finance_admin: 'financeAdmin',
    ops_manager: 'opsManager',
    team_manager: 'teamManager',
    legal_compliance_viewer: 'legalComplianceViewer',
    it_admin: 'itAdmin',
    external_accountant: 'externalAccountant',
    readonly: 'readonly',
  };

  const formatRole = (role: string) => {
    if (invitableMemberRoleValues.includes(role as InvitableMemberRole)) {
      return tRoles(roleKeyMap[role as InvitableMemberRole]);
    }
    return role;
  };

  return (
    <div className="space-y-6">
      <ConfirmImportHeader />

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
                    {t('roleCount', { count, role: formatRole(role) })}
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
            <p className="mt-1 text-sm text-muted-foreground">
              {t('totalSteps', { count: totalSteps })}
            </p>
          </CardContent>
        </Card>
      </div>

      <div className="flex justify-center">
        <Button size="lg" onClick={onStartImport} disabled={isStarting}>
          {isStarting ? t('starting') : t('startImport')}
        </Button>
      </div>
    </div>
  );
}

export function ConfirmImportHeader() {
  const t = useTranslations('OnboardingImport.step4');
  return (
    <div>
      <h2 className="font-display text-xl font-semibold leading-[1.2]">{t('heading')}</h2>
      <p className="mt-1 text-sm text-muted-foreground">{t('subtitle')}</p>
    </div>
  );
}

export interface ConfirmImportErrorProps {
  onRetry: () => void;
}

export function ConfirmImportError({ onRetry }: ConfirmImportErrorProps) {
  const tCommon = useTranslations('Common');
  const tErr = useTranslations('Contractors.error');

  return (
    <div className="flex flex-col items-center gap-4 py-16">
      <p className="text-sm text-muted-foreground">{tCommon('networkError')}</p>
      <Button variant="outline" size="sm" className="gap-1.5" onClick={onRetry}>
        <RefreshCw className="h-3.5 w-3.5" aria-hidden="true" />
        {tErr('retry')}
      </Button>
    </div>
  );
}

export function ConfirmImportEmpty() {
  const t = useTranslations('OnboardingImport.step4');
  return (
    <div className="flex flex-col items-center gap-4 py-16">
      <Users className="size-12 text-muted-foreground" aria-hidden="true" />
      <p className="max-w-md text-center text-sm text-muted-foreground">{t('nothingToImport')}</p>
    </div>
  );
}

type ConfirmImportStepWiredProps = {
  mergedPeople: MergedPerson[];
  personSelections: Map<string, PersonSelection>;
  projects: ImportedProject[];
  projectSelections: Map<string, ProjectSelection>;
  jobId: string | null;
  onJobIdChange: (jobId: string) => void;
};

export function ConfirmImportStep(props: ConfirmImportStepWiredProps) {
  const section = useOnboardingConfirm({
    mergedPeople: props.mergedPeople,
    personSelections: props.personSelections,
    projects: props.projects,
    projectSelections: props.projectSelections,
    onJobIdChange: props.onJobIdChange,
  });

  if (props.jobId) {
    return (
      <div className="space-y-6">
        <ConfirmImportHeader />
        <ImportProgressTracker
          jobId={props.jobId}
          expectedPeopleCount={section.peopleToImport.length}
          expectedProjectsCount={section.projectsToImport.length}
        />
      </div>
    );
  }

  if (section.isError) {
    return (
      <div className="space-y-6">
        <ConfirmImportHeader />
        <ConfirmImportError onRetry={section.handleRetryStart} />
      </div>
    );
  }

  if (section.isEmpty) {
    return (
      <div className="space-y-6">
        <ConfirmImportHeader />
        <ConfirmImportEmpty />
      </div>
    );
  }

  return (
    <ConfirmImportStepView
      peopleToImportCount={section.peopleToImport.length}
      projectsToImportCount={section.projectsToImport.length}
      totalSteps={section.totalSteps}
      roleBreakdown={section.roleBreakdown}
      isStarting={section.isStarting}
      onStartImport={section.handleStartImport}
    />
  );
}

/** @deprecated Use ConfirmImportStep */
export { ConfirmImportStep as ConfirmImportStepContainer };

/** @deprecated Use ConfirmImportStepViewProps */
export type { ConfirmImportStepViewProps as ConfirmImportStepProps };
