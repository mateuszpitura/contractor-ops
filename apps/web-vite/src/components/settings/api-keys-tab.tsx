import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogMedia,
  AlertDialogTitle,
} from '@contractor-ops/ui/components/shadcn/alert-dialog';
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
import {
  Check,
  ClipboardCopy,
  Key,
  Loader2,
  Pencil,
  Plus,
  ShieldAlert,
  Trash2,
} from 'lucide-react';
import type * as React from 'react';
import { useCallback, useState } from 'react';
import { FeatureGateContainer } from '../billing/feature-gate-container';
import type { EditTarget, RevokeTarget } from './api-keys/data-table.js';
import { ApiKeysDataTable } from './api-keys/data-table.js';
import { CreateKeyDialogContainer } from './create-api-key-dialog-container.js';
import { EditKeyDialogContainer } from './edit-api-key-dialog-container.js';
import type {
  useApiKeysTab,
  useCreateKeyDialog,
  useEditKeyDialog,
  useRevokeKeyDialog,
} from './hooks/use-api-keys-tab.js';
import { AVAILABLE_SCOPES } from './hooks/use-api-keys-tab.js';
import { RevokeKeyDialogContainer } from './revoke-api-key-dialog-container.js';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

interface ScopeCheckboxRowProps<T extends string> {
  id: string;
  scopeValue: T;
  label: string;
  isChecked: boolean;
  onToggle: (value: T) => void;
}

function ScopeCheckboxRow<T extends string>({
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

// ---------------------------------------------------------------------------
// Create API Key Dialog
// ---------------------------------------------------------------------------

interface CreateKeyDialogShellProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export type CreateKeyDialogProps = CreateKeyDialogShellProps &
  ReturnType<typeof useCreateKeyDialog>;

export function CreateKeyDialog({
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
}: CreateKeyDialogProps) {
  const handleNameChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => setName(e.target.value),
    [setName],
  );
  const handleExpiresAtChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => setExpiresAt(e.target.value),
    [setExpiresAt],
  );

  // After creation — show plaintext key
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

  // Creation form
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
            {!!createMutation.isPending && <Loader2 className="mr-2 size-4 animate-spin" />}
            {t('createDialog.submitButton')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ---------------------------------------------------------------------------
// Revoke Confirmation Dialog
// ---------------------------------------------------------------------------

interface RevokeKeyDialogShellProps {
  keyId: string;
  keyName: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export type RevokeKeyDialogProps = RevokeKeyDialogShellProps &
  ReturnType<typeof useRevokeKeyDialog>;

export function RevokeKeyDialog({
  keyName,
  open,
  onOpenChange,
  t,
  tCommon,
  isPending,
  handleRevoke,
}: RevokeKeyDialogProps) {
  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogMedia className="bg-destructive/10">
            <Trash2 className="size-5 text-destructive" />
          </AlertDialogMedia>
          <AlertDialogTitle>{t('revokeDialog.title')}</AlertDialogTitle>
          <AlertDialogDescription>
            {t('revokeDialog.description', { name: keyName })}
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>{tCommon('cancel')}</AlertDialogCancel>
          <AlertDialogAction variant="destructive" onClick={handleRevoke} disabled={isPending}>
            {!!isPending && <Loader2 className="mr-2 size-4 animate-spin" />}
            {t('revokeDialog.confirmButton')}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

// ---------------------------------------------------------------------------
// Edit API Key Dialog (rename + scope edit)
// ---------------------------------------------------------------------------

interface EditKeyDialogShellProps {
  keyId: string;
  initialName: string;
  initialScopes: readonly string[];
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export type EditKeyDialogProps = EditKeyDialogShellProps & ReturnType<typeof useEditKeyDialog>;

export function EditKeyDialog({
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
}: EditKeyDialogProps) {
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
            {!!updateMutation.isPending && <Loader2 className="mr-2 size-4 animate-spin" />}
            {t('editDialog.submitButton')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

export type ApiKeysTabProps = ReturnType<typeof useApiKeysTab>;

export function ApiKeysTab({ t, keys, isLoading }: ApiKeysTabProps) {
  const [createOpen, setCreateOpen] = useState(false);
  const [revokeTarget, setRevokeTarget] = useState<RevokeTarget | null>(null);
  const [editTarget, setEditTarget] = useState<EditTarget | null>(null);

  const openCreate = useCallback(() => setCreateOpen(true), []);
  const handleEditOpenChange = useCallback((open: boolean) => {
    if (!open) setEditTarget(null);
  }, []);
  const handleRevokeOpenChange = useCallback((open: boolean) => {
    if (!open) setRevokeTarget(null);
  }, []);

  return (
    <FeatureGateContainer requiredTier="Enterprise" featureName="API Keys">
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-sm font-semibold">{t('title')}</h3>
            <p className="text-xs text-muted-foreground">{t('description')}</p>
          </div>
          <Button size="sm" onClick={openCreate}>
            <Plus className="mr-1.5 size-4" />
            {t('createKeyButton')}
          </Button>
        </div>

        <ApiKeysDataTable
          t={t}
          keys={keys ?? []}
          isLoading={isLoading}
          onCreate={openCreate}
          onEdit={setEditTarget}
          onRevoke={setRevokeTarget}
        />

        <CreateKeyDialogContainer open={createOpen} onOpenChange={setCreateOpen} />

        {editTarget != null && (
          <EditKeyDialogContainer
            keyId={editTarget.id}
            initialName={editTarget.name}
            initialScopes={editTarget.scopes}
            open={!!editTarget}
            onOpenChange={handleEditOpenChange}
          />
        )}

        {revokeTarget != null && (
          <RevokeKeyDialogContainer
            keyId={revokeTarget.id}
            keyName={revokeTarget.name}
            open={!!revokeTarget}
            onOpenChange={handleRevokeOpenChange}
          />
        )}
      </div>
    </FeatureGateContainer>
  );
}
