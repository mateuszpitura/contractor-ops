'use client';

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
import { Badge } from '@contractor-ops/ui/components/shadcn/badge';
import { Button } from '@contractor-ops/ui/components/shadcn/button';
import { Checkbox } from '@contractor-ops/ui/components/shadcn/checkbox';
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@contractor-ops/ui/components/shadcn/dialog';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@contractor-ops/ui/components/shadcn/dropdown-menu';
import { Input } from '@contractor-ops/ui/components/shadcn/input';
import { Label } from '@contractor-ops/ui/components/shadcn/label';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@contractor-ops/ui/components/shadcn/table';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  Check,
  ClipboardCopy,
  Key,
  Loader2,
  MoreHorizontal,
  Pencil,
  Plus,
  ShieldAlert,
  Trash2,
} from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useId, useState } from 'react';
import { toast } from 'sonner';
import { FeatureGate } from '@/components/billing/feature-gate';
import { trpc } from '@/trpc/init';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const AVAILABLE_SCOPES = [
  { value: 'contractor:read', labelKey: 'scopeLabels.contractorRead' },
  { value: 'contract:read', labelKey: 'scopeLabels.contractRead' },
  { value: 'invoice:read', labelKey: 'scopeLabels.invoiceRead' },
  { value: 'document:read', labelKey: 'scopeLabels.documentRead' },
] as const;

