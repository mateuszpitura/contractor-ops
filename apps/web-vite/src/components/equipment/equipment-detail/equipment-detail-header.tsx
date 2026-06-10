import { Badge } from '@contractor-ops/ui/components/shadcn/badge';
import { Button } from '@contractor-ops/ui/components/shadcn/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@contractor-ops/ui/components/shadcn/dialog';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@contractor-ops/ui/components/shadcn/dropdown-menu';
import { Archive, MoreHorizontal, Pencil, Truck, UserMinus, UserPlus } from 'lucide-react';
import { useCallback, useState } from 'react';
import { tDynLoose } from '../../../i18n/typed-keys.js';
import { useTranslations } from '../../../i18n/useTranslations.js';
import { enumKey } from '../../../lib/enum-key.js';
import { EquipmentStatusBadge } from '../equipment-status-badge.js';
import { EquipmentTypeIcon } from '../equipment-type-icon.js';
import { useEquipmentRetire, useEquipmentUnassign } from '../hooks/use-equipment-detail-actions.js';

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

export interface EquipmentDetailHeaderProps {
  equipment: Equipment;
  onEdit: () => void;
  onAssign: () => void;
  onCreateShipment: () => void;
  retireDialogOpen: boolean;
  setRetireDialogOpen: (open: boolean) => void;
  unassignDialogOpen: boolean;
  setUnassignDialogOpen: (open: boolean) => void;
  retireMutation: ReturnType<typeof useEquipmentRetire>['mutation'];
  retire: ReturnType<typeof useEquipmentRetire>['retire'];
  unassignMutation: ReturnType<typeof useEquipmentUnassign>['mutation'];
  unassign: ReturnType<typeof useEquipmentUnassign>['unassign'];
}

export function EquipmentDetailHeaderView({
  equipment,
  onEdit,
  onAssign,
  onCreateShipment,
  retireDialogOpen,
  setRetireDialogOpen,
  unassignDialogOpen,
  setUnassignDialogOpen,
  retireMutation,
  retire,
  unassignMutation,
  unassign,
}: EquipmentDetailHeaderProps) {
  const t = useTranslations('Equipment');
  const tCommon = useTranslations('Common');

  const isAssigned = equipment.status === 'ASSIGNED';
  const isRetired = equipment.status === 'RETIRED';

  const contractorName =
    equipment.currentAssignment?.contractor.displayName ??
    equipment.currentAssignment?.contractor.legalName ??
    '';

  const handleOpenUnassign = useCallback(
    () => setUnassignDialogOpen(true),
    [setUnassignDialogOpen],
  );
  const handleCloseUnassign = useCallback(
    () => setUnassignDialogOpen(false),
    [setUnassignDialogOpen],
  );
  const handleOpenRetire = useCallback(() => setRetireDialogOpen(true), [setRetireDialogOpen]);
  const handleCloseRetire = useCallback(() => setRetireDialogOpen(false), [setRetireDialogOpen]);
  const handleConfirmRetire = useCallback(() => retire(equipment.id), [retire, equipment.id]);
  const handleConfirmUnassign = useCallback(() => unassign(equipment.id), [unassign, equipment.id]);

  const renderDropdownTrigger = useCallback(
    (props: React.ComponentProps<typeof Button>) => (
      <Button {...props} variant="outline" size="icon-sm">
        <MoreHorizontal className="size-4" />
        <span className="sr-only">{tCommon('srOnly.moreActions')}</span>
      </Button>
    ),
    [tCommon],
  );

  return (
    <>
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="flex items-center gap-2">
            <EquipmentTypeIcon type={equipment.type} className="h-5 w-5" />
            <h1 className="font-display text-2xl font-semibold tracking-tight">{equipment.name}</h1>
          </div>
          <div className="mt-1 flex items-center gap-2">
            {!!equipment.serialNumber && (
              <span className="font-mono text-sm text-muted-foreground">
                {equipment.serialNumber}
              </span>
            )}
            <Badge variant="secondary">{tDynLoose(t, 'type', enumKey(equipment.type))}</Badge>
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
            <Button variant="outline" size="sm" onClick={handleOpenUnassign}>
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
            <DropdownMenuTrigger render={renderDropdownTrigger} />
            <DropdownMenuContent align="end">
              {!(isRetired || isAssigned) && (
                <DropdownMenuItem variant="destructive" onSelect={handleOpenRetire}>
                  <Archive className="me-2 h-3.5 w-3.5" />
                  {t('detail.retire')}
                </DropdownMenuItem>
              )}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      <Dialog open={retireDialogOpen} onOpenChange={setRetireDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t('detail.retireConfirmTitle')}</DialogTitle>
            <DialogDescription>{t('detail.retireConfirmDescription')}</DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={handleCloseRetire}
              disabled={retireMutation.isPending}>
              {t('form.cancel')}
            </Button>
            <Button
              variant="destructive"
              onClick={handleConfirmRetire}
              disabled={retireMutation.isPending}>
              {t('detail.retire')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

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
              onClick={handleCloseUnassign}
              disabled={unassignMutation.isPending}>
              {t('form.cancel')}
            </Button>
            <Button
              variant="destructive"
              onClick={handleConfirmUnassign}
              disabled={unassignMutation.isPending}>
              {t('detail.unassignEquipment')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

type EquipmentDetailHeaderWiredProps = Pick<
  EquipmentDetailHeaderProps,
  'equipment' | 'onEdit' | 'onAssign' | 'onCreateShipment'
>;

export function EquipmentDetailHeader(props: EquipmentDetailHeaderWiredProps) {
  const [retireDialogOpen, setRetireDialogOpen] = useState(false);
  const [unassignDialogOpen, setUnassignDialogOpen] = useState(false);

  const { mutation: retireMutation, retire } = useEquipmentRetire({
    onSuccess: () => setRetireDialogOpen(false),
  });
  const { mutation: unassignMutation, unassign } = useEquipmentUnassign({
    onSuccess: () => setUnassignDialogOpen(false),
  });

  return (
    <EquipmentDetailHeaderView
      {...props}
      retireDialogOpen={retireDialogOpen}
      setRetireDialogOpen={setRetireDialogOpen}
      unassignDialogOpen={unassignDialogOpen}
      setUnassignDialogOpen={setUnassignDialogOpen}
      retireMutation={retireMutation}
      retire={retire}
      unassignMutation={unassignMutation}
      unassign={unassign}
    />
  );
}
