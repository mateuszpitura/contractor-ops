import {
  AtelierEmptyState,
  AtelierTableShell,
  EquipmentIllustration,
  TableChrome,
} from '@contractor-ops/ui';
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
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '@contractor-ops/ui/components/shadcn/sheet';
import { Skeleton } from '@contractor-ops/ui/components/shadcn/skeleton';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@contractor-ops/ui/components/shadcn/table';
import { format } from 'date-fns';
import { Download, Eye, Loader2, Trash2, Truck } from 'lucide-react';
import { useCallback, useState } from 'react';
import { toast } from 'sonner';

import { useTranslations } from '../../../i18n/useTranslations.js';
import type { useEquipmentShipments } from '../hooks/use-equipment-shipments.js';
import { ShipmentStatusBadge } from '../shipment-status-badge.js';
import { ReturnApprovalBannerContainer } from './return-approval-banner-container.js';
import { ShipmentTimelineContainer } from './shipment-timeline-container.js';

interface PendingReturn {
  id: string;
  contractorName: string;
  itemCount: number;
  targetPointName: string;
  createdAt: string | Date;
}

export interface TabShipmentsProps {
  equipmentId: string;
  onCreateShipment: () => void;
  pendingReturn?: PendingReturn | null;
}

type ShipmentsHookState = ReturnType<typeof useEquipmentShipments>;

export type TabShipmentsViewProps = TabShipmentsProps &
  ShipmentsHookState & {
    selectedShipmentId: string | null;
    setSelectedShipmentId: (id: string | null) => void;
  };

function PendingReturnBanner({
  pendingReturn,
}: {
  pendingReturn: PendingReturn | null | undefined;
}) {
  if (!pendingReturn) return null;
  const normalized = {
    ...pendingReturn,
    createdAt: new Date(pendingReturn.createdAt).toISOString(),
  };
  return <ReturnApprovalBannerContainer returnRequest={normalized} />;
}

export function TabShipmentsSkeleton({ pendingReturn }: { pendingReturn?: PendingReturn | null }) {
  return (
    <div className="space-y-3">
      <PendingReturnBanner pendingReturn={pendingReturn} />
      <div className="rounded-xl border bg-background">
        <div className="space-y-2 p-4">
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={`shipment-skel-${i}`} className="h-10 w-full" />
          ))}
        </div>
      </div>
    </div>
  );
}

export function TabShipmentsError({ onRetry }: { onRetry: () => void }) {
  const t = useTranslations('Equipment');
  return (
    <div className="flex flex-col items-center justify-center gap-3 rounded-xl border bg-background p-8 text-center">
      <p className="text-sm text-muted-foreground">{t('error.loadFailed')}</p>
      <Button variant="outline" size="sm" onClick={onRetry}>
        {t('detail.retry')}
      </Button>
    </div>
  );
}

export function TabShipmentsEmpty({
  pendingReturn,
  onCreateShipment,
}: {
  pendingReturn?: PendingReturn | null;
  onCreateShipment: () => void;
}) {
  const t = useTranslations('Equipment');
  return (
    <div className="space-y-4">
      <PendingReturnBanner pendingReturn={pendingReturn} />
      <AtelierEmptyState
        variant="subview"
        illustration={EquipmentIllustration}
        heading={t('detail.shipmentsEmpty')}
        body={t('detail.shipmentsEmptyDescription')}
        primaryAction={{
          label: t('detail.createShipment'),
          onClick: onCreateShipment,
          icon: Truck,
        }}
        renderAction={(action, variant) => {
          const Icon = action.icon;
          return (
            <Button
              variant={variant === 'secondary' ? 'outline' : 'default'}
              onClick={action.onClick}>
              {Icon ? <Icon className="me-1.5 size-4" /> : null}
              {action.label}
            </Button>
          );
        }}
      />
    </div>
  );
}

