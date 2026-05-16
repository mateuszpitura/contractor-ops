'use client';

import type { ContractStatusInput } from '@contractor-ops/ui';
import { AtelierStatusPill, iconSize, statusToVariant } from '@contractor-ops/ui';
import { useQueryClient } from '@tanstack/react-query';
import { MoreHorizontal, Trash2 } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { Fragment, useState } from 'react';
import { toast } from 'sonner';
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
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { useResourceMutation } from '@/hooks/use-resource-mutation';
import { Link, useRouter } from '@/i18n/navigation';
import { enumKey } from '@/lib/enum-key';
import { trpc } from '@/trpc/init';
import type { ContractAction } from '../actions';
import { getDetailContractActions } from '../actions';
import { EditContractDialog } from './edit-contract-dialog';
import { SendForSignatureButton } from './send-for-signature-button';
import { tKey } from '@/i18n/typed-keys';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type DetailHeaderProps = {
  contract: {
    id: string;
    title: string | null;
    status: string;
    /** Date-window + commercial-terms fields fed to the edit dialog */
    startDate: string | Date | null;
    endDate: string | Date | null;
    currency: string;
    rateValueMinor: number | null;
    contractor: {
      id: string;
      legalName: string;
      displayName: string;
      status: string;
    } | null;
    /** Whether the contract has at least one document */
    _documentCount?: number;
    /** Whether at least one e-sign provider is connected */
    _hasConnectedProvider?: boolean;
    /** Parties for signer auto-population */
    _contractParties?: Array<{
      name: string;
      email: string;
      role: 'signer' | 'countersigner';
    }>;
    /** First document ID for pre-selection */
    _firstDocumentId?: string;
  };
};

