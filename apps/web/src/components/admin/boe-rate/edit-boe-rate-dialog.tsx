'use client';

// apps/web/src/components/admin/boe-rate/edit-boe-rate-dialog.tsx
//
// Phase 63 · Plan 05 · D-10 — Dialog for editing an existing BoE base rate entry.
// Warning tooltip shown for cron-sourced (BOE_API) entries.

import { useQueryClient } from '@tanstack/react-query';
import { AlertTriangleIcon } from 'lucide-react';
import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { trpc } from '@/trpc/init';

interface EditBoeRateDialogProps {
  entry: {
    id: string;
    effectiveFrom: string | Date;
    ratePercent: string | number;
    source: 'BOE_API' | 'MANUAL';
    notes: string | null;
  };
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function EditBoeRateDialog({ entry, open, onOpenChange }: EditBoeRateDialogProps) {
  const [ratePercent, setRatePercent] = useState('');
  const [notes, setNotes] = useState('');

  const queryClient = useQueryClient();

  useEffect(() => {
    setRatePercent(Number(entry.ratePercent).toFixed(2));
    setNotes(entry.notes ?? '');
  }, [entry]);

  const updateMutation = trpc.adminBoeRate.update.useMutation({
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [['adminBoeRate', 'list']] });
      toast.success('Rate updated', {
        description: 'BoE base rate entry has been updated.',
      });
      onOpenChange(false);
    },
    onError: error => {
      toast.error('Error', { description: error.message });
    },
  });

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();

    const rate = parseFloat(ratePercent);
    if (isNaN(rate) || rate < 0 || rate > 99.99) {
      toast.error('Validation error', {
        description: 'Rate must be between 0 and 99.99.',
      });
      return;
    }

    updateMutation.mutate({
      id: entry.id,
      ratePercent: rate,
      notes: notes || undefined,
    });
  }

  const effectiveDate = new Date(entry.effectiveFrom).toISOString().slice(0, 10);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Edit BoE base rate</DialogTitle>
          <DialogDescription>Update the rate entry for {effectiveDate}.</DialogDescription>
        </DialogHeader>

        {entry.source === 'BOE_API' && (
          <div className="flex items-start gap-2 rounded-md bg-warning/10 p-3 text-sm text-warning">
            <AlertTriangleIcon className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
            <span>
              This entry was sourced from the BoE API. Editing it will override the original value.
              The next poll will not overwrite your change.
            </span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label>Effective from</Label>
            <Input type="date" value={effectiveDate} disabled className="bg-muted" />
          </div>
          <div className="space-y-2">
            <Label htmlFor="edit-rate-percent">Rate %</Label>
            <Input
              id="edit-rate-percent"
              type="number"
              step="0.01"
              min="0"
              max="99.99"
              value={ratePercent}
              onChange={e => setRatePercent(e.target.value)}
              className="tabular-nums"
              required
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="edit-notes">Notes</Label>
            <Textarea
              id="edit-notes"
              value={notes}
              onChange={e => setNotes(e.target.value)}
              placeholder="e.g., Corrected from cron-sourced value"
              rows={3}
            />
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={updateMutation.isPending}>
              {updateMutation.isPending ? 'Saving...' : 'Save changes'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
