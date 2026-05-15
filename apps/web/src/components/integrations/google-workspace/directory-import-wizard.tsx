'use client';

import type { DirectoryRole } from '@contractor-ops/validators';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { AlertTriangle, Check } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useCallback, useMemo, useState } from 'react';
import { toast } from 'sonner';
import { FeatureGate } from '@/components/billing/feature-gate';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Skeleton } from '@/components/ui/skeleton';
import { trpc } from '@/trpc/init';
import type { DirectoryUser } from './directory-preview-table';
import { DirectoryPreviewTable } from './directory-preview-table';
import { DirectorySummaryBar } from './directory-summary-bar';
import { GroupRoleMappingStep } from './group-role-mapping-step';
import { ImportConfirmStep } from './import-confirm-step';
import { RoleAssignmentControls } from './role-assignment-controls';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface DirectoryImportWizardProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

type WizardStep = 1 | 2 | 3;

// ---------------------------------------------------------------------------
// Step indicator
// ---------------------------------------------------------------------------

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

// ---------------------------------------------------------------------------
// DirectoryImportWizard
// ---------------------------------------------------------------------------

export function DirectoryImportWizard({ open, onOpenChange }: DirectoryImportWizardProps) {
  const t = useTranslations('GoogleWorkspace.import');
  const queryClient = useQueryClient();

  // Wizard state
  const [step, setStep] = useState<WizardStep>(1);
  const [selectedEmails, setSelectedEmails] = useState<Set<string>>(new Set());
  const [defaultRole, setDefaultRole] = useState<DirectoryRole>('readonly');
  const [groupMappings, setGroupMappings] = useState<Map<string, DirectoryRole>>(new Map());

  // Reset when dialog closes
  const handleOpenChange = useCallback(
    (value: boolean) => {
      if (!value) {
        setStep(1);
        setSelectedEmails(new Set());
        setDefaultRole('readonly');
        setGroupMappings(new Map());
      }
      onOpenChange(value);
    },
    [onOpenChange],
  );

  // ---------------------------------------------------------------------------
  // Step 1: Directory listing
  // ---------------------------------------------------------------------------

  const directoryQuery = useQuery({
    ...trpc.googleWorkspace.listDirectory.queryOptions(),
    enabled: open,
  });
  const directoryData = directoryQuery.data;
  const users: DirectoryUser[] = (directoryData?.users ?? []) as DirectoryUser[];
  const stats = directoryData?.stats;

  // ---------------------------------------------------------------------------
  // Step 2: Group listing (mutation fired when entering step 2)
  // ---------------------------------------------------------------------------

  const listGroupsMutation = useMutation(
    trpc.googleWorkspace.listUserGroups.mutationOptions({
      onError: err => toast.error(err.message),
      onSuccess: () => {
        toast.success('Done.');
      },
    }),
  );

  const handleGoToStep2 = useCallback(() => {
    const emails = Array.from(selectedEmails);
    listGroupsMutation.mutate({ userEmails: emails });
    setStep(2);
  }, [selectedEmails, listGroupsMutation]);

  const groups = listGroupsMutation.data?.groups ?? [];

  const handleGroupMappingChange = useCallback((groupEmail: string, role: DirectoryRole) => {
    setGroupMappings(prev => {
      const next = new Map(prev);
      next.set(groupEmail, role);
      return next;
    });
  }, []);

  // ---------------------------------------------------------------------------
  // Step 3: Compute role breakdown
  // ---------------------------------------------------------------------------

  const selectedUsers = useMemo(
    () => users.filter(u => selectedEmails.has(u.primaryEmail)),
    [users, selectedEmails],
  );

  // Build user -> groups mapping from listUserGroups response
  const userGroupMemberships = useMemo(() => {
    const map: Record<string, string[]> = {};
    for (const group of groups) {
      for (const email of group.memberEmails) {
        if (!map[email]) map[email] = [];
        map[email].push(group.email);
      }
    }
    return map;
  }, [groups]);

  const roleBreakdown = useMemo(() => {
    const counts = new Map<string, { role: DirectoryRole; count: number; source: string }>();

    for (const user of selectedUsers) {
      let role: DirectoryRole = defaultRole;
      let source = t('roleSourceDefault');

      // Check group mappings
      const userGroups = userGroupMemberships[user.primaryEmail] ?? [];
      for (const [groupEmail, mappedRole] of groupMappings) {
        if (userGroups.includes(groupEmail)) {
          role = mappedRole;
          const group = groups.find(g => g.email === groupEmail);
          source = group?.name ?? groupEmail;
          break;
        }
      }

      const key = `${role}:${source}`;
      const existing = counts.get(key);
      if (existing) {
        existing.count++;
      } else {
        counts.set(key, { role, count: 1, source });
      }
    }

    return Array.from(counts.values()).map(({ role, count, source }) => ({
      role,
      count,
      source,
    }));
  }, [selectedUsers, defaultRole, groupMappings, userGroupMemberships, groups, t]);

  // ---------------------------------------------------------------------------
  // Import mutation
  // ---------------------------------------------------------------------------

  const importMutation = useMutation({
    ...trpc.googleWorkspace.bulkImport.mutationOptions(),
    onSuccess: data => {
      const succeededCount = data.succeeded.length;
      const failedCount = data.failed.length;

      if (failedCount === 0) {
        toast.success(t('successToast', { count: succeededCount }));
        handleOpenChange(false);
      } else {
        toast.error(
          t('partialError', {
            succeeded: succeededCount,
            total: succeededCount + failedCount,
            failed: failedCount,
          }),
        );
      }

      // Invalidate related queries
      void queryClient.invalidateQueries({
        queryKey: trpc.googleWorkspace.listDirectory.queryKey(),
      });
      void queryClient.invalidateQueries({
        queryKey: trpc.googleWorkspace.syncStatus.queryKey(),
      });
    },
    onError: () => {
      toast.error(t('fetchError'));
    },
  });

  const handleConfirmImport = useCallback(() => {
    const usersPayload = selectedUsers.map(u => ({
      email: u.primaryEmail,
      name: u.name.fullName,
      googleUserId: u.id,
    }));

    const groupRoleMappingsPayload = Array.from(groupMappings.entries()).map(
      ([groupEmail, role]) => ({
        groupEmail,
        groupName: groups.find(g => g.email === groupEmail)?.name ?? groupEmail,
        role,
      }),
    );

    importMutation.mutate({
      users: usersPayload,
      defaultRole,
      groupRoleMappings: groupRoleMappingsPayload,
      userRoleOverrides: {},
      userGroupMemberships,
    });
  }, [selectedUsers, defaultRole, groupMappings, groups, userGroupMemberships, importMutation]);

  // ---------------------------------------------------------------------------
  // Steps config
  // ---------------------------------------------------------------------------

  const stepsConfig: Array<{ step: WizardStep; label: string }> = [
    { step: 1, label: t('step1Title') },
    { step: 2, label: t('step2Title') },
    { step: 3, label: t('step3Title') },
  ];

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------

  return (
    <FeatureGate requiredTier="Pro" featureName="Google Workspace directory import">
      <Dialog open={open} onOpenChange={handleOpenChange}>
        <DialogContent className="max-w-3xl max-h-[85vh] overflow-y-auto sm:max-w-3xl">
          <DialogHeader>
            <DialogTitle>{t('title')}</DialogTitle>
          </DialogHeader>

          <StepIndicator currentStep={step} steps={stepsConfig} />

          {/* Step 1: Preview directory */}
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
                      <p className="mt-1 text-sm text-muted-foreground">{t('emptyNoUsersBody')}</p>
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

                  {stats.new > 0 && (
                    <div className="flex justify-end">
                      <Button onClick={handleGoToStep2} disabled={selectedEmails.size === 0}>
                        {t('nextRoles')}
                      </Button>
                    </div>
                  )}
                </>
              )}
            </div>
          )}

          {/* Step 2: Role assignment + Group mapping */}
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

              <div className="flex justify-end gap-2">
                {/* biome-ignore lint/nursery/noJsxPropsBind: callback in JSX prop */}
                <Button variant="outline" onClick={() => setStep(1)}>
                  {t('back')}
                </Button>
                {/* biome-ignore lint/nursery/noJsxPropsBind: callback in JSX prop */}
                <Button onClick={() => setStep(3)}>{t('nextReview')}</Button>
              </div>
            </div>
          )}

          {/* Step 3: Confirm import */}
          {step === 3 && (
            <ImportConfirmStep
              userCount={selectedUsers.length}
              roleBreakdown={roleBreakdown}
              onConfirm={handleConfirmImport}
              // biome-ignore lint/nursery/noJsxPropsBind: callback in JSX prop
              onBack={() => setStep(2)}
              isImporting={importMutation.isPending}
            />
          )}
        </DialogContent>
      </Dialog>
    </FeatureGate>
  );
}
