'use client';

// apps/web/src/components/admin/boe-rate/poller-status-strip.tsx
//
// Phase 63 · Plan 05 — Poller status strip.
// Shows the last BOE_API-sourced row's createdAt + whether rate changed.
// Informational only — no action buttons.

import { useQuery } from '@tanstack/react-query';
import { CheckCircle2Icon, XCircleIcon } from 'lucide-react';
import { trpc } from '@/trpc/init';

export function PollerStatusStrip() {
  const { data: entries } = useQuery(trpc.adminBoeRate.list.queryOptions());

  if (!entries) {
    return null;
  }

  // Find the most recent BOE_API-sourced entry
  const apiEntries = entries.filter(e => e.source === 'BOE_API');

  if (apiEntries.length === 0) {
    return (
      <div className="flex items-center gap-2 rounded-md bg-muted/50 px-4 py-2 text-sm text-muted-foreground">
        <XCircleIcon className="h-4 w-4 shrink-0" aria-hidden="true" />
        <span>No BoE API poll data available. Rates are manual-entry only.</span>
      </div>
    );
  }

  const latestApiEntry = apiEntries[0]; // Already sorted DESC by effectiveFrom
  const pollDate = new Date(latestApiEntry.createdAt).toISOString().slice(0, 10);
  const rate = Number(latestApiEntry.ratePercent).toFixed(2);

  // Check if there are multiple entries — if latest two BOE_API entries have same rate, "unchanged"
  const previousApiEntry = apiEntries.length > 1 ? apiEntries[1] : null;
  const rateChanged = previousApiEntry
    ? Number(latestApiEntry.ratePercent) !== Number(previousApiEntry.ratePercent)
    : true; // First entry = new rate recorded

  return (
    <div
      className="flex items-center gap-2 rounded-md bg-muted/50 px-4 py-2 text-sm text-muted-foreground"
      role="status"
      aria-label="BoE API poll status">
      <CheckCircle2Icon className="h-4 w-4 shrink-0 text-success" aria-hidden="true" />
      <span>
        Last BoE API poll: {pollDate}
        {rateChanged ? ` — new rate ${rate}% recorded` : ' — rate unchanged'}
      </span>
    </div>
  );
}
