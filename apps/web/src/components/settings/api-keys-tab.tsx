'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  Check,
  ClipboardCopy,
  Key,
  Loader2,
  MoreHorizontal,
  Plus,
  ShieldAlert,
  Trash2,
} from 'lucide-react';
import { useId, useState } from 'react';
import { toast } from 'sonner';
import { FeatureGate } from '@/components/billing/feature-gate';
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
} from '@/components/ui/alert-dialog';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { trpc } from '@/trpc/init';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const AVAILABLE_SCOPES = [
  { value: 'contractor:read', label: 'Contractors (read)' },
  { value: 'contract:read', label: 'Contracts (read)' },
  { value: 'invoice:read', label: 'Invoices (read)' },
  { value: 'document:read', label: 'Documents (read)' },
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
        toast.success('API key created');
      },
      onError: err => {
        toast.error(err.message ?? 'Failed to create API key');
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
              API Key Created
            </DialogTitle>
            <DialogDescription>
              Copy your key now. You won&apos;t be able to see it again.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3">
            <div className="flex items-center gap-2 rounded-lg border bg-muted/50 p-3">
              <code className="flex-1 break-all text-xs font-mono">{createdKey}</code>
              {/* biome-ignore lint/nursery/noJsxPropsBind: callback in JSX prop */}
              <Button variant="ghost" size="icon-sm" onClick={handleCopy} aria-label="Copy key">
                {copied ? (
                  <Check className="size-4 text-green-600" />
                ) : (
                  <ClipboardCopy className="size-4" />
                )}
              </Button>
            </div>

            <div className="flex items-start gap-2 rounded-lg border border-amber-500/30 bg-amber-500/5 p-3 text-xs text-amber-700 dark:text-amber-400">
              <ShieldAlert className="mt-0.5 size-4 shrink-0" />
              <span>
                Store this key securely. It cannot be retrieved after closing this dialog.
              </span>
            </div>
          </div>

          <DialogFooter>
            <DialogClose render={<Button />}>Done</DialogClose>
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
            Create API Key
          </DialogTitle>
          <DialogDescription>
            Generate a key for the Enterprise REST API. Select the scopes this key should have
            access to.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor={`${id}-key-name`}>Name</Label>
            <Input
              id={`${id}-key-name`}
              placeholder="e.g. ERP Integration"
              value={name}
              // biome-ignore lint/nursery/noJsxPropsBind: controlled input handler
              onChange={e => setName(e.target.value)}
              autoFocus
            />
          </div>

          <div className="space-y-2">
            <Label>Scopes</Label>
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
                  <span>{scope.label}</span>
                </label>
              ))}
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor={`${id}-key-expiry`}>Expiry (optional)</Label>
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
          <DialogClose render={<Button variant="outline" />}>Cancel</DialogClose>
          <Button
            // biome-ignore lint/nursery/noJsxPropsBind: callback in JSX prop
            onClick={handleCreate}
            disabled={!name.trim() || scopes.length === 0 || createMutation.isPending}>
            {!!createMutation.isPending && <Loader2 className="mr-2 size-4 animate-spin" />}
            Create Key
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
  const queryClient = useQueryClient();

  const revokeMutation = useMutation(
    trpc.apiKey.revoke.mutationOptions({
      onSuccess: () => {
        void queryClient.invalidateQueries({ queryKey: trpc.apiKey.list.queryKey() });
        toast.success(`API key "${keyName}" revoked`);
        onOpenChange(false);
      },
      onError: err => {
        toast.error(err.message ?? 'Failed to revoke key');
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
          <AlertDialogTitle>Revoke API Key</AlertDialogTitle>
          <AlertDialogDescription>
            Revoke <strong>{keyName}</strong>? This is immediate and irreversible. Any integrations
            using this key will stop working.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancel</AlertDialogCancel>
          <AlertDialogAction
            variant="destructive"
            // biome-ignore lint/nursery/noJsxPropsBind: callback in JSX prop
            onClick={() => revokeMutation.mutate({ id: keyId })}
            disabled={revokeMutation.isPending}>
            {!!revokeMutation.isPending && <Loader2 className="mr-2 size-4 animate-spin" />}
            Revoke Key
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

export function ApiKeysTab() {
  const [createOpen, setCreateOpen] = useState(false);
  const [revokeTarget, setRevokeTarget] = useState<{ id: string; name: string } | null>(null);

  const { data: keys, isLoading } = useQuery(trpc.apiKey.list.queryOptions());

  return (
    <FeatureGate requiredTier="Enterprise" featureName="API Keys">
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-sm font-semibold">API Keys</h3>
            <p className="text-xs text-muted-foreground">
              Manage API keys for the Enterprise REST API.
            </p>
          </div>
          {/* biome-ignore lint/nursery/noJsxPropsBind: callback in JSX prop */}
          <Button size="sm" onClick={() => setCreateOpen(true)}>
            <Plus className="mr-1.5 size-4" />
            Create Key
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
                  <TableHead>Name</TableHead>
                  <TableHead>Key</TableHead>
                  <TableHead>Scopes</TableHead>
                  <TableHead>Created By</TableHead>
                  <TableHead>Created</TableHead>
                  <TableHead>Last Used</TableHead>
                  <TableHead>Status</TableHead>
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
                                <Button variant="ghost" size="icon-sm" aria-label="Key actions" />
                              }>
                              <MoreHorizontal className="size-4" />
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              <DropdownMenuItem
                                className="text-destructive"
                                // biome-ignore lint/nursery/noJsxPropsBind: callback in JSX prop
                                onClick={() => setRevokeTarget({ id: key.id, name: key.name })}>
                                <Trash2 className="mr-2 size-4" />
                                Revoke
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
            <p className="text-sm font-medium">No API keys yet</p>
            <p className="text-xs text-muted-foreground">
              Create your first API key to start using the REST API.
            </p>
            <Button
              size="sm"
              variant="outline"
              className="mt-2"
              // biome-ignore lint/nursery/noJsxPropsBind: callback in JSX prop
              onClick={() => setCreateOpen(true)}>
              <Plus className="mr-1.5 size-4" />
              Create Key
            </Button>
          </div>
        )}

        <CreateKeyDialog open={createOpen} onOpenChange={setCreateOpen} />

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
