'use client';

import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Archive, MoreHorizontal, Pencil, Truck, UserMinus, UserPlus } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useState } from 'react';
import { toast } from 'sonner';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { trpc } from '@/trpc/init';
import { EquipmentStatusBadge } from '../equipment-status-badge';
import { EquipmentTypeIcon } from '../equipment-type-icon';
import { enumKey } from '@/lib/enum-key';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface Equipment {
  id: string;
  name: string;
  serialNumber: string | null;
  type: string;
  customType: string | null;
  status: string;
  currentAssignment: {
    id: string;
    contractorId: string;
    contractor: {
      id: string;
      legalName: string;
      displayName: string | null;
    };
  } | null;
}

interface EquipmentDetailHeaderProps {
  equipment: Equipment;
  onEdit: () => void;
  onAssign: () => void;
  onCreateShipment: () => void;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function EquipmentDetailHeader({
  equipment,
  onEdit,
  onAssign,
  onCreateShipment,
}: EquipmentDetailHeaderProps) {
  const t = useTranslations('Equipment');
  const tCommon = useTranslations('Common');
  const queryClient = useQueryClient();

  const [retireDialogOpen, setRetireDialogOpen] = useState(false);
  const [unassignDialogOpen, setUnassignDialogOpen] = useState(false);

  const isAssigned = equipment.status === 'ASSIGNED';
  const isRetired = equipment.status === 'RETIRED';

  const retireMutation = useMutation(
    trpc.equipment.retire.mutationOptions({
      onSuccess: () => {
        toast.success(t('toast.retired'));
        queryClient.invalidateQueries({
          queryKey: trpc.equipment.getById.queryKey(),
        });
        queryClient.invalidateQueries({
          queryKey: trpc.equipment.list.queryKey(),
        });
        setRetireDialogOpen(false);
      },
      onError: () => {
        toast.error(t('error.actionFailed'));
      },
    }),
  );

  const unassignMutation = useMutation(
    trpc.equipment.unassign.mutationOptions({
      onSuccess: () => {
        toast.success(t('toast.unassigned'));
        queryClient.invalidateQueries({
          queryKey: trpc.equipment.getById.queryKey(),
        });
        queryClient.invalidateQueries({
          queryKey: trpc.equipment.list.queryKey(),
        });
        setUnassignDialogOpen(false);
      },
      onError: () => {
        toast.error(t('error.actionFailed'));
      },
    }),
  );

  const contractorName =
    equipment.currentAssignment?.contractor.displayName ??
    equipment.currentAssignment?.contractor.legalName ??
    '';

  return (
    <>
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="flex items-center gap-2">
            <EquipmentTypeIcon type={equipment.type} className="h-5 w-5" />
            <h1 className="text-2xl font-semibold">{equipment.name}</h1>
          </div>
          <div className="mt-1 flex items-center gap-2">
            {!!equipment.serialNumber && (
              <span className="font-mono text-sm text-muted-foreground">
                {equipment.serialNumber}
              </span>
            )}
            <Badge variant="secondary">
              {t(`type.${enumKey(equipment.type)}` as Parameters<typeof t>[0])}
            </Badge>
            <EquipmentStatusBadge status={equipment.status} />
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={onEdit}>
            <Pencil className="me-1.5 size-3.5" />
            {t('detail.edit')}
          </Button>

          {!(isRetired || isAssigned) && (
            <Button variant="outline" size="sm" onClick={onAssign}>
              <UserPlus className="me-1.5 size-3.5" />
              {t('detail.assignToContractor')}
            </Button>
          )}

          {isAssigned && (
            // biome-ignore lint/nursery/noJsxPropsBind: callback in JSX prop
            <Button variant="outline" size="sm" onClick={() => setUnassignDialogOpen(true)}>
              <UserMinus className="me-1.5 size-3.5" />
              {t('detail.unassignEquipment')}
            </Button>
          )}

          {!isRetired && (
            <Button variant="outline" size="sm" onClick={onCreateShipment}>
              <Truck className="me-1.5 size-3.5" />
              {t('detail.createShipment')}
            </Button>
          )}

          <DropdownMenu>
            <DropdownMenuTrigger
              // biome-ignore lint/nursery/noJsxPropsBind: render-prop pattern for headless UI
              render={props => (
                <Button {...props} variant="outline" size="icon-sm">
                  <MoreHorizontal className="size-4" />
                  <span className="sr-only">
                    {tCommon('srOnly.moreActions' as Parameters<typeof tCommon>[0])}
                  </span>
                </Button>
              )}
            />
            <DropdownMenuContent align="end">
              {!(isRetired || isAssigned) && (
                // biome-ignore lint/nursery/noJsxPropsBind: menu item handler
                <DropdownMenuItem variant="destructive" onSelect={() => setRetireDialogOpen(true)}>
                  <Archive className="me-2 h-3.5 w-3.5" />
                  {t('detail.retire')}
                </DropdownMenuItem>
              )}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      {/* Retire confirmation dialog */}
      <Dialog open={retireDialogOpen} onOpenChange={setRetireDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t('detail.retireConfirmTitle')}</DialogTitle>
            <DialogDescription>{t('detail.retireConfirmDescription')}</DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="outline"
              // biome-ignore lint/nursery/noJsxPropsBind: callback in JSX prop
              onClick={() => setRetireDialogOpen(false)}
              disabled={retireMutation.isPending}>
              {t('form.cancel')}
            </Button>
            <Button
              variant="destructive"
              // biome-ignore lint/nursery/noJsxPropsBind: callback in JSX prop
              onClick={() => retireMutation.mutate({ id: equipment.id })}
              disabled={retireMutation.isPending}>
              {t('detail.retire')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Unassign confirmation dialog */}
      <Dialog open={unassignDialogOpen} onOpenChange={setUnassignDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t('detail.unassignConfirmTitle')}</DialogTitle>
            <DialogDescription>
              {t('detail.unassignConfirmDescription', {
                contractorName,
              })}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="outline"
              // biome-ignore lint/nursery/noJsxPropsBind: callback in JSX prop
              onClick={() => setUnassignDialogOpen(false)}
              disabled={unassignMutation.isPending}>
              {t('form.cancel')}
            </Button>
            <Button
              variant="destructive"
              // biome-ignore lint/nursery/noJsxPropsBind: callback in JSX prop
              onClick={() => unassignMutation.mutate({ equipmentId: equipment.id })}
              disabled={unassignMutation.isPending}>
              {t('detail.unassignEquipment')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
