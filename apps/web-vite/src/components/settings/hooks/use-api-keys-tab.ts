import { useQuery } from '@tanstack/react-query';
import { useId, useState } from 'react';

import { useResourceMutation } from '../../../hooks/use-resource-mutation.js';
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

/** Default + max rotation grace window (hours), mirroring the backend clamp. */
export const ROTATE_GRACE_DEFAULT_HOURS = 24;
export const ROTATE_GRACE_OPTIONS = [1, 24, 72, 168] as const;

export function useApiKeysTab() {
  const trpc = useTRPC();
  const t = useTranslations('Settings.apiKeys');
  const { data: keys, isLoading } = useQuery(trpc.apiKey.list.queryOptions());

  return { t, keys, isLoading } as const;
}

interface UseCreateSandboxKeyDialogOptions {
  onOpenChange: (open: boolean) => void;
}

/**
 * Mints a free `co_test_` sandbox key. The plaintext is revealed exactly once
 * (mirrors the live-key create flow) and is never re-fetchable.
 */
export function useCreateSandboxKeyDialog({ onOpenChange }: UseCreateSandboxKeyDialogOptions) {
  const trpc = useTRPC();
  const t = useTranslations('Settings.apiKeys.sandbox');
  const tCommon = useTranslations('Common');
  const id = useId();
  const [name, setName] = useState('');
  const [sandboxKey, setSandboxKey] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const createMutation = useResourceMutation(
    trpc.apiKey.createSandboxKey.mutationOptions({
      onSuccess: data => {
        setSandboxKey(data.plaintext);
      },
    }),
    {
      invalidate: [trpc.apiKey.list.queryKey()],
      successMessage: t('toast.created'),
      errorMessage: t('toast.createFailed'),
    },
  );

  function handleCreate() {
    if (!name.trim()) return;
    createMutation.mutate({ name: name.trim() });
  }

  function handleCopy() {
    if (!sandboxKey) return;
    void navigator.clipboard.writeText(sandboxKey);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  function handleClose(value: boolean) {
    if (!value) {
      setName('');
      setSandboxKey(null);
      setCopied(false);
      createMutation.reset();
    }
    onOpenChange(value);
  }

  return {
    t,
    tCommon,
    id,
    name,
    setName,
    sandboxKey,
    copied,
    createMutation,
    handleCreate,
    handleCopy,
    handleClose,
  } as const;
}

interface UseRotateKeyDialogOptions {
  keyId: string;
  keyName: string;
  onOpenChange: (open: boolean) => void;
}

export function useRotateKeyDialog({ keyId, keyName, onOpenChange }: UseRotateKeyDialogOptions) {
  const trpc = useTRPC();
  const t = useTranslations('Settings.apiKeys');
  const tCommon = useTranslations('Common');
  const [graceHours, setGraceHours] = useState<number>(ROTATE_GRACE_DEFAULT_HOURS);
  const [rotatedKey, setRotatedKey] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const rotateMutation = useResourceMutation(
    trpc.apiKey.rotate.mutationOptions({
      onSuccess: data => {
        setRotatedKey(data.plaintext);
      },
    }),
    {
      invalidate: [trpc.apiKey.list.queryKey()],
      successMessage: t('toast.rotated', { name: keyName }),
      errorMessage: t('toast.rotateFailed'),
    },
  );

  function handleRotate() {
    rotateMutation.mutate({ id: keyId, graceHours });
  }

  function handleCopy() {
    if (!rotatedKey) return;
    void navigator.clipboard.writeText(rotatedKey);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  function handleClose(value: boolean) {
    if (!value) {
      setGraceHours(ROTATE_GRACE_DEFAULT_HOURS);
      setRotatedKey(null);
      setCopied(false);
      rotateMutation.reset();
    }
    onOpenChange(value);
  }

  return {
    t,
    tCommon,
    graceHours,
    setGraceHours,
    rotatedKey,
    copied,
    rotateMutation,
    handleRotate,
    handleCopy,
    handleClose,
  } as const;
}

export function useKeyDetail(keyId: string) {
  const trpc = useTRPC();
  const t = useTranslations('Settings.apiKeys');
  const ipLogQuery = useQuery(trpc.apiKey.ipLog.queryOptions({ id: keyId }));
  const usageQuery = useQuery(trpc.apiKey.usage.queryOptions());
  const membersQuery = useQuery(trpc.user.list.queryOptions());

  const rebindMutation = useResourceMutation(trpc.apiKey.update.mutationOptions(), {
    invalidate: [trpc.apiKey.list.queryKey()],
    successMessage: t('toast.rebound'),
    errorMessage: t('toast.rebindFailed'),
  });

  function rebind(actingUserId: string) {
    rebindMutation.mutate({ id: keyId, actingUserId });
  }

  return { t, ipLogQuery, usageQuery, membersQuery, rebindMutation, rebind } as const;
}

export function useCreateKeyDialog({ onOpenChange }: UseCreateKeyDialogOptions) {
  const trpc = useTRPC();
  const t = useTranslations('Settings.apiKeys');
  const tCommon = useTranslations('Common');
  const id = useId();
  const [name, setName] = useState('');
  const [scopes, setScopes] = useState<ScopeValue[]>([]);
  const [expiresAt, setExpiresAt] = useState('');
  const [createdKey, setCreatedKey] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const createMutation = useResourceMutation(
    trpc.apiKey.create.mutationOptions({
      onSuccess: data => {
        setCreatedKey(data.plaintext);
      },
    }),
    {
      invalidate: [trpc.apiKey.list.queryKey()],
      successMessage: t('toast.created'),
      errorMessage: t('toast.createFailed'),
    },
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

  const revokeMutation = useResourceMutation(trpc.apiKey.revoke.mutationOptions(), {
    invalidate: [trpc.apiKey.list.queryKey()],
    successMessage: t('toast.revoked', { name: keyName }),
    errorMessage: t('toast.revokeFailed'),
    onClose: () => onOpenChange(false),
  });

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
  const [name, setName] = useState(initialName);
  const initialScopeSet = initialScopes.filter((s): s is ScopeValue =>
    AVAILABLE_SCOPES.some(a => a.value === s),
  );
  const [scopes, setScopes] = useState<ScopeValue[]>(initialScopeSet);

  const updateMutation = useResourceMutation(trpc.apiKey.update.mutationOptions(), {
    invalidate: [trpc.apiKey.list.queryKey()],
    successMessage: t('toast.updated', { name }),
    errorMessage: t('toast.updateFailed'),
    onClose: () => onOpenChange(false),
  });

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
