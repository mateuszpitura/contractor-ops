import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useId, useState } from 'react';
import { toast } from 'sonner';

import { useTranslations } from '../../../i18n/useTranslations.js';
import { useTRPC } from '../../../providers/trpc-provider.js';

export const AVAILABLE_SCOPES = [
  { value: 'contractor:read', labelKey: 'scopeLabels.contractorRead' },
  { value: 'contract:read', labelKey: 'scopeLabels.contractRead' },
  { value: 'invoice:read', labelKey: 'scopeLabels.invoiceRead' },
  { value: 'document:read', labelKey: 'scopeLabels.documentRead' },
] as const;

export type ScopeValue = (typeof AVAILABLE_SCOPES)[number]['value'];

interface UseCreateKeyDialogOptions {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function useApiKeysTab() {
  const trpc = useTRPC();
  const t = useTranslations('Settings.apiKeys');
  const { data: keys, isLoading } = useQuery(trpc.apiKey.list.queryOptions());

  return { t, keys, isLoading } as const;
}

export function useCreateKeyDialog({ onOpenChange }: UseCreateKeyDialogOptions) {
  const trpc = useTRPC();
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

  return {
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
  } as const;
}

interface UseRevokeKeyDialogOptions {
  keyId: string;
  keyName: string;
  onOpenChange: (open: boolean) => void;
}

export function useRevokeKeyDialog({ keyId, keyName, onOpenChange }: UseRevokeKeyDialogOptions) {
  const trpc = useTRPC();
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

  const handleRevoke = () => revokeMutation.mutate({ id: keyId });

  return {
    t,
    tCommon,
    isPending: revokeMutation.isPending,
    handleRevoke,
  } as const;
}

interface UseEditKeyDialogOptions {
  keyId: string;
  initialName: string;
  initialScopes: readonly string[];
  onOpenChange: (open: boolean) => void;
}

export function useEditKeyDialog({
  keyId,
  initialName,
  initialScopes,
  onOpenChange,
}: UseEditKeyDialogOptions) {
  const trpc = useTRPC();
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

  return {
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
  } as const;
}
