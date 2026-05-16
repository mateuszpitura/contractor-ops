'use client';

import type { ContractorLifecycleStageInput } from '@contractor-ops/ui';
import { AtelierStatusPill, iconSize, statusToVariant } from '@contractor-ops/ui';
import { useQueryClient } from '@tanstack/react-query';
import { MoreHorizontal, Play } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useState } from 'react';
import { toast } from 'sonner';
import { ContractWizardDialog } from '@/components/contracts/contract-wizard/wizard-dialog';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { TemplatePicker } from '@/components/workflows/template-picker-dialog';
import { useResourceMutation } from '@/hooks/use-resource-mutation';
import { getAvatarInitials } from '@/lib/avatar-initials';
import { enumKey } from '@/lib/enum-key';
import { trpc } from '@/trpc/init';
import type { ContractorAction } from '../actions';
import { getProfileContractorActions } from '../actions';
import { tDyn, tDynLoose, tKey } from '@/i18n/typed-keys';

type LifecycleStage = 'DRAFT' | 'ONBOARDING' | 'ACTIVE' | 'OFFBOARDING' | 'ENDED';

type ProfileHeaderProps = {
  contractor: {
    id: string;
    displayName: string;
    legalName: string;
    type: string;
    lifecycleStage: string;
    owner: { id: string; name: string | null; image: string | null } | null;
  };
};

/**
 * Maps lifecycle-transition action keys to the target stage we send to
 * the `updateLifecycleStage` mutation. Kept colocated so the registry
 * stays UI-agnostic.
 */
const LIFECYCLE_TRANSITION_TARGETS: Record<string, LifecycleStage> = {
  'lifecycle.startOnboarding': 'ONBOARDING',
  'lifecycle.activate': 'ACTIVE',
  'lifecycle.startOffboarding': 'OFFBOARDING',
  'lifecycle.markInactive': 'ENDED',
  'lifecycle.completeOffboarding': 'ENDED',
};

/** Action keys promoted to primary buttons (rendered outside the kebab menu). */
const PRIMARY_BUTTON_KEYS = new Set([
  'edit',
  'addContract',
  // Workflow launchers are surfaced via a primary button per stage.
]);

