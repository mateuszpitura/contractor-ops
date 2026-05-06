'use client';

import type { ContractorLifecycleStageInput } from '@contractor-ops/ui';
import { AtelierStatusPill, statusToVariant } from '@contractor-ops/ui';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { FilePlus, MoreHorizontal, Pencil, Play } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useState } from 'react';
import { toast } from 'sonner';
import { ContractWizardDialog } from '@/components/contracts/contract-wizard/wizard-dialog';
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
import { getAvatarInitials } from '@/lib/avatar-initials';
import { enumKey } from '@/lib/enum-key';
import { trpc } from '@/trpc/init';

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

// Lifecycle labels are now served from translations: ContractorProfile.lifecycle.*

type LifecycleMenuItem = {
  target: LifecycleStage;
  labelKey: string;
  variant?: 'destructive';
  isArchive?: boolean;
};

const LIFECYCLE_MENU_CONFIG: Record<LifecycleStage, LifecycleMenuItem[]> = {
  DRAFT: [{ target: 'ONBOARDING', labelKey: 'actions.startOnboarding' }],
  ONBOARDING: [{ target: 'ACTIVE', labelKey: 'actions.activate' }],
  ACTIVE: [
    { target: 'OFFBOARDING', labelKey: 'actions.startOffboarding' },
    { target: 'ENDED', labelKey: 'actions.markInactive' },
  ],
  OFFBOARDING: [{ target: 'ENDED', labelKey: 'actions.completeOffboarding' }],
  ENDED: [
    { target: 'ENDED', labelKey: 'actions.archive', variant: 'destructive', isArchive: true },
  ],
};

function LifecycleMenuItems({
  stage,
  isPending,
  onLifecycleAction,
  onArchive,
  t,
}: {
  stage: LifecycleStage;
  isPending: boolean;
  onLifecycleAction: (target: LifecycleStage) => void;
  onArchive: () => void;
  t: (key: string) => string;
}) {
  const items = LIFECYCLE_MENU_CONFIG[stage] ?? [];
  return (
    <>
      {items.map(item => (
        <DropdownMenuItem
          key={item.labelKey}
          disabled={isPending}
          variant={item.variant}
          // biome-ignore lint/nursery/noJsxPropsBind: menu item handler
          onSelect={() => (item.isArchive ? onArchive() : onLifecycleAction(item.target))}>
          {t(item.labelKey)}
        </DropdownMenuItem>
      ))}
    </>
  );
}

export function ProfileHeader({ contractor }: ProfileHeaderProps) {
  const t = useTranslations('ContractorProfile');
  const tc = useTranslations('Contractors');
  const tToast = useTranslations('ContractorProfile.toast');
  const tCommon = useTranslations('Common');
  const queryClient = useQueryClient();
  const [wizardOpen, setWizardOpen] = useState(false);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [pickerType, setPickerType] = useState<string | undefined>(undefined);

  const lifecycleMutation = useMutation(
    trpc.contractor.updateLifecycleStage.mutationOptions({
      onSuccess: (_data, variables) => {
        toast.success(t('lifecycle.transitioned', { stage: variables.stage }));
        queryClient.invalidateQueries({
          queryKey: trpc.contractor.getById.queryKey(),
        });
      },
      onError: (error: unknown) => {
        const message =
          typeof error === 'object' && error && 'message' in error
            ? String((error as { message?: unknown }).message ?? '')
            : '';
        toast.error(message || tToast('statusFailed'));
      },
    }),
  );

  const archiveMutation = useMutation(
    trpc.contractor.archive.mutationOptions({
      onSuccess: () => {
        toast.success(t('lifecycle.archived'));
        queryClient.invalidateQueries({
          queryKey: trpc.contractor.getById.queryKey(),
        });
      },
      onError: (error: unknown) => {
        const message =
          typeof error === 'object' && error && 'message' in error
            ? String((error as { message?: unknown }).message ?? '')
            : '';
        toast.error(message || tToast('archiveFailed'));
      },
    }),
  );

  const stage = contractor.lifecycleStage as LifecycleStage;
  const isPending = lifecycleMutation.isPending || archiveMutation.isPending;

  function handleLifecycleAction(targetStage: LifecycleStage) {
    lifecycleMutation.mutate({ id: contractor.id, stage: targetStage });
  }

  function handleArchive() {
    archiveMutation.mutate({ id: contractor.id });
  }

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
              {t(`lifecycle.${enumKey(stage)}` as Parameters<typeof t>[0]) ?? stage}
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
        {/* biome-ignore lint/nursery/noJsxPropsBind: callback in JSX prop */}
        <Button variant="outline" size="sm" onClick={() => toast.info(t('actions.editComingSoon'))}>
          <Pencil className="me-1.5 size-3.5" />
          {t('actions.edit')}
        </Button>

        {/* biome-ignore lint/nursery/noJsxPropsBind: callback in JSX prop */}
        <Button variant="outline" size="sm" onClick={() => setWizardOpen(true)}>
          <FilePlus className="me-1.5 size-3.5" />
          {t('actions.addContract')}
        </Button>

        {(stage === 'DRAFT' || stage === 'ONBOARDING') && (
          <Button
            variant="outline"
            size="sm"
            // biome-ignore lint/nursery/noJsxPropsBind: callback in JSX prop
            onClick={() => {
              setPickerType('ONBOARDING');
              setPickerOpen(true);
            }}>
            <Play className="me-1.5 size-3.5" />
            {t('actions.startOnboarding')}
          </Button>
        )}

        {(stage === 'ACTIVE' || stage === 'OFFBOARDING') && (
          <Button
            variant="outline"
            size="sm"
            // biome-ignore lint/nursery/noJsxPropsBind: callback in JSX prop
            onClick={() => {
              setPickerType('OFFBOARDING');
              setPickerOpen(true);
            }}>
            <Play className="me-1.5 size-3.5" />
            {t('actions.startOffboarding')}
          </Button>
        )}

        <DropdownMenu>
          <DropdownMenuTrigger
            // biome-ignore lint/nursery/noJsxPropsBind: render-prop pattern for headless UI
            render={props => (
              <Button {...props} variant="outline" size="icon-sm">
                <MoreHorizontal className="size-4" />
                <span className="sr-only">{tCommon('srOnly.moreActions')}</span>
              </Button>
            )}
          />
          <DropdownMenuContent align="end">
            <LifecycleMenuItems
              stage={stage}
              isPending={isPending}
              // biome-ignore lint/nursery/noJsxPropsBind: callback in JSX prop
              onLifecycleAction={handleLifecycleAction}
              // biome-ignore lint/nursery/noJsxPropsBind: callback in JSX prop
              onArchive={handleArchive}
              t={t}
            />
          </DropdownMenuContent>
        </DropdownMenu>
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
    </div>
  );
}
