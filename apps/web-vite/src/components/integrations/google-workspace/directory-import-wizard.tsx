import { Button } from '@contractor-ops/ui/components/shadcn/button';
import {
  Dialog,
  DialogBody,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogSection,
  DialogTitle,
} from '@contractor-ops/ui/components/shadcn/dialog';
import { Skeleton } from '@contractor-ops/ui/components/shadcn/skeleton';
import { AlertTriangle, Check, Loader2 } from 'lucide-react';
import { useCallback } from 'react';

import { FeatureGate } from '../../layout/feature-gate.js';
import { DirectoryPreviewTable } from './directory-preview/data-table.js';
import { DirectorySummaryBar } from './directory-summary-bar.js';
import { GroupRoleMappingStep } from './group-role-mapping-step.js';
import type { WizardStep } from './hooks/use-directory-import-wizard.js';
import { useDirectoryImportWizard } from './hooks/use-directory-import-wizard.js';
import { ImportConfirmStep } from './import-confirm-step.js';
import { RoleAssignmentControls } from './role-assignment-controls.js';

function StepIndicator({
  currentStep,
  steps,
}: {
  currentStep: WizardStep;
  steps: Array<{ step: WizardStep; label: string }>;
}) {
  return (
    <nav className="flex items-center gap-4 border-b pb-3">
      {steps.map(({ step, label }) => {
        const isCurrent = step === currentStep;
        const isCompleted = step < currentStep;

        return (
          <div
            key={step}
            className={`flex items-center gap-1.5 text-sm ${
              isCurrent
                ? 'text-primary border-b-2 border-primary pb-px font-medium'
                : isCompleted
                  ? 'text-primary'
                  : 'text-muted-foreground'
            }`}
            aria-current={isCurrent ? 'step' : undefined}>
            {isCompleted && <Check className="size-3.5" aria-hidden="true" />}
            <span>
              {step}. {label}
            </span>
          </div>
        );
      })}
    </nav>
  );
}

export type DirectoryImportWizardViewProps = ReturnType<typeof useDirectoryImportWizard>;

export function DirectoryImportWizardView({
  open,
  handleOpenChange,
  step,
  setStep,
  selectedEmails,
  setSelectedEmails,
  defaultRole,
  setDefaultRole,
  groupMappings,
  handleGroupMappingChange,
  directoryQuery,
  directoryData,
  users,
  stats,
  listGroupsMutation,
  handleGoToStep2,
  groups,
  selectedUsers,
  roleBreakdown,
  importMutation,
  handleConfirmImport,
  stepsConfig,
  t,
}: DirectoryImportWizardViewProps) {
  const handleBackToStep1 = useCallback(() => setStep(1), [setStep]);
  const handleGoToStep3 = useCallback(() => setStep(3), [setStep]);
  const handleBackToStep2 = useCallback(() => setStep(2), [setStep]);

  return (
    <FeatureGate requiredTier="Pro" featureName="Google Workspace directory import">
      <Dialog open={open} onOpenChange={handleOpenChange}>
        <DialogContent className="max-h-[85vh] max-w-3xl sm:max-w-3xl">
          <DialogHeader>
            <DialogTitle>{t('title')}</DialogTitle>
          </DialogHeader>

          <DialogSection>
            <StepIndicator currentStep={step} steps={stepsConfig} />
          </DialogSection>

          <DialogBody>
            {step === 1 && (
              <div className="space-y-4">
                {!!directoryQuery.isLoading && (
                  <div className="space-y-3">
                    <Skeleton className="h-12 w-full" />
                    <Skeleton className="h-8 w-64" />
                    <Skeleton className="h-64 w-full" />
                  </div>
                )}

                {!!directoryQuery.isError && (
                  <div className="flex items-center gap-3 rounded-lg border border-destructive/30 bg-destructive/5 p-4">
                    <AlertTriangle className="size-5 text-destructive" aria-hidden="true" />
                    <p className="text-sm text-destructive">{t('fetchError')}</p>
                  </div>
                )}

                {!!directoryData && !!stats && (
                  <>
                    {stats.total === 0 ? (
                      <div className="py-8 text-center">
                        <h3 className="text-lg font-semibold">{t('emptyNoUsers')}</h3>
                        <p className="mt-1 text-sm text-muted-foreground">
                          {t('emptyNoUsersBody')}
                        </p>
                      </div>
                    ) : stats.new === 0 ? (
                      <div className="py-8 text-center">
                        <h3 className="text-lg font-semibold">{t('emptyAllImported')}</h3>
                        <p className="mt-1 text-sm text-muted-foreground">
                          {t('emptyAllImportedBody')}
                        </p>
                      </div>
                    ) : (
                      <>
                        <DirectorySummaryBar
                          total={stats.total}
                          alreadyImported={stats.alreadyImported}
                          newUsers={stats.new}
                          selected={selectedEmails.size}
                        />

                        <DirectoryPreviewTable
                          users={users}
                          selectedEmails={selectedEmails}
                          onSelectionChange={setSelectedEmails}
                        />
                      </>
                    )}
                  </>
                )}
              </div>
            )}

            {step === 2 && (
              <div className="space-y-6">
                <RoleAssignmentControls
                  defaultRole={defaultRole}
                  onDefaultRoleChange={setDefaultRole}
                />

                {listGroupsMutation.isPending ? (
                  <div className="space-y-2">
                    <Skeleton className="h-4 w-48" />
                    <Skeleton className="h-16 w-full" />
                    <Skeleton className="h-16 w-full" />
                  </div>
                ) : (
                  <GroupRoleMappingStep
                    groups={groups}
                    mappings={groupMappings}
                    onMappingChange={handleGroupMappingChange}
                    defaultRole={defaultRole}
                  />
                )}
              </div>
            )}

            {step === 3 && (
              <ImportConfirmStep userCount={selectedUsers.length} roleBreakdown={roleBreakdown} />
            )}
          </DialogBody>

          {step === 1 && !!stats && stats.new > 0 && (
            <DialogFooter>
              <Button onClick={handleGoToStep2} disabled={selectedEmails.size === 0}>
                {t('nextRoles')}
              </Button>
            </DialogFooter>
          )}

          {step === 2 && (
            <DialogFooter className="gap-2 sm:gap-2">
              <Button variant="outline" onClick={handleBackToStep1}>
                {t('back')}
              </Button>
              <Button onClick={handleGoToStep3}>{t('nextReview')}</Button>
            </DialogFooter>
          )}

          {step === 3 && (
            <DialogFooter className="gap-2 sm:gap-2">
              <Button
                variant="outline"
                onClick={handleBackToStep2}
                disabled={importMutation.isPending}>
                {t('back')}
              </Button>
              <Button onClick={handleConfirmImport} disabled={importMutation.isPending}>
                {!!importMutation.isPending && (
                  <Loader2 className="me-1.5 size-3.5 animate-spin" aria-hidden="true" />
                )}
                {importMutation.isPending
                  ? t('importing')
                  : t('importCta', { count: selectedUsers.length })}
              </Button>
            </DialogFooter>
          )}
        </DialogContent>
      </Dialog>
    </FeatureGate>
  );
}

interface DirectoryImportWizardProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function DirectoryImportWizard(props: DirectoryImportWizardProps) {
  const viewProps = useDirectoryImportWizard(props);
  return <DirectoryImportWizardView {...viewProps} />;
}
