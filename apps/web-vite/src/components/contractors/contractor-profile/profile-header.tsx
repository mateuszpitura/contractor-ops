import type { ContractorLifecycleStageInput } from '@contractor-ops/ui';
import { AtelierStatusPill, iconSize, statusToVariant } from '@contractor-ops/ui';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@contractor-ops/ui/components/shadcn/alert-dialog';
import { Avatar, AvatarFallback, AvatarImage } from '@contractor-ops/ui/components/shadcn/avatar';
import { Badge } from '@contractor-ops/ui/components/shadcn/badge';
import { Button } from '@contractor-ops/ui/components/shadcn/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@contractor-ops/ui/components/shadcn/dropdown-menu';
import { MoreHorizontal, Play } from 'lucide-react';
import { useState } from 'react';
import { toast } from 'sonner';
import { tDynLoose, tKey } from '../../../i18n/typed-keys.js';
import { useTranslations } from '../../../i18n/useTranslations.js';
import { getAvatarInitials } from '../../../lib/avatar-initials.js';
import { enumKey } from '../../../lib/enum-key.js';
import { ContractWizardDialogContainer } from '../../contracts/contract-wizard/wizard-dialog-container.js';
import { TemplatePickerContainer } from '../../workflows/template-picker-container.js';
import type { ContractorAction } from '../actions.js';
import { getProfileContractorActions } from '../actions.js';
import type { useContractorProfileActions } from '../hooks/use-contractor-profile.js';

type LifecycleStage = 'DRAFT' | 'ONBOARDING' | 'ACTIVE' | 'OFFBOARDING' | 'ENDED';

export type ProfileHeaderContractor = {
  id: string;
  displayName: string;
  legalName: string;
  type: string;
  lifecycleStage: string;
  owner: { id: string; name: string | null; image: string | null } | null;
};

export type ProfileHeaderViewProps = {
  contractor: ProfileHeaderContractor;
} & Pick<
  ReturnType<typeof useContractorProfileActions>,
  'transitionLifecycle' | 'archive' | 'isPending'
>;

const LIFECYCLE_TRANSITION_TARGETS: Record<string, LifecycleStage> = {
  'lifecycle.startOnboarding': 'ONBOARDING',
  'lifecycle.activate': 'ACTIVE',
  'lifecycle.startOffboarding': 'OFFBOARDING',
  'lifecycle.markInactive': 'ENDED',
  'lifecycle.completeOffboarding': 'ENDED',
};

const PRIMARY_BUTTON_KEYS = new Set(['edit', 'addContract']);

export function ProfileHeaderView({
  contractor,
  transitionLifecycle,
  archive,
  isPending,
}: ProfileHeaderViewProps) {
  const t = useTranslations('ContractorProfile');
  const tc = useTranslations('Contractors');
  const tBulk = useTranslations('Contractors.bulkActions');
  const tCommon = useTranslations('Common');

  const [wizardOpen, setWizardOpen] = useState(false);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [pickerType, setPickerType] = useState<string | undefined>(undefined);
  const [archiveConfirmOpen, setArchiveConfirmOpen] = useState(false);

  const stage = contractor.lifecycleStage as LifecycleStage;

  const applicable = getProfileContractorActions({
    id: contractor.id,
    lifecycleStage: stage,
  });

  const primaryActions = applicable.filter(a => PRIMARY_BUTTON_KEYS.has(a.key));
  const ROUTED_ELSEWHERE = new Set(['recomputeCompliance', 'launchWorkflow']);
  const menuActions = applicable.filter(
    a => !(PRIMARY_BUTTON_KEYS.has(a.key) || ROUTED_ELSEWHERE.has(a.key)),
  );

  function getActionLabel(action: ContractorAction): string {
    if (action.i18nNamespace === 'ContractorProfile') return tKey(t, action.labelKey);
    if (action.i18nNamespace === 'Contractors.bulkActions') return tKey(tBulk, action.labelKey);
    return tKey(tc, action.labelKey);
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
      transitionLifecycle(target);
    }
  }

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
              {tDynLoose(tc, 'type', enumKey(contractor.type))}
            </Badge>
          </div>
          {contractor.owner ? (
            <div className="mt-1 flex items-center gap-1.5">
              <Avatar size="sm">
                {contractor.owner.image ? (
                  <AvatarImage src={contractor.owner.image} alt={contractor.owner.name ?? ''} />
                ) : null}
                <AvatarFallback>{getAvatarInitials(contractor.owner.name)}</AvatarFallback>
              </Avatar>
              <span className="text-sm text-muted-foreground">
                {contractor.owner.name ?? t('unknown')}
              </span>
            </div>
          ) : null}
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
              onClick={() => dispatchPrimaryAction(action)}>
              <Icon className={`me-1.5 ${iconSize.sm}`} />
              {getActionLabel(action)}
            </Button>
          );
        })}

        {workflowLauncher ? (
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              setPickerType(workflowLauncher.pickerType);
              setPickerOpen(true);
            }}>
            <Play className={`me-1.5 ${iconSize.sm}`} />
            {tKey(t, workflowLauncher.labelKey)}
          </Button>
        ) : null}

        {menuActions.length > 0 ? (
          <DropdownMenu>
            <DropdownMenuTrigger
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
                  onSelect={() => dispatchMenuAction(action)}>
                  {getActionLabel(action)}
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
        ) : null}
      </div>

      <ContractWizardDialogContainer
        open={wizardOpen}
        onOpenChange={setWizardOpen}
        contractorId={contractor.id}
      />

      <TemplatePickerContainer
        open={pickerOpen}
        onOpenChange={setPickerOpen}
        contractorId={contractor.id}
        preFilterType={pickerType}
      />

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
                archive();
                setArchiveConfirmOpen(false);
              }}
              disabled={isPending}
              variant="destructive">
              {t('lifecycle.archiveConfirm')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