export function TabShipmentsView({
  onCreateShipment,
  pendingReturn,
  shipments,
  detailQuery,
  deleteMutation,
  fetchLabel,
  selectedShipmentId,
  setSelectedShipmentId,
}: TabShipmentsViewProps) {
  const t = useTranslations('Equipment');
  const tAria = useTranslations('Common.aria');

  const [deleteTarget, setDeleteTarget] = useState<string | null>(null);
  const [labelLoadingId, setLabelLoadingId] = useState<string | null>(null);

  const handleFetchLabel = useCallback(
    async (shipmentId: string) => {
      setLabelLoadingId(shipmentId);
      try {
        await fetchLabel(shipmentId);
      } catch (err) {
        toast.error(err instanceof Error ? err.message : t('label.downloadError'));
      } finally {
        setLabelLoadingId(null);
      }
    },
    [fetchLabel, t],
  );

  const handleCloseSheet = useCallback(
    (open: boolean) => {
      if (!open) setSelectedShipmentId(null);
    },
    [setSelectedShipmentId],
  );

  return (
    <div className="space-y-4">
      <PendingReturnBanner pendingReturn={pendingReturn} />

      <div className="flex justify-end">
        <Button onClick={onCreateShipment}>
          <Truck className="me-1.5 size-3.5" />
          {t('detail.createShipment')}
        </Button>
      </div>

      <AtelierTableShell
        chrome={
          <TableChrome
            totalCount={shipments.length}
            entityLabel={t('shipmentsEntityLabel', { count: shipments.length })}
            densityLabels={{
              comfortable: tAria('densityComfortable'),
              compact: tAria('densityCompact'),
            }}
          />
        }>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>{t('shipmentsTable.col.trackingNumber')}</TableHead>
              <TableHead>{t('shipmentsTable.col.carrier')}</TableHead>
              <TableHead>{t('shipmentsTable.col.status')}</TableHead>
              <TableHead>{t('shipmentsTable.col.created')}</TableHead>
              <TableHead className="text-end">{t('shipmentsTable.col.actions')}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {shipments.map(shipment => {
              const canLabel = shipment.carrier === 'InPost';
              const isCreated = shipment.currentStatus === 'CREATED';
              return (
                <TableRow key={shipment.id}>
                  <TableCell className="font-mono text-xs">
                    {shipment.trackingNumber ?? (
                      <span className="text-muted-foreground">&mdash;</span>
                    )}
                  </TableCell>
                  <TableCell className="text-sm">
                    {shipment.carrier}
                    {!!shipment.carrierCustom && (
                      <span className="ms-1 text-xs text-muted-foreground">
                        ({shipment.carrierCustom})
                      </span>
                    )}
                  </TableCell>
                  <TableCell>
                    <ShipmentStatusBadge status={shipment.currentStatus} />
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {format(new Date(shipment.createdAt), 'MMM d, yyyy')}
                  </TableCell>
                  <TableCell className="text-end">
                    <div className="inline-flex items-center gap-1">
                      <Button
                        variant="ghost"
                        size="icon-sm"
                        aria-label={t('shipmentsTable.action.view')}
                        onClick={() => setSelectedShipmentId(shipment.id)}>
                        <Eye className="size-3.5" />
                      </Button>
                      {canLabel && (
                        <Button
                          variant="ghost"
                          size="icon-sm"
                          aria-label={t('shipmentsTable.action.label')}
                          disabled={labelLoadingId === shipment.id}
                          onClick={() => void handleFetchLabel(shipment.id)}>
                          {labelLoadingId === shipment.id ? (
                            <Loader2 className="size-3.5 animate-spin" />
                          ) : (
                            <Download className="size-3.5" />
                          )}
                        </Button>
                      )}
                      {isCreated && (
                        <Button
                          variant="ghost"
                          size="icon-sm"
                          aria-label={t('shipment.deleteTitle')}
                          className="text-destructive hover:text-destructive"
                          onClick={() => setDeleteTarget(shipment.id)}>
                          <Trash2 className="size-3.5" />
                        </Button>
                      )}
                    </div>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </AtelierTableShell>

      <Sheet open={!!selectedShipmentId} onOpenChange={handleCloseSheet}>
        <SheetContent className="w-full overflow-y-auto sm:max-w-lg">
          <SheetHeader>
            <SheetTitle>{t('shipmentsTable.detail.title')}</SheetTitle>
            <SheetDescription>{t('shipmentsTable.detail.subtitle')}</SheetDescription>
          </SheetHeader>

          <div className="space-y-4 px-4 pb-4">
            {detailQuery.isLoading && (
              <div className="space-y-2">
                <Skeleton className="h-5 w-3/4" />
                <Skeleton className="h-5 w-1/2" />
                <Skeleton className="h-32 w-full" />
              </div>
            )}

            {detailQuery.isError && (
              <p className="text-sm text-destructive">{t('error.loadFailed')}</p>
            )}

            {!!detailQuery.data && (
              <>
                <dl className="grid grid-cols-3 gap-y-2 text-sm">
                  <dt className="text-muted-foreground">{t('shipmentsTable.detail.direction')}</dt>
                  <dd className="col-span-2">
                    {detailQuery.data.direction === 'OUTBOUND'
                      ? t('shipment.outbound')
                      : t('shipment.return')}
                  </dd>

                  <dt className="text-muted-foreground">{t('shipmentsTable.detail.carrier')}</dt>
                  <dd className="col-span-2">
                    {detailQuery.data.carrier}
                    {!!detailQuery.data.carrierCustom && ` (${detailQuery.data.carrierCustom})`}
                  </dd>

                  <dt className="text-muted-foreground">
                    {t('shipmentsTable.detail.trackingNumber')}
                  </dt>
                  <dd className="col-span-2 font-mono text-xs">
                    {detailQuery.data.trackingNumber ?? '—'}
                  </dd>

                  <dt className="text-muted-foreground">{t('shipmentsTable.detail.status')}</dt>
                  <dd className="col-span-2">
                    <ShipmentStatusBadge status={detailQuery.data.currentStatus} />
                  </dd>

                  <dt className="text-muted-foreground">
                    {t('shipmentsTable.detail.expectedDelivery')}
                  </dt>
                  <dd className="col-span-2">
                    {detailQuery.data.expectedDeliveryAt
                      ? format(new Date(detailQuery.data.expectedDeliveryAt), 'MMM d, yyyy')
                      : '—'}
                  </dd>

                  <dt className="text-muted-foreground">{t('shipmentsTable.detail.equipment')}</dt>
                  <dd className="col-span-2">{detailQuery.data.equipment?.name ?? '—'}</dd>
                </dl>

                <div className="border-t pt-4">
                  <h3 className="mb-3 text-sm font-medium">
                    {t('shipmentsTable.detail.timeline')}
                  </h3>
                  <ShipmentTimelineContainer
                    shipmentId={detailQuery.data.id}
                    currentStatus={detailQuery.data.currentStatus}
                    events={detailQuery.data.events}
                    direction={detailQuery.data.direction}
                  />
                </div>
              </>
            )}
          </div>
        </SheetContent>
      </Sheet>

      <AlertDialog open={!!deleteTarget} onOpenChange={open => !open && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <Trash2 className="size-4" />
              {t('shipment.deleteTitle')}
            </AlertDialogTitle>
            <AlertDialogDescription>{t('shipment.deleteDescription')}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t('form.cancel')}</AlertDialogCancel>
            <AlertDialogAction
              variant="destructive"
              onClick={() =>
                deleteTarget &&
                deleteMutation.mutate(
                  { id: deleteTarget },
                  { onSuccess: () => setDeleteTarget(null) },
                )
              }
              disabled={deleteMutation.isPending}>
              {t('shipment.deleteTitle')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