/** Action keys handled outside the kebab menu (rendered as primary buttons or */
/** via the bespoke `SendForSignatureButton` component). */
const ROUTED_ELSEWHERE = new Set(['sendForSignature']);

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function DetailHeader({ contract }: DetailHeaderProps) {
  const queryClient = useQueryClient();
  const router = useRouter();
  const t = useTranslations('ContractDetail');
  const tEnum = useTranslations('Contracts');
  const [terminateOpen, setTerminateOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);

  // ---- Mutations via canonical useResourceMutation ----------------------
  const contractByIdKey = trpc.contract.getById.queryKey();
  const terminateMutation = useResourceMutation(
    trpc.contract.transitionStatus.mutationOptions({
      onError: err => toast.error(err.message),
      onSuccess: () => {
        toast.success('Done.');
        queryClient.invalidateQueries(trpc.contract.pathFilter());
      },
    }),
    {
      invalidate: [contractByIdKey],
      successMessage: t('actions.terminateSuccess'),
      errorMessage: t('actions.terminateError'),
      onClose: () => setTerminateOpen(false),
    },
  );

  const supersedeMutation = useResourceMutation(
    trpc.contract.transitionStatus.mutationOptions({
      onError: err => toast.error(err.message),
      onSuccess: () => {
        toast.success('Done.');
        queryClient.invalidateQueries(trpc.contract.pathFilter());
      },
    }),
    {
      invalidate: [contractByIdKey],
      successMessage: t('actions.supersedeSuccess'),
      errorMessage: t('actions.supersedeError'),
    },
  );

  const deleteMutation = useResourceMutation(
    trpc.contract.delete.mutationOptions({
      onError: err => toast.error(err.message),
      onSuccess: () => {
        toast.success(t('actions.deleteSuccess'));
        queryClient.invalidateQueries(trpc.contract.pathFilter());
        router.push('/contracts');
      },
    }),
    {
      invalidate: [contractByIdKey],
      successMessage: t('actions.deleteSuccess'),
      errorMessage: t('actions.deleteError'),
      onClose: () => setDeleteOpen(false),
    },
  );

  const isPending =
    terminateMutation.isPending || supersedeMutation.isPending || deleteMutation.isPending;

  // ---- Registry-driven action inventory ---------------------------------
  const applicable = getDetailContractActions({
    id: contract.id,
    status: contract.status,
  });

  // Filter out actions handled by bespoke primary controls (SendForSignature).
  const menuActions = applicable.filter(a => !ROUTED_ELSEWHERE.has(a.key));

  function getActionLabel(action: ContractAction): string {
    // ContractDetail-namespaced actions resolve via `t`; future Contracts
    // namespace fallthrough is wired the same way as the contractors variant.
    return tKey(t, action.labelKey);
  }

  // Action keys that are wired in the UI but their backend/UX is not yet
  // implemented — they render disabled in the menu, no-op when clicked.
  const NOT_IMPLEMENTED = new Set(['addAmendment', 'uploadDocument']);

  function dispatchMenuAction(action: ContractAction) {
    if (NOT_IMPLEMENTED.has(action.key)) return;
    switch (action.key) {
      case 'edit':
        setEditOpen(true);
        return;
      case 'terminate':
        setTerminateOpen(true);
        return;
      case 'supersede':
        supersedeMutation.mutate({ id: contract.id, targetStatus: 'SUPERSEDED' });
        return;
      case 'delete':
        setDeleteOpen(true);
        return;
      default:
        return;
    }
  }

  // Whether the separator between non-destructive and destructive items should
  // appear: only if at least one of each category is present.
  const hasNonDestructive = menuActions.some(a => a.variant !== 'destructive');
  const hasDestructive = menuActions.some(a => a.variant === 'destructive');

  return (
    <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
      <div>
        <div className="flex items-center gap-3">
          <h1 className="font-display text-[20px] font-semibold leading-tight tracking-tight">
            {contract.title ?? t('untitled')}
          </h1>
          <AtelierStatusPill
            variant={statusToVariant('contract', contract.status as ContractStatusInput)}>
            {tEnum(`status.${enumKey(contract.status)}` as Parameters<typeof tEnum>[0])}
          </AtelierStatusPill>
        </div>
        {!!contract.contractor && (
          <div className="mt-1">
            <Link
              href={`/contractors/${contract.contractor.id}`}
              className="text-sm text-primary hover:underline">
              {contract.contractor.displayName}
            </Link>
          </div>
        )}
      </div>

      <div className="flex items-center gap-2">
        <SendForSignatureButton
          contractId={contract.id}
          contractStatus={contract.status}
          hasDocument={(contract._documentCount ?? 0) > 0}
          hasConnectedProvider={contract._hasConnectedProvider ?? false}
          documentId={contract._firstDocumentId}
          contractParties={contract._contractParties}
        />
        {menuActions.length > 0 && (
          <DropdownMenu>
            <DropdownMenuTrigger
              // biome-ignore lint/nursery/noJsxPropsBind: render-prop pattern for headless UI
              render={props => (
                <Button {...props} variant="outline" size="sm">
                  <MoreHorizontal className={`me-1.5 ${iconSize.sm}`} />
                  {t('actions.label')}
                </Button>
              )}
            />
            <DropdownMenuContent align="end">
              {menuActions.map(action => {
                const Icon = action.icon;
                const isFirstDestructive: boolean =
                  hasNonDestructive &&
                  hasDestructive &&
                  action.variant === 'destructive' &&
                  menuActions.find(a => a.variant === 'destructive')?.key === action.key;
                return (
                  <Fragment key={action.key}>
                    {!!isFirstDestructive && <DropdownMenuSeparator />}
                    <DropdownMenuItem
                      disabled={isPending || NOT_IMPLEMENTED.has(action.key)}
                      variant={action.variant}
                      // biome-ignore lint/nursery/noJsxPropsBind: menu item handler
                      onSelect={() => dispatchMenuAction(action)}>
                      <Icon className={`me-2 ${iconSize.sm}`} />
                      {getActionLabel(action)}
                    </DropdownMenuItem>
                  </Fragment>
                );
              })}
            </DropdownMenuContent>
          </DropdownMenu>
        )}
      </div>

      {/* Delete confirmation dialog */}
      <AlertDialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <Trash2 className="size-4" />
              {t('actions.deleteTitle', { title: contract.title ?? '' })}
            </AlertDialogTitle>
            <AlertDialogDescription>{t('actions.deleteBody')}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t('actions.cancel')}</AlertDialogCancel>
            <AlertDialogAction
              variant="destructive"
              // biome-ignore lint/nursery/noJsxPropsBind: callback in JSX prop
              onClick={() => deleteMutation.mutate({ id: contract.id })}
              disabled={deleteMutation.isPending}>
              {t('actions.deleteConfirm')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Edit contract dialog */}
      <EditContractDialog
        contract={{
          id: contract.id,
          title: contract.title,
          startDate: contract.startDate,
          endDate: contract.endDate,
          currency: contract.currency,
          rateValueMinor: contract.rateValueMinor,
        }}
        open={editOpen}
        onOpenChange={setEditOpen}
      />

      {/* Terminate confirmation dialog */}
      <AlertDialog open={terminateOpen} onOpenChange={setTerminateOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <Trash2 className="size-4" />
              {t('actions.terminateTitle', { title: contract.title ?? '' })}
            </AlertDialogTitle>
            <AlertDialogDescription>{t('actions.terminateBody')}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t('actions.cancel')}</AlertDialogCancel>
            <AlertDialogAction
              variant="destructive"
              // biome-ignore lint/nursery/noJsxPropsBind: callback in JSX prop
              onClick={() =>
                terminateMutation.mutate({
                  id: contract.id,
                  targetStatus: 'TERMINATED',
                })
              }
              disabled={terminateMutation.isPending}>
              {t('actions.terminateConfirm')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
