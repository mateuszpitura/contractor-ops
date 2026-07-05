import { WEBHOOK_EVENT_TYPES } from '@contractor-ops/validators';
import { useQuery } from '@tanstack/react-query';
import { useId, useState } from 'react';

import { useResourceMutation } from '../../../../hooks/use-resource-mutation.js';
import { useTranslations } from '../../../../i18n/useTranslations.js';
import { useTRPC } from '../../../../providers/trpc-provider.js';

/** The 16 subscribable event types (from the shared catalog). */
export const WEBHOOK_EVENT_OPTIONS = WEBHOOK_EVENT_TYPES;
export type WebhookEventValue = (typeof WEBHOOK_EVENT_OPTIONS)[number];

export function useWebhooksTab() {
  const trpc = useTRPC();
  const t = useTranslations('Settings.webhooks');
  const { data: subscriptions, isLoading } = useQuery(trpc.webhookSubscription.list.queryOptions());
  return { t, subscriptions, isLoading } as const;
}

interface DialogOptions {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function useCreateWebhookDialog({ onOpenChange }: DialogOptions) {
  const trpc = useTRPC();
  const t = useTranslations('Settings.webhooks');
  const tCommon = useTranslations('Common');
  const id = useId();
  const [url, setUrl] = useState('');
  const [events, setEvents] = useState<WebhookEventValue[]>([]);
  const [includePii, setIncludePii] = useState(false);
  const [createdSecret, setCreatedSecret] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const isHttp = url.trim().toLowerCase().startsWith('http://');

  const createMutation = useResourceMutation(
    trpc.webhookSubscription.create.mutationOptions({
      onSuccess: data => {
        setCreatedSecret(data.secret);
      },
    }),
    {
      invalidate: [trpc.webhookSubscription.list.queryKey()],
      successMessage: t('toast.created'),
      errorMessage: t('toast.createFailed'),
    },
  );

  function handleCreate() {
    if (!url.trim() || events.length === 0) return;
    createMutation.mutate({
      url: url.trim(),
      eventFilter: events,
      includePii,
      httpAllowed: isHttp,
    });
  }

  function handleCopy() {
    if (!createdSecret) return;
    void navigator.clipboard.writeText(createdSecret);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  function handleClose(value: boolean) {
    if (!value) {
      setUrl('');
      setEvents([]);
      setIncludePii(false);
      setCreatedSecret(null);
      setCopied(false);
      createMutation.reset();
    }
    onOpenChange(value);
  }

  function toggleEvent(event: WebhookEventValue) {
    setEvents(prev => (prev.includes(event) ? prev.filter(e => e !== event) : [...prev, event]));
  }

  return {
    t,
    tCommon,
    id,
    url,
    setUrl,
    isHttp,
    events,
    toggleEvent,
    includePii,
    setIncludePii,
    createdSecret,
    copied,
    createMutation,
    handleCreate,
    handleCopy,
    handleClose,
  } as const;
}

interface DeleteDialogOptions {
  subscriptionId: string;
  onOpenChange: (open: boolean) => void;
}

export function useDeleteWebhookDialog({ subscriptionId, onOpenChange }: DeleteDialogOptions) {
  const trpc = useTRPC();
  const t = useTranslations('Settings.webhooks');
  const tCommon = useTranslations('Common');

  const deleteMutation = useResourceMutation(trpc.webhookSubscription.delete.mutationOptions(), {
    invalidate: [trpc.webhookSubscription.list.queryKey()],
    successMessage: t('toast.deleted'),
    errorMessage: t('toast.deleteFailed'),
    onClose: () => onOpenChange(false),
  });

  const handleDelete = () => deleteMutation.mutate({ id: subscriptionId });

  return { t, tCommon, isPending: deleteMutation.isPending, handleDelete } as const;
}

export function useWebhookRowActions() {
  const trpc = useTRPC();
  const t = useTranslations('Settings.webhooks');
  const [rotatedSecret, setRotatedSecret] = useState<string | null>(null);

  const testFireMutation = useResourceMutation(
    trpc.webhookSubscription.testFire.mutationOptions(),
    {
      successMessage: t('toast.tested'),
      errorMessage: t('toast.testFailed'),
    },
  );

  const rotateMutation = useResourceMutation(
    trpc.webhookSubscription.rotateSecret.mutationOptions({
      onSuccess: data => setRotatedSecret(data.secret),
    }),
    {
      successMessage: t('toast.rotated'),
      errorMessage: t('toast.rotateFailed'),
    },
  );

  return {
    t,
    rotatedSecret,
    clearRotatedSecret: () => setRotatedSecret(null),
    testFire: (id: string) => testFireMutation.mutate({ id }),
    rotateSecret: (id: string) => rotateMutation.mutate({ id }),
    testFirePending: testFireMutation.isPending,
    rotatePending: rotateMutation.isPending,
  } as const;
}
