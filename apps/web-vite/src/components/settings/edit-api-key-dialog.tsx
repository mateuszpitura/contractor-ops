import { Button } from '@contractor-ops/ui/components/shadcn/button';
import {
  Dialog,
  DialogBody,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@contractor-ops/ui/components/shadcn/dialog';
import { Input } from '@contractor-ops/ui/components/shadcn/input';
import { Label } from '@contractor-ops/ui/components/shadcn/label';
import { Loader2, Pencil } from 'lucide-react';
import type * as React from 'react';
import { useCallback } from 'react';

import { ScopeCheckboxRow } from './create-api-key-dialog.js';
import {
  AVAILABLE_SCOPES,
  useEditKeyDialog,
  type useEditKeyDialog as UseEditKeyDialog,
} from './hooks/use-api-keys-tab.js';

interface EditKeyDialogShellProps {
  keyId: string;
  initialName: string;
  initialScopes: readonly string[];
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export type EditKeyDialogViewProps = EditKeyDialogShellProps & ReturnType<typeof UseEditKeyDialog>;

export function EditKeyDialogView({
  open,
  t,
  tCommon,
  id,
  name,
  setName,
  scopes,
  canSubmit,
  updateMutation,
  handleSubmit,
  handleClose,
  toggleScope,
}: EditKeyDialogViewProps) {
  const handleNameChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => setName(e.target.value),
    [setName],
  );

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Pencil className="size-4" />
            {t('editDialog.title')}
          </DialogTitle>
          <DialogDescription>{t('editDialog.description')}</DialogDescription>
        </DialogHeader>

        <DialogBody className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor={`${id}-edit-name`}>{t('createDialog.nameLabel')}</Label>
            <Input
              id={`${id}-edit-name`}
              placeholder={t('createDialog.namePlaceholder')}
              value={name}
              onChange={handleNameChange}
              autoFocus
            />
          </div>

          <div className="space-y-2">
            <Label>{t('createDialog.scopesLabel')}</Label>
            <div className="space-y-2 rounded-lg border p-3">
              {AVAILABLE_SCOPES.map(scope => (
                <ScopeCheckboxRow
                  key={scope.value}
                  id={`${id}-edit-scope-${scope.value}`}
                  scopeValue={scope.value}
                  label={t(scope.labelKey)}
                  isChecked={scopes.includes(scope.value)}
                  onToggle={toggleScope}
                />
              ))}
            </div>
          </div>
        </DialogBody>

        <DialogFooter>
          <DialogClose render={<Button variant="outline" />}>{tCommon('cancel')}</DialogClose>
          <Button onClick={handleSubmit} disabled={!canSubmit}>
            {!!updateMutation.isPending && <Loader2 className="me-2 size-4 animate-spin" />}
            {t('editDialog.submitButton')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export function EditKeyDialog({
  keyId,
  initialName,
  initialScopes,
  open,
  onOpenChange,
}: EditKeyDialogShellProps) {
  const dialog = useEditKeyDialog({ keyId, initialName, initialScopes, onOpenChange });
  return (
    <EditKeyDialogView
      keyId={keyId}
      initialName={initialName}
      initialScopes={initialScopes}
      open={open}
      onOpenChange={onOpenChange}
      {...dialog}
    />
  );
}
