'use client';

import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useTranslations } from 'next-intl';
import { useCallback, useState } from 'react';
import { toast } from 'sonner';
import { RuleUserPicker } from '@/components/settings/rule-user-picker';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { trpc } from '@/trpc/init';

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

interface TeamsFallbackApproverDialogProps {
  /** Organizational `Team` id whose fallback approver should be updated. */
  teamId: string;
  /** Current fallback approver user id (or null to clear). */
  currentFallbackApproverId?: string | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

// ---------------------------------------------------------------------------
// TeamsFallbackApproverDialog
// ---------------------------------------------------------------------------

/**
 * Modal for setting the fallback approver on an organisational `Team` —
 * used by the Phase 74 offboarding workflow's PTO-aware fallback chain.
 *
 * Wires `teams.setFallbackApprover`. Note: despite the namespace, this
 * mutation acts on the per-org `Team` model (organisational unit), NOT the
 * Microsoft Teams workspace — see the BE comment in teams.ts.
 */
export function TeamsFallbackApproverDialog({
  teamId,
  currentFallbackApproverId,
  open,
  onOpenChange,
}: TeamsFallbackApproverDialogProps) {
  const t = useTranslations('Settings.integrations.teams.fallbackApprover');
  const queryClient = useQueryClient();
  const [selectedUserId, setSelectedUserId] = useState<string | undefined>(
    currentFallbackApproverId ?? undefined,
  );

  const setFallbackMutation = useMutation(
    trpc.teams.setFallbackApprover.mutationOptions({
      onSuccess: () => {
        toast.success(t('toast.saved'));
        // Invalidate team-related caches so the picker reads fresh state.
        queryClient.invalidateQueries(trpc.teams.pathFilter());
        onOpenChange(false);
      },
      onError: err => {
        toast.error(err.message);
      },
    }),
  );

  const handleSave = useCallback(() => {
    if (!selectedUserId) return;
    setFallbackMutation.mutate({ teamId, fallbackApproverId: selectedUserId });
  }, [selectedUserId, setFallbackMutation, teamId]);

  const handleClear = useCallback(() => {
    setFallbackMutation.mutate({ teamId, fallbackApproverId: null });
  }, [setFallbackMutation, teamId]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{t('title')}</DialogTitle>
          <DialogDescription>{t('description')}</DialogDescription>
        </DialogHeader>

        <div className="space-y-3 py-2">
          <Label htmlFor="teams-fallback-approver-picker">{t('approverLabel')}</Label>
          <RuleUserPicker value={selectedUserId} onChange={setSelectedUserId} />
        </div>

        <DialogFooter className="gap-2 sm:gap-2">
          <Button
            type="button"
            variant="ghost"
            onClick={handleClear}
            disabled={setFallbackMutation.isPending || !currentFallbackApproverId}>
            {t('clear')}
          </Button>
          <Button
            type="button"
            onClick={handleSave}
            disabled={!selectedUserId || setFallbackMutation.isPending}>
            {setFallbackMutation.isPending ? t('saving') : t('save')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
