import { AtelierEmptyState, EquipmentIllustration, SectionLabel } from '@contractor-ops/ui';
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
import { Card, CardContent } from '@contractor-ops/ui/components/shadcn/card';
import { Skeleton } from '@contractor-ops/ui/components/shadcn/skeleton';
import { format } from 'date-fns';
import { AlertCircle, Loader2, RotateCcw, XCircle } from 'lucide-react';
import type { useTranslations } from '../../i18n/useTranslations.js';
import { EquipmentStatusBadge } from '../equipment/equipment-status-badge.js';
import { EquipmentTypeIcon } from '../equipment/equipment-type-icon.js';
import { renderEmptyStateAction } from '../shared/atelier-bridges.js';
import type { PortalEquipmentItem, PortalReturnRequest } from './hooks/use-portal-equipment.js';

interface PortalEquipmentTabProps {
  t: ReturnType<typeof useTranslations>;
  tReturn: ReturnType<typeof useTranslations>;
  isPending: boolean;
  isError: boolean;
  equipment: PortalEquipmentItem[];
  returnRequest: PortalReturnRequest;
  canReturn: boolean;
  hasActiveReturn: boolean;
  onReturnClick: () => void;
  onViewLabelClick: () => void;
  onCancelReturnClick: () => void;
  cancelDialogOpen: boolean;
  onCancelDialogOpenChange: (open: boolean) => void;
  onConfirmCancelReturn: () => void;
  isCancelling: boolean;
  errorMessage: string;
}

export function PortalEquipmentTab({
  t,
  tReturn,
  isPending,
  isError,
  equipment,
  returnRequest,
  canReturn,
  hasActiveReturn,
  onReturnClick,
  onViewLabelClick,
  onCancelReturnClick,
  cancelDialogOpen,
  onCancelDialogOpenChange,
  onConfirmCancelReturn,
  isCancelling,
  errorMessage,
}: PortalEquipmentTabProps) {
  if (isPending) {
    return (
      <div className="space-y-8">
        <div className="flex items-center gap-3">
          <div className="flex-1">
            <SectionLabel variant="portal">{t('title')}</SectionLabel>
          </div>
          <Skeleton className="h-9 w-32" />
        </div>
        <div className="space-y-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <Card key={`skel-${i}`}>
              <CardContent className="flex items-center gap-4 p-4">
                <Skeleton className="h-6 w-6 shrink-0 rounded" />
                <div className="min-w-0 flex-1 space-y-2">
                  <div className="flex items-center gap-2">
                    <Skeleton className="h-4 w-40" />
                    <Skeleton className="h-5 w-20 rounded-full" />
                  </div>
                  <div className="flex items-center gap-3">
                    <Skeleton className="h-3 w-28" />
                    <Skeleton className="h-3 w-36" />
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    );
  }

  if (isError) {
    return (
      <div className="space-y-8">
        <SectionLabel variant="portal">{t('title')}</SectionLabel>
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <AlertCircle className="h-10 w-10 text-destructive" />
          <p className="mt-4 text-sm text-muted-foreground">{errorMessage}</p>
        </div>
      </div>
    );
  }

  if (equipment.length === 0) {
    return (
      <div className="space-y-8">
        <SectionLabel variant="portal">{t('title')}</SectionLabel>
        <AtelierEmptyState
          variant="subview"
          illustration={EquipmentIllustration}
          heading={t('emptyTitle')}
          body={t('emptyDescription')}
          renderAction={renderEmptyStateAction}
        />
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <div className="flex items-center gap-3">
        <div className="flex-1">
          <SectionLabel variant="portal">{t('title')}</SectionLabel>
        </div>
        {canReturn && !hasActiveReturn && (
          <Button onClick={onReturnClick}>
            <RotateCcw className="me-1.5 h-3.5 w-3.5" />
            {t('returnAll')}
          </Button>
        )}
      </div>

      {returnRequest?.status === 'PENDING_APPROVAL' && (
        <div className="rounded-md border-s-4 border-warning bg-warning/10 p-4">
          <div className="flex items-center justify-between">
            <p className="text-sm font-medium">{t('pendingApproval')}</p>
            <Button variant="outline" size="sm" onClick={onCancelReturnClick}>
              {t('cancelReturn')}
            </Button>
          </div>
        </div>
      )}

      {returnRequest?.status === 'SHIPMENT_CREATED' && (
        <div className="rounded-md border-s-4 border-primary bg-primary/10 p-4">
          <div className="flex items-center justify-between">
            <p className="text-sm font-medium">{t('returnApproved')}</p>
            <Button size="sm" onClick={onViewLabelClick}>
              {t('viewLabel')}
            </Button>
          </div>
        </div>
      )}

      <div className="space-y-3">
        {equipment.map(item => (
          <Card key={item.assignmentId}>
            <CardContent className="flex items-center gap-4 p-4">
              <EquipmentTypeIcon type={item.equipment.type} className="h-6 w-6" />
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium">{item.equipment.name}</span>
                  <EquipmentStatusBadge status={item.equipment.status} />
                </div>
                <div className="mt-0.5 flex items-center gap-2 text-xs text-muted-foreground">
                  {!!item.equipment.serialNumber && (
                    <span className="font-mono">{item.equipment.serialNumber}</span>
                  )}
                  {item.latestShipment?.currentStatus === 'DELIVERED' &&
                    !!item.latestShipment.expectedDeliveryAt && (
                      <span>
                        {t('deliveredOn', {
                          date: format(
                            new Date(item.latestShipment.expectedDeliveryAt),
                            'MMM d, yyyy',
                          ),
                        })}
                      </span>
                    )}
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <AlertDialog open={cancelDialogOpen} onOpenChange={onCancelDialogOpenChange}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <XCircle className="size-4" />
              {tReturn('cancelConfirmTitle')}
            </AlertDialogTitle>
            <AlertDialogDescription>{tReturn('cancelConfirmDescription')}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isCancelling}>{tReturn('cancel')}</AlertDialogCancel>
            <AlertDialogAction
              variant="destructive"
              onClick={onConfirmCancelReturn}
              disabled={isCancelling}>
              {!!isCancelling && <Loader2 className="me-1.5 h-3.5 w-3.5 animate-spin" />}
              {tReturn('cancelConfirmTitle')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
