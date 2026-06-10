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
import { useCallback, useState } from 'react';
import { toast } from 'sonner';
import { tDynLoose, tKey } from '../../../i18n/typed-keys.js';
import { useTranslations } from '../../../i18n/useTranslations.js';
import { getAvatarInitials } from '../../../lib/avatar-initials.js';
import { enumKey } from '../../../lib/enum-key.js';
import { ContractWizardDialog } from '../../contracts/contract-wizard/wizard-dialog.js';
import { OffboardingTrajectoryBannerWired } from '../../saudization/offboarding-trajectory-banner.js';
import { TemplatePickerDialog } from '../../workflows/template-picker-dialog.js';
import type { ContractorAction } from '../actions.js';
import { getProfileContractorActions } from '../actions.js';
import type { useContractorProfileActions as UseContractorProfileActions } from '../hooks/use-contractor-profile.js';
import { useContractorProfileActions } from '../hooks/use-contractor-profile.js';

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
  ReturnType<typeof UseContractorProfileActions>,
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

function PrimaryActionButton({
  action,
  label,
  onClick,
}: {
  action: ContractorAction;
  label: string;
  onClick: (action: ContractorAction) => void;
}) {
  const Icon = action.icon;
  const handleClick = useCallback(() => onClick(action), [onClick, action]);
  return (
    <Button variant="outline" size="sm" onClick={handleClick}>
      <Icon className={`me-1.5 ${iconSize.sm}`} />
      {label}
    </Button>
  );
}

function WorkflowLauncherButton({
  pickerType,
  label,
  onStart,
}: {
  pickerType: string | undefined;
  label: string;
  onStart: (pickerType: string | undefined) => void;
}) {
  const handleClick = useCallback(() => onStart(pickerType), [onStart, pickerType]);
  return (
    <Button variant="outline" size="sm" onClick={handleClick}>
      <Play className={`me-1.5 ${iconSize.sm}`} />
      {label}
    </Button>
  );
}

function MenuActionItem({
  action,
  label,
  disabled,
  onSelect,
}: {
  action: ContractorAction;
  label: string;
  disabled: boolean;
  onSelect: (action: ContractorAction) => void;
}) {
  const handleSelect = useCallback(() => onSelect(action), [onSelect, action]);
  return (
    <DropdownMenuItem disabled={disabled} variant={action.variant} onSelect={handleSelect}>
      {label}
    </DropdownMenuItem>
  );
}

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

  const getActionLabel = useCallback(
    (action: ContractorAction): string => {
      if (action.i18nNamespace === 'ContractorProfile') return tKey(t, action.labelKey);
      if (action.i18nNamespace === 'Contractors.bulkActions') return tKey(tBulk, action.labelKey);
      return tKey(tc, action.labelKey);
    },
    [t, tBulk, tc],
  );

  const dispatchPrimaryAction = useCallback(
    (action: ContractorAction) => {
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
    },
    [t],
  );

  const dispatchMenuAction = useCallback(
    (action: ContractorAction) => {
      if (action.key === 'profile.archive') {
        setArchiveConfirmOpen(true);
        return;
      }
      const target = LIFECYCLE_TRANSITION_TARGETS[action.key];
      if (target) {
        transitionLifecycle(target);
      }
    },
    [transitionLifecycle],
  );

  const handleStartWorkflow = useCallback((nextType: string | undefined) => {
    setPickerType(nextType);
    setPickerOpen(true);
  }, []);

  const handleArchiveConfirm = useCallback(() => {
    archive();
    setArchiveConfirmOpen(false);
  }, [archive]);

  const renderMoreActionsTrigger = useCallback(
    (props: React.ComponentProps<typeof Button>) => (
      <Button {...props} variant="outline" size="icon-sm">
        <MoreHorizontal className={iconSize.md} />
        <span className="sr-only">{tCommon('srOnly.moreActions')}</span>
      </Button>
    ),
    [tCommon],
  );

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
        {primaryActions.map(action => (
          <PrimaryActionButton
            key={action.key}
            action={action}
            label={getActionLabel(action)}
            onClick={dispatchPrimaryAction}
          />
        ))}

        {workflowLauncher ? (
          <WorkflowLauncherButton
            pickerType={workflowLauncher.pickerType}
            label={tKey(t, workflowLauncher.labelKey)}
            onStart={handleStartWorkflow}
          />
        ) : null}

        {menuActions.length > 0 ? (
          <DropdownMenu>
            <DropdownMenuTrigger render={renderMoreActionsTrigger} />
            <DropdownMenuContent align="end">
              {menuActions.map(action => (
                <MenuActionItem
                  key={action.key}
                  action={action}
                  label={getActionLabel(action)}
                  disabled={isPending}
                  onSelect={dispatchMenuAction}
                />
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
        ) : null}
      </div>

      <ContractWizardDialog
        open={wizardOpen}
        onOpenChange={setWizardOpen}
        contractorId={contractor.id}
      />

      <TemplatePickerDialog
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
              onClick={handleArchiveConfirm}
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

type ProfileHeaderContainerProps = {
  contractor: ProfileHeaderContractor & { isSaudi?: boolean | null };
};

export function ProfileHeaderContainer({ contractor }: ProfileHeaderContainerProps) {
  const stage = contractor.lifecycleStage as LifecycleStage;
  const actions = useContractorProfileActions(contractor.id, stage);
  return (
    <div className="space-y-4">
      <ProfileHeaderView contractor={contractor} {...actions} />
      {stage === 'OFFBOARDING' ? (
        <OffboardingTrajectoryBannerWired isSaudi={contractor.isSaudi ?? null} />
      ) : null}
    </div>
  );
}

/** @deprecated Use ProfileHeader */
export { ProfileHeaderContainer as ProfileHeader };