type ScopeValue = (typeof AVAILABLE_SCOPES)[number]['value'];

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function formatDate(date: string | Date | null | undefined): string {
  if (!date) return '—';
  return new Intl.DateTimeFormat(undefined, {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(new Date(date));
}

function getKeyStatus(key: { revokedAt: string | Date | null; expiresAt: string | Date | null }) {
  if (key.revokedAt) return 'revoked' as const;
  if (key.expiresAt && new Date(key.expiresAt) < new Date()) return 'expired' as const;
  return 'active' as const;
}

function statusBadgeVariant(status: ReturnType<typeof getKeyStatus>) {
  switch (status) {
    case 'active':
      return 'success' as const;
    case 'revoked':
      return 'destructive' as const;
    case 'expired':
      return 'warning' as const;
  }
}

// ---------------------------------------------------------------------------
// Create API Key Dialog
// ---------------------------------------------------------------------------

function CreateKeyDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const t = useTranslations('Settings.apiKeys');
  const tCommon = useTranslations('Common');
  const id = useId();
  const queryClient = useQueryClient();
  const [name, setName] = useState('');
  const [scopes, setScopes] = useState<ScopeValue[]>([]);
  const [expiresAt, setExpiresAt] = useState('');
  const [createdKey, setCreatedKey] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const createMutation = useMutation(
    trpc.apiKey.create.mutationOptions({
      onSuccess: data => {
        setCreatedKey(data.plaintext);
        void queryClient.invalidateQueries({ queryKey: trpc.apiKey.list.queryKey() });
        toast.success(t('toast.created'));
      },
      onError: err => {
        toast.error(err.message ?? t('toast.createFailed'));
      },
    }),
  );

  function handleCreate() {
    if (!name.trim() || scopes.length === 0) return;
    createMutation.mutate({
      name: name.trim(),
      scopes,
      ...(expiresAt ? { expiresAt: new Date(expiresAt) } : {}),
    });
  }

  function handleCopy() {
    if (!createdKey) return;
    void navigator.clipboard.writeText(createdKey);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  function handleClose(value: boolean) {
    if (!value) {
      setName('');
      setScopes([]);
      setExpiresAt('');
      setCreatedKey(null);
      setCopied(false);
      createMutation.reset();
    }
    onOpenChange(value);
  }

  function toggleScope(scope: ScopeValue) {
    setScopes(prev => (prev.includes(scope) ? prev.filter(s => s !== scope) : [...prev, scope]));
  }

  // After creation — show plaintext key
  if (createdKey) {
    return (
      // biome-ignore lint/nursery/noJsxPropsBind: dialog/popover state handler */}
      <Dialog open={open} onOpenChange={handleClose}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Key className="size-4" />
              {t('createdDialog.title')}
            </DialogTitle>
            <DialogDescription>{t('createdDialog.description')}</DialogDescription>
          </DialogHeader>

          <div className="space-y-3">
            <div className="flex items-center gap-2 rounded-lg border bg-muted/50 p-3">
              <code className="flex-1 break-all text-xs font-mono">{createdKey}</code>
              {/* biome-ignore lint/nursery/noJsxPropsBind: callback in JSX prop */}
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
          </div>

          <DialogFooter>
            <DialogClose render={<Button />}>{t('createdDialog.doneButton')}</DialogClose>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    );
  }

  // Creation form
  return (
    // biome-ignore lint/nursery/noJsxPropsBind: dialog/popover state handler */}
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Plus className="size-4" />
            {t('createDialog.title')}
          </DialogTitle>
          <DialogDescription>{t('createDialog.description')}</DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor={`${id}-key-name`}>{t('createDialog.nameLabel')}</Label>
            <Input
              id={`${id}-key-name`}
              placeholder={t('createDialog.namePlaceholder')}
              value={name}
              // biome-ignore lint/nursery/noJsxPropsBind: controlled input handler
              onChange={e => setName(e.target.value)}
              autoFocus
            />
          </div>

          <div className="space-y-2">
            <Label>{t('createDialog.scopesLabel')}</Label>
            <div className="space-y-2 rounded-lg border p-3">
              {AVAILABLE_SCOPES.map(scope => (
                <label
                  key={scope.value}
                  htmlFor={`${id}-scope-${scope.value}`}
                  className="flex cursor-pointer items-center gap-2.5 text-sm">
                  <Checkbox
                    id={`${id}-scope-${scope.value}`}
                    checked={scopes.includes(scope.value)}
                    // biome-ignore lint/nursery/noJsxPropsBind: controlled component handler
                    onCheckedChange={() => toggleScope(scope.value)}
                  />
                  <span>{t(scope.labelKey)}</span>
                </label>
              ))}
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor={`${id}-key-expiry`}>{t('createDialog.expiryLabel')}</Label>
            <Input
              id={`${id}-key-expiry`}
              type="date"
              value={expiresAt}
              // biome-ignore lint/nursery/noJsxPropsBind: controlled input handler
              onChange={e => setExpiresAt(e.target.value)}
              min={new Date().toISOString().split('T')[0]}
            />
          </div>
        </div>

        <DialogFooter>
          <DialogClose render={<Button variant="outline" />}>{tCommon('cancel')}</DialogClose>
          <Button
            // biome-ignore lint/nursery/noJsxPropsBind: callback in JSX prop
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

function RevokeDialog({
  keyId,
  keyName,
  open,
  onOpenChange,
}: {
  keyId: string;
  keyName: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const t = useTranslations('Settings.apiKeys');
  const tCommon = useTranslations('Common');
  const queryClient = useQueryClient();

  const revokeMutation = useMutation(
    trpc.apiKey.revoke.mutationOptions({
      onSuccess: () => {
        void queryClient.invalidateQueries({ queryKey: trpc.apiKey.list.queryKey() });
        toast.success(t('toast.revoked', { name: keyName }));
        onOpenChange(false);
      },
      onError: err => {
        toast.error(err.message ?? t('toast.revokeFailed'));
      },
    }),
  );

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
          <AlertDialogAction
            variant="destructive"
            // biome-ignore lint/nursery/noJsxPropsBind: callback in JSX prop
            onClick={() => revokeMutation.mutate({ id: keyId })}
            disabled={revokeMutation.isPending}>
            {!!revokeMutation.isPending && <Loader2 className="mr-2 size-4 animate-spin" />}
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

interface EditKeyDialogProps {
  keyId: string;
  initialName: string;
  initialScopes: readonly string[];
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

function EditKeyDialog({
  keyId,
  initialName,
  initialScopes,
  open,
  onOpenChange,
}: EditKeyDialogProps) {
  const t = useTranslations('Settings.apiKeys');
  const tCommon = useTranslations('Common');
  const id = useId();
  const queryClient = useQueryClient();
  const [name, setName] = useState(initialName);
  const initialScopeSet = initialScopes.filter((s): s is ScopeValue =>
    AVAILABLE_SCOPES.some(a => a.value === s),
  );
  const [scopes, setScopes] = useState<ScopeValue[]>(initialScopeSet);

  const updateMutation = useMutation(
    trpc.apiKey.update.mutationOptions({
      onSuccess: () => {
        void queryClient.invalidateQueries({ queryKey: trpc.apiKey.list.queryKey() });
        toast.success(t('toast.updated', { name }));
        onOpenChange(false);
      },
      onError: err => {
        toast.error(err.message ?? t('toast.updateFailed'));
      },
    }),
  );

  // Detect diff vs. initial values so we only send fields that actually
  // changed — keeps the audit log entry on the BE meaningful and avoids
  // surprising no-op updates.
  const trimmedName = name.trim();
  const nameChanged = trimmedName !== initialName && trimmedName.length > 0;
  const sortedInitial = [...initialScopeSet].sort();
  const sortedCurrent = [...scopes].sort();
  const scopesChanged =
    sortedCurrent.length !== sortedInitial.length ||
    sortedCurrent.some((s, i) => s !== sortedInitial[i]);
  const hasDiff = nameChanged || scopesChanged;
  const canSubmit = hasDiff && scopes.length > 0 && !updateMutation.isPending;

  function handleSubmit() {
    if (!canSubmit) return;
    updateMutation.mutate({
      id: keyId,
      ...(nameChanged ? { name: trimmedName } : {}),
      ...(scopesChanged ? { scopes } : {}),
    });
  }

  function handleClose(value: boolean) {
    if (!value) {
      setName(initialName);
      setScopes(initialScopeSet);
      updateMutation.reset();
    }
    onOpenChange(value);
  }

  function toggleScope(scope: ScopeValue) {
    setScopes(prev => (prev.includes(scope) ? prev.filter(s => s !== scope) : [...prev, scope]));
  }

  return (
    // biome-ignore lint/nursery/noJsxPropsBind: dialog/popover state handler
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Pencil className="size-4" />
            {t('editDialog.title')}
          </DialogTitle>
          <DialogDescription>{t('editDialog.description')}</DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor={`${id}-edit-name`}>{t('createDialog.nameLabel')}</Label>
            <Input
              id={`${id}-edit-name`}
              placeholder={t('createDialog.namePlaceholder')}
              value={name}
              // biome-ignore lint/nursery/noJsxPropsBind: controlled input handler
              onChange={e => setName(e.target.value)}
              autoFocus
            />
          </div>

          <div className="space-y-2">
            <Label>{t('createDialog.scopesLabel')}</Label>
            <div className="space-y-2 rounded-lg border p-3">
              {AVAILABLE_SCOPES.map(scope => (
                <label
                  key={scope.value}
                  htmlFor={`${id}-edit-scope-${scope.value}`}
                  className="flex cursor-pointer items-center gap-2.5 text-sm">
                  <Checkbox
                    id={`${id}-edit-scope-${scope.value}`}
                    checked={scopes.includes(scope.value)}
                    // biome-ignore lint/nursery/noJsxPropsBind: controlled component handler
                    onCheckedChange={() => toggleScope(scope.value)}
                  />
                  <span>{t(scope.labelKey)}</span>
                </label>
              ))}
            </div>
          </div>
        </div>

        <DialogFooter>
          <DialogClose render={<Button variant="outline" />}>{tCommon('cancel')}</DialogClose>
          <Button
            // biome-ignore lint/nursery/noJsxPropsBind: callback in JSX prop
            onClick={handleSubmit}
            disabled={!canSubmit}>
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

export function ApiKeysTab() {
  const t = useTranslations('Settings.apiKeys');
  const [createOpen, setCreateOpen] = useState(false);
  const [revokeTarget, setRevokeTarget] = useState<{ id: string; name: string } | null>(null);
  const [editTarget, setEditTarget] = useState<{
    id: string;
    name: string;
    scopes: readonly string[];
  } | null>(null);

  const { data: keys, isLoading } = useQuery(trpc.apiKey.list.queryOptions());

  return (
    <FeatureGate requiredTier="Enterprise" featureName="API Keys">
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-sm font-semibold">{t('title')}</h3>
            <p className="text-xs text-muted-foreground">{t('description')}</p>
          </div>
          {/* biome-ignore lint/nursery/noJsxPropsBind: callback in JSX prop */}
          <Button size="sm" onClick={() => setCreateOpen(true)}>
            <Plus className="mr-1.5 size-4" />
            {t('createKeyButton')}
          </Button>
        </div>

        {isLoading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="size-5 animate-spin text-muted-foreground" />
          </div>
        ) : keys?.length ? (
          <div className="rounded-lg border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t('tableHeaders.name')}</TableHead>
                  <TableHead>{t('tableHeaders.key')}</TableHead>
                  <TableHead>{t('tableHeaders.scopes')}</TableHead>
                  <TableHead>{t('tableHeaders.createdBy')}</TableHead>
                  <TableHead>{t('tableHeaders.created')}</TableHead>
                  <TableHead>{t('tableHeaders.lastUsed')}</TableHead>
                  <TableHead>{t('tableHeaders.status')}</TableHead>
                  <TableHead className="w-10" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {keys.map(key => {
                  const status = getKeyStatus(key);
                  return (
                    <TableRow key={key.id}>
                      <TableCell className="font-medium">{key.name}</TableCell>
                      <TableCell>
                        <code className="rounded bg-muted px-1.5 py-0.5 text-xs font-mono">
                          co_live_{key.prefix}...
                        </code>
                      </TableCell>
                      <TableCell>
                        <div className="flex flex-wrap gap-1">
                          {key.scopes.map(scope => (
                            <Badge key={scope} variant="outline" className="text-[10px]">
                              {scope}
                            </Badge>
                          ))}
                        </div>
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        {key.createdBy?.name ?? '—'}
                      </TableCell>
                      <TableCell className="text-muted-foreground text-xs">
                        {formatDate(key.createdAt)}
                      </TableCell>
                      <TableCell className="text-muted-foreground text-xs">
                        {formatDate(key.lastUsedAt)}
                      </TableCell>
                      <TableCell>
                        <Badge variant={statusBadgeVariant(status)} className="capitalize">
                          {status}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        {status === 'active' && (
                          <DropdownMenu>
                            <DropdownMenuTrigger
                              render={
                                <Button
                                  variant="ghost"
                                  size="icon-sm"
                                  aria-label={t('aria.keyActions')}
                                />
                              }>
                              <MoreHorizontal className="size-4" />
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              <DropdownMenuItem
                                // biome-ignore lint/nursery/noJsxPropsBind: callback in JSX prop
                                onClick={() =>
                                  setEditTarget({
                                    id: key.id,
                                    name: key.name,
                                    scopes: key.scopes,
                                  })
                                }>
                                <Pencil className="mr-2 size-4" />
                                {t('editAction')}
                              </DropdownMenuItem>
                              <DropdownMenuItem
                                className="text-destructive"
                                // biome-ignore lint/nursery/noJsxPropsBind: callback in JSX prop
                                onClick={() => setRevokeTarget({ id: key.id, name: key.name })}>
                                <Trash2 className="mr-2 size-4" />
                                {t('revokeAction')}
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        )}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center gap-2 rounded-lg border border-dashed py-12 text-center">
            <div className="rounded-lg bg-muted p-2.5">
              <Key className="size-5 text-muted-foreground" />
            </div>
            <p className="text-sm font-medium">{t('emptyHeading')}</p>
            <p className="text-xs text-muted-foreground">{t('emptyBody')}</p>
            <Button
              size="sm"
              variant="outline"
              className="mt-2"
              // biome-ignore lint/nursery/noJsxPropsBind: callback in JSX prop
              onClick={() => setCreateOpen(true)}>
              <Plus className="mr-1.5 size-4" />
              {t('createKeyButton')}
            </Button>
          </div>
        )}

        <CreateKeyDialog open={createOpen} onOpenChange={setCreateOpen} />

        {editTarget != null && (
          <EditKeyDialog
            keyId={editTarget.id}
            initialName={editTarget.name}
            initialScopes={editTarget.scopes}
            open={!!editTarget}
            // biome-ignore lint/nursery/noJsxPropsBind: dialog/popover state handler
            onOpenChange={open => {
              if (!open) setEditTarget(null);
            }}
          />
        )}

        {revokeTarget != null && (
          <RevokeDialog
            keyId={revokeTarget.id}
            keyName={revokeTarget.name}
            open={!!revokeTarget}
            // biome-ignore lint/nursery/noJsxPropsBind: dialog/popover state handler
            onOpenChange={open => {
              if (!open) setRevokeTarget(null);
            }}
          />
        )}
      </div>
    </FeatureGate>
  );
}