export function ProfileHeader({ contractor }: ProfileHeaderProps) {
  const queryClient = useQueryClient();
  const t = useTranslations('ContractorProfile');
  const tc = useTranslations('Contractors');
  const tBulk = useTranslations('Contractors.bulkActions');
  const tToast = useTranslations('ContractorProfile.toast');
  const tCommon = useTranslations('Common');

  const [wizardOpen, setWizardOpen] = useState(false);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [pickerType, setPickerType] = useState<string | undefined>(undefined);
  const [archiveConfirmOpen, setArchiveConfirmOpen] = useState(false);

  const stage = contractor.lifecycleStage as LifecycleStage;
  const contractorPrefixKey = ['contractor'] as const;

  // ---- Mutations via canonical useResourceMutation ------------------------
  const lifecycleMutation = useResourceMutation(
    trpc.contractor.updateLifecycleStage.mutationOptions({
      onError: err => toast.error(err.message),
      onSuccess: () => {
        toast.success('Done.');
        queryClient.invalidateQueries(trpc.contractor.pathFilter());
      },
    }),
    {
      invalidate: [contractorPrefixKey, trpc.contractor.getById.queryKey()],
      // successMessage is overridden per-call via toast.success below;
      // we still need a non-empty string here to satisfy the contract.
      successMessage: t('lifecycle.transitioned', { stage }),
      errorMessage: tToast('statusFailed'),
    },
  );

  const archiveMutation = useResourceMutation(
    trpc.contractor.archive.mutationOptions({
      onError: err => toast.error(err.message),
      onSuccess: () => {
        toast.success('Done.');
        queryClient.invalidateQueries(trpc.contractor.pathFilter());
      },
    }),
    {
      invalidate: [contractorPrefixKey, trpc.contractor.getById.queryKey()],
      successMessage: t('lifecycle.archived'),
      errorMessage: tToast('archiveFailed'),
    },
  );

  const isPending = lifecycleMutation.isPending || archiveMutation.isPending;

  // ---- Registry-driven action inventory ----------------------------------
  const applicable = getProfileContractorActions({
    id: contractor.id,
    lifecycleStage: stage,
  });

  const primaryActions = applicable.filter(a => PRIMARY_BUTTON_KEYS.has(a.key));
  // Actions surfaced outside the kebab menu — exclude these to avoid
  // duplicating them inside the dropdown.
  const ROUTED_ELSEWHERE = new Set(['recomputeCompliance', 'launchWorkflow']);
  const menuActions = applicable.filter(
    a => !(PRIMARY_BUTTON_KEYS.has(a.key) || ROUTED_ELSEWHERE.has(a.key)),
  );

  // ---- Dispatchers --------------------------------------------------------
  function getActionLabel(action: ContractorAction): string {
    // next-intl namespaces are flat strings; switch on the registry-declared
    // namespace so the right `t()` is used.
    if (action.i18nNamespace === 'ContractorProfile') return tKey(t, action.labelKey);
    if (action.i18nNamespace === 'Contractors.bulkActions') return tKey(tBulk, action.labelKey);
    return tc(action.labelKey);
  }

  function dispatchPrimaryAction(action: ContractorAction) {
    switch (action.key) {
      case 'edit':
        toast.info(t('actions.editComingSoon'));
        return;
      case 'addContract':
        setWizardOpen(true);
        return;
      default:
        return;
    }
  }

  function dispatchMenuAction(action: ContractorAction) {
    if (action.key === 'profile.archive') {
      setArchiveConfirmOpen(true);
      return;
    }
    const target = LIFECYCLE_TRANSITION_TARGETS[action.key];
    if (target) {
      lifecycleMutation.mutate({ id: contractor.id, stage: target });
    }
  }

  // ---- Stage-specific workflow launcher ----------------------------------
  const workflowLauncher = (() => {
    if (stage === 'DRAFT' || stage === 'ONBOARDING') {
      return {
        labelKey: 'actions.startOnboarding',
        pickerType: 'ONBOARDING' as const,
      };
    }
    if (stage === 'ACTIVE' || stage === 'OFFBOARDING') {
      return {
        labelKey: 'actions.startWorkflow',
        pickerType: stage === 'ACTIVE' ? ('OFFBOARDING' as const) : undefined,
      };
    }
    return null;
  })();

  return (
    <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
      <div className="flex items-center gap-3">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="font-display text-[24px] font-semibold leading-tight tracking-tight">
              {contractor.displayName}
            </h1>
            <AtelierStatusPill
              variant={statusToVariant(
                'contractor-lifecycle',
                stage satisfies ContractorLifecycleStageInput,
              )}>
              {tDynLoose(t, 'lifecycle', enumKey(stage)) ?? stage}
            </AtelierStatusPill>
            <Badge variant="secondary" className="bg-secondary text-secondary-foreground">
              {tc(`type.${enumKey(contractor.type)}` as Parameters<typeof tc>[0])}
            </Badge>
          </div>
          {!!contractor.owner && (
            <div className="mt-1 flex items-center gap-1.5">
              <Avatar size="sm">
                {!!contractor.owner.image && (
                  <AvatarImage src={contractor.owner.image} alt={contractor.owner.name ?? ''} />
                )}
                <AvatarFallback>{getAvatarInitials(contractor.owner.name)}</AvatarFallback>
              </Avatar>
              <span className="text-sm text-muted-foreground">
                {contractor.owner.name ?? t('unknown')}
              </span>
            </div>
          )}
        </div>
      </div>

      <div className="flex items-center gap-2">
        {primaryActions.map(action => {
          const Icon = action.icon;
          return (
            <Button
              key={action.key}
              variant="outline"
              size="sm"
              // biome-ignore lint/nursery/noJsxPropsBind: callback in JSX prop
              onClick={() => dispatchPrimaryAction(action)}>
              <Icon className={`me-1.5 ${iconSize.sm}`} />
              {getActionLabel(action)}
            </Button>
          );
        })}

        {!!workflowLauncher && (
          <Button
            variant="outline"
            size="sm"
            // biome-ignore lint/nursery/noJsxPropsBind: callback in JSX prop
            onClick={() => {
              setPickerType(workflowLauncher.pickerType);
              setPickerOpen(true);
            }}>
            <Play className={`me-1.5 ${iconSize.sm}`} />
            {tKey(t, workflowLauncher.labelKey)}
          </Button>
        )}

        {menuActions.length > 0 && (
          <DropdownMenu>
            <DropdownMenuTrigger
              // biome-ignore lint/nursery/noJsxPropsBind: render-prop pattern for headless UI
              render={props => (
                <Button {...props} variant="outline" size="icon-sm">
                  <MoreHorizontal className={iconSize.md} />
                  <span className="sr-only">{tCommon('srOnly.moreActions')}</span>
                </Button>
              )}
            />
            <DropdownMenuContent align="end">
              {menuActions.map(action => (
                <DropdownMenuItem
                  key={action.key}
                  disabled={isPending}
                  variant={action.variant}
                  // biome-ignore lint/nursery/noJsxPropsBind: menu item handler
                  onSelect={() => dispatchMenuAction(action)}>
                  {getActionLabel(action)}
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
        )}
      </div>

      {/* Contract wizard dialog */}
      <ContractWizardDialog
        open={wizardOpen}
        onOpenChange={setWizardOpen}
        contractorId={contractor.id}
      />

      {/* Workflow template picker */}
      <TemplatePicker
        open={pickerOpen}
        onOpenChange={setPickerOpen}
        contractorId={contractor.id}
        preFilterType={pickerType}
      />

      {/* Archive confirmation */}
      <AlertDialog open={archiveConfirmOpen} onOpenChange={setArchiveConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t('lifecycle.archiveConfirmTitle')}</AlertDialogTitle>
            <AlertDialogDescription>{t('lifecycle.archiveConfirmBody')}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{tCommon('cancel')}</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                archiveMutation.mutate({ id: contractor.id });
                setArchiveConfirmOpen(false);
              }}
              disabled={archiveMutation.isPending}
              variant="destructive">
              {t('lifecycle.archiveConfirm')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
