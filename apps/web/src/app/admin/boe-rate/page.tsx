'use client';

// apps/web/src/app/admin/boe-rate/page.tsx
//
// Phase 63 · Plan 05 · D-10 — Super-admin BoE base rate history page.
// Renders poller status, add rate button, and rate table.

import { PlusIcon } from 'lucide-react';
import { useState } from 'react';
import { AddBoeRateDialog } from '@/components/admin/boe-rate/add-boe-rate-dialog';
import { BoeRateTable } from '@/components/admin/boe-rate/boe-rate-table';
import { PollerStatusStrip } from '@/components/admin/boe-rate/poller-status-strip';
import { Button } from '@/components/ui/button';

export default function BoeRatePage() {
  const [addDialogOpen, setAddDialogOpen] = useState(false);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold font-display text-foreground">
          Bank of England base-rate history
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Reference data powering UK statutory late-payment interest calculations
        </p>
      </div>

      <PollerStatusStrip />

      <div className="flex items-center justify-end">
        <Button onClick={() => setAddDialogOpen(true)}>
          <PlusIcon className="mr-2 h-4 w-4" aria-hidden="true" />
          Add rate
        </Button>
      </div>

      <BoeRateTable />

      <AddBoeRateDialog open={addDialogOpen} onOpenChange={setAddDialogOpen} />
    </div>
  );
}
