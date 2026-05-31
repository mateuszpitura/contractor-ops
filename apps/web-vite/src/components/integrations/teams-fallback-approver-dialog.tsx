import { Button } from '@contractor-ops/ui/components/shadcn/button';
import {
  Dialog,
  DialogBody,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@contractor-ops/ui/components/shadcn/dialog';
import { Label } from '@contractor-ops/ui/components/shadcn/label';

import { RuleUserPickerContainer } from '../settings/rule-user-picker-container.js';
import type { useTeamsFallbackApproverDialog } from './hooks/use-teams-fallback-approver-dialog.js';

export type TeamsFallbackApproverDialogViewProps = ReturnType<
  typeof useTeamsFallbackApproverDialog
>;

export function TeamsFallbackApproverDialogView({
  open,
  onOpenChange,
  selectedUserId,
  setSelectedUserId,
  currentFallbackApproverId,
  setFallbackMutation,
  handleSave,
  handleClear,
  t,
}: TeamsFallbackApproverDialogViewProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{t('title')}</DialogTitle>
          <DialogDescription>{t('description')}</DialogDescription>
        </DialogHeader>

        <DialogBody className="space-y-3 py-2">
          <Label htmlFor="teams-fallback-approver-picker">{t('approverLabel')}</Label>
          <RuleUserPickerContainer value={selectedUserId} onChange={setSelectedUserId} />
        </DialogBody>

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
