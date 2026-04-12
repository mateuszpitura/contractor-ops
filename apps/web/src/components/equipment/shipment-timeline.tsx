'use client';

import { useMutation, useQueryClient } from '@tanstack/react-query';
import { format } from 'date-fns';
import { Loader2 } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useState } from 'react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { cn } from '@/lib/utils';
import { trpc } from '@/trpc/init';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type ShipmentEvent = {
  id: string;
  status: string;
  notes: string | null;
  occurredAt: string;
  createdByUserId: string | null;
};

/**
 * Ordered list of all shipment statuses for timeline display.
 */
const SHIPMENT_STATUS_ORDER = [
  'CREATED',
  'LABEL_GENERATED',
  'PICKED_UP',
  'IN_TRANSIT',
  'OUT_FOR_DELIVERY',
  'DELIVERED',
] as const;

const UPDATABLE_STATUSES = [
  'LABEL_GENERATED',
  'PICKED_UP',
  'IN_TRANSIT',
  'OUT_FOR_DELIVERY',
  'DELIVERED',
  'FAILED',
  'RETURNED',
] as const;

interface ShipmentTimelineProps {
  shipmentId: string;
  currentStatus: string;
  events: ShipmentEvent[];
  direction: string;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

/**
 * Vertical chronological timeline of shipment status events.
 * Shows completed, current, and pending future statuses.
 */
export function ShipmentTimeline({
  shipmentId,
  currentStatus,
  events,
  direction: _direction,
}: ShipmentTimelineProps) {
  const t = useTranslations('Equipment');
  const queryClient = useQueryClient();
  const [newStatus, setNewStatus] = useState<string>('');
  const [newNotes, setNewNotes] = useState('');

  const addEventMutation = useMutation(
    trpc.equipment.addShipmentEvent.mutationOptions({
      onSuccess: () => {
        toast.success(t('toast.statusUpdated'));
        queryClient.invalidateQueries({
          queryKey: trpc.equipment.getById.queryKey(),
        });
        setNewStatus('');
        setNewNotes('');
      },
      onError: () => {
        toast.error(t('error.actionFailed'));
      },
    }),
  );

  const handleAddEvent = () => {
    if (!newStatus) return;
    addEventMutation.mutate({
      shipmentId,
      status: newStatus as (typeof UPDATABLE_STATUSES)[number],
      notes: newNotes || undefined,
    });
  };

  // Build the event map for quick lookup
  const eventByStatus = new Map<string, ShipmentEvent>();
  for (const event of events) {
    eventByStatus.set(event.status, event);
  }

  // Determine which statuses are completed, current, or pending
  const currentIndex = SHIPMENT_STATUS_ORDER.indexOf(
    currentStatus as (typeof SHIPMENT_STATUS_ORDER)[number],
  );

  // Terminal statuses
  const isTerminal =
    currentStatus === 'DELIVERED' || currentStatus === 'FAILED' || currentStatus === 'RETURNED';

  return (
    <div className="space-y-4">
      {/* Add status update form */}
      {!isTerminal && (
        <div className="flex items-end gap-2 rounded-lg border bg-card p-3">
          <div className="flex-1 space-y-1">
            <label className="text-xs font-medium text-muted-foreground">
              {t('shipment.addStatusUpdate')}
            </label>
            <Select value={newStatus} onValueChange={val => val && setNewStatus(val)}>
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Select status..." />
              </SelectTrigger>
              <SelectContent>
                {UPDATABLE_STATUSES.map(status => (
                  <SelectItem key={status} value={status}>
                    {t(`shipment.status.${status}`)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="flex-1 space-y-1">
            <label className="text-xs font-medium text-muted-foreground">
              {t('shipment.notes')}
            </label>
            <Input
              value={newNotes}
              onChange={e => setNewNotes(e.target.value)}
              placeholder="Optional notes..."
            />
          </div>
          <Button
            size="sm"
            onClick={handleAddEvent}
            disabled={!newStatus || addEventMutation.isPending}>
            {addEventMutation.isPending && <Loader2 className="me-1 h-3 w-3 animate-spin" />}
            Add
          </Button>
        </div>
      )}

      {/* Timeline */}
      <div role="list" className="relative space-y-0 ps-4">
        {SHIPMENT_STATUS_ORDER.map((status, index) => {
          const event = eventByStatus.get(status);
          const isCompleted = index < currentIndex;
          const isCurrent = status === currentStatus;
          const isPending = index > currentIndex && !isTerminal;

          // Skip pending statuses after terminal
          if (isTerminal && !event) return null;

          return (
            <div key={status} role="listitem" className="relative pb-6 last:pb-0">
              {/* Connector line */}
              {index < SHIPMENT_STATUS_ORDER.length - 1 && (
                <div
                  className={cn(
                    'absolute start-[5px] top-[18px] h-full w-0.5',
                    isCompleted || isCurrent
                      ? 'bg-border'
                      : 'border-s-2 border-dashed border-border/40',
                  )}
                />
              )}

              {/* Event node */}
              <div className="flex items-start gap-3">
                {/* Circle indicator */}
                <div
                  className={cn(
                    'relative z-10 mt-0.5 h-3 w-3 shrink-0 rounded-full border-2',
                    isCurrent
                      ? 'border-primary bg-primary/20'
                      : isCompleted
                        ? 'border-muted-foreground bg-muted-foreground'
                        : 'border-border/40 bg-background',
                  )}
                />

                {/* Content */}
                <div
                  className={cn(
                    'flex flex-1 items-start justify-between gap-2',
                    isCurrent && 'rounded-md bg-primary/5 px-2 py-1 -mx-2',
                    isPending && 'opacity-40',
                  )}>
                  <div>
                    <span
                      className={cn(
                        'text-sm font-medium',
                        isCurrent && 'text-primary',
                        isPending && 'text-muted-foreground',
                      )}>
                      {t(`shipment.status.${status}`)}
                    </span>
                    {event?.notes && (
                      <p className="mt-0.5 text-xs text-muted-foreground">{event.notes}</p>
                    )}
                  </div>

                  {event && (
                    <span className="shrink-0 text-xs text-muted-foreground">
                      {format(new Date(event.occurredAt), 'MMM d, HH:mm')}
                    </span>
                  )}

                  {isPending && !event && (
                    <span className="shrink-0 text-xs text-muted-foreground/40">(pending)</span>
                  )}
                </div>
              </div>
            </div>
          );
        })}

        {/* Show FAILED or RETURNED as special terminal events if applicable */}
        {(() => {
          const terminalEvent =
            currentStatus === 'FAILED' || currentStatus === 'RETURNED'
              ? eventByStatus.get(currentStatus)
              : undefined;
          if (!terminalEvent) return null;
          return (
            <div role="listitem" className="relative pb-0">
              <div className="flex items-start gap-3">
                <div className="relative z-10 mt-0.5 h-3 w-3 shrink-0 rounded-full border-2 border-primary bg-primary/20" />
                <div className="flex flex-1 items-start justify-between gap-2 rounded-md bg-primary/5 px-2 py-1 -mx-2">
                  <div>
                    <span className="text-sm font-medium text-primary">
                      {t(`shipment.status.${currentStatus}`)}
                    </span>
                    {terminalEvent.notes && (
                      <p className="mt-0.5 text-xs text-muted-foreground">{terminalEvent.notes}</p>
                    )}
                  </div>
                  <span className="shrink-0 text-xs text-muted-foreground">
                    {format(new Date(terminalEvent.occurredAt), 'MMM d, HH:mm')}
                  </span>
                </div>
              </div>
            </div>
          );
        })()}
      </div>
    </div>
  );
}
