import type { ContractStatusInput } from '@contractor-ops/ui';
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
import { Button } from '@contractor-ops/ui/components/shadcn/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@contractor-ops/ui/components/shadcn/dropdown-menu';
import { MoreHorizontal, Trash2 } from 'lucide-react';
import { Fragment, useCallback } from 'react';

import { Link } from '../../../i18n/navigation.js';
import { tDynLoose } from '../../../i18n/typed-keys.js';
import { useTranslations } from '../../../i18n/useTranslations.js';
import { enumKey } from '../../../lib/enum-key.js';
import type { ContractAction } from '../actions.js';
import type { useContractDetailHeader as UseContractDetailHeader } from '../hooks/use-contract-detail-header.js';
import { useContractDetailHeader } from '../hooks/use-contract-detail-header.js';
import { useEditContractDialog } from '../hooks/use-edit-contract-dialog.js';
import { EditContractDialog } from './edit-contract-dialog.js';
import { SendForSignatureButton } from './send-for-signature-button.js';

type DetailHeaderProps = {
  contract: {
    id: string;
    title: string | null;
    status: string;
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
    _documentCount?: number;
    _hasConnectedProvider?: boolean;
    _contractParties?: Array<{
      name: string;
      email: string;
      role: 'signer' | 'countersigner';
    }>;
    _firstDocumentId?: string;
  };
  header: ReturnType<typeof UseContractDetailHeader>;
};

function ActionMenuItem({
  action,
  label,
  disabled,
  onDispatch,
}: {
  action: ContractAction;
  label: string;
  disabled: boolean;
  onDispatch: (action: ContractAction) => void;
}) {
  const Icon = action.icon;
  const handleSelect = useCallback(() => onDispatch(action), [action, onDispatch]);
  return (
    <DropdownMenuItem disabled={disabled} variant={action.variant} onSelect={handleSelect}>
      <Icon className={`me-2 ${iconSize.sm}`} />
      {label}
    </DropdownMenuItem>
  );
}

export function DetailHeader({ contract, header }: DetailHeaderProps) {
  const t = useTranslations('ContractDetail');
  const tEnum = useTranslations('Contracts');

  const {
    confirmDelete,
    confirmTerminate,
    deleteMutation,
    deleteOpen,
    dispatchMenuAction,
    getActionLabel,
    hasDestructive,
    hasNonDestructive,
    isPending,
    menuActions,
    notImplemented,
    setDeleteOpen,
    setTerminateOpen,
    terminateMutation,
    terminateOpen,
  } = header;

  const renderActionsTrigger = useCallback(
    (props: React.ButtonHTMLAttributes<HTMLButtonElement>) => (
      <Button {...props} variant="outline" size="sm">
        <MoreHorizontal className={`me-1.5 ${iconSize.sm}`} />
        {t('actions.label')}
      </Button>
    ),
    [t],
  );

  return (
    <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
      <div>
        <div className="flex items-center gap-3">
          <h1 className="font-display text-[20px] font-semibold leading-tight tracking-tight">
            {contract.title ?? t('untitled')}
          </h1>
          <AtelierStatusPill
            variant={statusToVariant('contract', contract.status as ContractStatusInput)}>
            {tDynLoose(tEnum, 'status', enumKey(contract.status))}
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
            <DropdownMenuTrigger render={renderActionsTrigger} />
            <DropdownMenuContent align="end">
              {menuActions.map(action => {
                const isFirstDestructive: boolean =
                  hasNonDestructive &&
                  hasDestructive &&
                  action.variant === 'destructive' &&
                  menuActions.find(a => a.variant === 'destructive')?.key === action.key;
                return (
                  <Fragment key={action.key}>
                    {!!isFirstDestructive && <DropdownMenuSeparator />}
                    <ActionMenuItem
                      action={action as ContractAction}
                      label={getActionLabel(action as ContractAction)}
                      disabled={isPending || notImplemented.has(action.key)}
                      onDispatch={dispatchMenuAction}
                    />
                  </Fragment>
                );
              })}
            </DropdownMenuContent>
          </DropdownMenu>
        )}
      </div>

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
              onClick={confirmDelete}
              disabled={deleteMutation.isPending}>
              {t('actions.deleteConfirm')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

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
              onClick={confirmTerminate}
              disabled={terminateMutation.isPending}>
              {t('actions.terminateConfirm')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

type DetailHeaderWiredProps = {
  contract: DetailHeaderProps['contract'];
};

export function DetailHeaderWired({ contract }: DetailHeaderWiredProps) {
  const header = useContractDetailHeader(contract.id, contract.status);
  const edit = useEditContractDialog(
    {
      id: contract.id,
      title: contract.title,
      startDate: contract.startDate,
      endDate: contract.endDate,
      currency: contract.currency,
      rateValueMinor: contract.rateValueMinor,
    },
    header.editOpen,
    header.setEditOpen,
  );

  return (
    <>
      <DetailHeader contract={contract} header={header} />
      {header.editOpen ? (
        <EditContractDialog open={header.editOpen} onOpenChange={header.setEditOpen} edit={edit} />
      ) : null}
    </>
  );
}
