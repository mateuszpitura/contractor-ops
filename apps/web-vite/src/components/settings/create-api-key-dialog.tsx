import { Button } from '@contractor-ops/ui/components/shadcn/button';
import { Checkbox } from '@contractor-ops/ui/components/shadcn/checkbox';
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
import { Check, ClipboardCopy, Key, Loader2, Plus, ShieldAlert } from 'lucide-react';
import type * as React from 'react';
import { useCallback } from 'react';

import {
  AVAILABLE_SCOPES,
  useCreateKeyDialog,
  type useCreateKeyDialog as UseCreateKeyDialog,
} from './hooks/use-api-keys-tab.js';

interface ScopeCheckboxRowProps<T extends string> {
  id: string;
  scopeValue: T;
  label: string;
  isChecked: boolean;
  onToggle: (value: T) => void;
}

export function ScopeCheckboxRow<T extends string>({
  id,
  scopeValue,
  label,
  isChecked,
  onToggle,
}: ScopeCheckboxRowProps<T>) {
  const handleChange = useCallback(() => onToggle(scopeValue), [onToggle, scopeValue]);
  return (
    <label htmlFor={id} className="flex cursor-pointer items-center gap-2.5 text-sm">
      <Checkbox id={id} checked={isChecked} onCheckedChange={handleChange} />
      <span>{label}</span>
    </label>
  );
}

interface CreateKeyDialogShellProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export type CreateKeyDialogViewProps = CreateKeyDialogShellProps &
  ReturnType<typeof UseCreateKeyDialog>;

export function CreateKeyDialogView({
  open,
  t,
  tCommon,
  id,
  name,
  setName,
  scopes,
  expiresAt,
  setExpiresAt,
  createdKey,
  copied,
  createMutation,
  handleCreate,
  handleCopy,
  handleClose,
  toggleScope,
}: CreateKeyDialogViewProps) {
  const handleNameChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => setName(e.target.value),
    [setName],
  );
  const handleExpiresAtChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => setExpiresAt(e.target.value),
    [setExpiresAt],
  );

  if (createdKey) {
    return (
      <Dialog open={open} onOpenChange={handleClose}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Key className="size-4" />
              {t('createdDialog.title')}
            </DialogTitle>
            <DialogDescription>{t('createdDialog.description')}</DialogDescription>
          </DialogHeader>

          <DialogBody className="space-y-3">
            <div className="flex items-center gap-2 rounded-lg border bg-muted/50 p-3">
              <code className="flex-1 break-all text-xs font-mono">{createdKey}</code>
              <Button
                variant="ghost"
                size="icon-sm"
                onClick={handleCopy}
                aria-label={t('aria.copyKey')}>
                {copied ? (
                  <Check className="size-4 text-green-600" />
                ) : (
                  <ClipboardCopy className="size-4" />
                )}
              </Button>
            </div>

            <div className="flex items-start gap-2 rounded-lg border border-amber-500/30 bg-amber-500/5 p-3 text-xs text-amber-700 dark:text-amber-400">
              <ShieldAlert className="mt-0.5 size-4 shrink-0" />
              <span>{t('createdDialog.securityWarning')}</span>
            </div>
          </DialogBody>

          <DialogFooter>
            <DialogClose render={<Button />}>{t('createdDialog.doneButton')}</DialogClose>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    );
  }

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Plus className="size-4" />
            {t('createDialog.title')}
          </DialogTitle>
          <DialogDescription>{t('createDialog.description')}</DialogDescription>
        </DialogHeader>

        <DialogBody className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor={`${id}-key-name`}>{t('createDialog.nameLabel')}</Label>
            <Input
              id={`${id}-key-name`}
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
                  id={`${id}-scope-${scope.value}`}
                  scopeValue={scope.value}
                  label={t(scope.labelKey)}
                  isChecked={scopes.includes(scope.value)}
                  onToggle={toggleScope}
                />
              ))}
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor={`${id}-key-expiry`}>{t('createDialog.expiryLabel')}</Label>
            <Input
              id={`${id}-key-expiry`}
              type="date"
              value={expiresAt}
              onChange={handleExpiresAtChange}
              min={new Date().toISOString().split('T')[0]}
            />
          </div>
        </DialogBody>

        <DialogFooter>
          <DialogClose render={<Button variant="outline" />}>{tCommon('cancel')}</DialogClose>
          <Button
            onClick={handleCreate}
            disabled={!name.trim() || scopes.length === 0 || createMutation.isPending}>
            {!!createMutation.isPending && <Loader2 className="me-2 size-4 animate-spin" />}
            {t('createDialog.submitButton')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export function CreateKeyDialog({ open, onOpenChange }: CreateKeyDialogShellProps) {
  const dialog = useCreateKeyDialog({ open, onOpenChange });
  return <CreateKeyDialogView open={open} onOpenChange={onOpenChange} {...dialog} />;
}
