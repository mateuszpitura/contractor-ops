// ---------------------------------------------------------------------------
// Phase 57 · Plan 04 · Task 2 — Manual VAT revalidation button
// ---------------------------------------------------------------------------
//
// Fires `contractor.revalidateVat` — identical orchestration to `validateVat`
// but the audit-log entry carries `intent: 'manual-revalidate'` so support /
// finance can tell a user-triggered check apart from an automatic profile-save
// or invoice-line-staleness dispatch (D-07).
// ---------------------------------------------------------------------------

'use client';

import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Loader2, RefreshCw } from 'lucide-react';
import { useCallback } from 'react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { trpc } from '@/trpc/init';

interface RevalidateVatButtonProps {
  contractorId: string;
}

export function RevalidateVatButton({ contractorId }: RevalidateVatButtonProps) {
  const queryClient = useQueryClient();
  const mutation = useMutation(
    trpc.contractor.revalidateVat.mutationOptions({
      onSuccess: (result: { responseStatus: 'valid' | 'invalid' | 'stale' | 'unavailable' }) => {
        if (result.responseStatus === 'valid') {
          toast.success('VAT validated successfully');
        } else if (result.responseStatus === 'invalid') {
          toast.error('VAT number is invalid');
        } else {
          toast.warning('Live VAT check unavailable — showing last known result');
        }
        void queryClient.invalidateQueries({
          queryKey: trpc.contractor.getById.queryKey({ id: contractorId }),
        });
      },
      onError: (err: { message?: string }) => {
        toast.error(err.message || 'Failed to revalidate VAT');
      },
    }),
  );

  const handleClick = useCallback(
    () => mutation.mutate({ contractorId }),
    [mutation, contractorId],
  );

  return (
    <Button
      variant="outline"
      size="sm"
      onClick={handleClick}
      disabled={mutation.isPending}
      aria-label="Revalidate VAT number">
      {mutation.isPending ? (
        <Loader2 className="size-3.5 animate-spin" aria-hidden />
      ) : (
        <RefreshCw className="size-3.5" aria-hidden />
      )}
      <span>Revalidate VAT</span>
    </Button>
  );
}
