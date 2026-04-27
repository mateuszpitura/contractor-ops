'use client';

// apps/web/src/components/admin/boe-rate/add-boe-rate-dialog.tsx
//
// Phase 63 · Plan 05 · D-10 — Dialog for adding a new BoE base rate entry.

import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
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

interface AddBoeRateDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function AddBoeRateDialog({ open, onOpenChange }: AddBoeRateDialogProps) {
  const [effectiveFrom, setEffectiveFrom] = useState('');
  const [ratePercent, setRatePercent] = useState('');
  const [notes, setNotes] = useState('');

  const queryClient = useQueryClient();

  const insertMutation = useMutation(
    trpc.adminBoeRate.insert.mutationOptions({
      onSuccess: () => {
        void queryClient.invalidateQueries({
          queryKey: trpc.adminBoeRate.list.queryKey(),
        });
        toast.success('Rate added', {
          description: 'BoE base rate entry has been saved.',
        });
        resetForm();
        onOpenChange(false);
      },
      onError: error => {
        toast.error('Error', { description: error.message });
      },
    }),
  );

  function resetForm() {
    setEffectiveFrom('');
    setRatePercent('');
    setNotes('');
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();

    const rate = parseFloat(ratePercent);
    if (Number.isNaN(rate) || rate < 0 || rate > 99.99) {
      toast.error('Validation error', {
        description: 'Rate must be between 0 and 99.99.',
      });
      return;
    }

    if (!effectiveFrom) {
      toast.error('Validation error', {
        description: 'Effective date is required.',
      });
      return;
    }

    insertMutation.mutate({
      effectiveFrom: new Date(effectiveFrom),
      ratePercent: rate,
      notes: notes || undefined,
    });
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Add BoE base rate</DialogTitle>
          <DialogDescription>
            Add a new Bank of England base rate entry for interest calculations.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="add-effective-from">Effective from</Label>
            <Input
              id="add-effective-from"
              type="date"
              value={effectiveFrom}
              onChange={e => setEffectiveFrom(e.target.value)}
              required
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="add-rate-percent">Rate %</Label>
            <Input
              id="add-rate-percent"
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
            <Label htmlFor="add-notes">Notes (optional)</Label>
            <Textarea
              id="add-notes"
              value={notes}
              onChange={e => setNotes(e.target.value)}
              placeholder="e.g., MPC decision 2026-03-20"
              rows={3}
            />
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={insertMutation.isPending}>
              {insertMutation.isPending ? 'Saving...' : 'Save rate'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
