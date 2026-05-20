'use client';

import { Card } from '@contractor-ops/ui/components/shadcn/card';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@contractor-ops/ui/components/shadcn/collapsible';
import { Skeleton } from '@contractor-ops/ui/components/shadcn/skeleton';
import { Switch } from '@contractor-ops/ui/components/shadcn/switch';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { LucideIcon } from 'lucide-react';
import { Banknote, ChevronDown, FileText, FolderOpen, Receipt, Shield } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useState } from 'react';
import { toast } from 'sonner';
import type { LooseTranslator } from '@/i18n/typed-keys';
import { portalTrpc } from '@/trpc/init';

// ---------------------------------------------------------------------------
// Category config
// ---------------------------------------------------------------------------

type NotificationCategory =
  | 'INVOICE_UPDATES'
  | 'PAYMENT_CONFIRMATIONS'
  | 'CONTRACT_CHANGES'
  | 'DOCUMENT_UPLOADS'
  | 'SECURITY_ALERTS';

interface CategoryConfig {
  category: NotificationCategory;
  icon: LucideIcon;
  label: string;
  description: string;
  locked?: boolean;
}

function getCategories(t: LooseTranslator): CategoryConfig[] {
  return [
    {
      category: 'INVOICE_UPDATES',
      icon: Receipt,
      label: t('categories.invoiceUpdates'),
      description: t('categories.invoiceUpdatesDesc'),
    },
    {
      category: 'PAYMENT_CONFIRMATIONS',
      icon: Banknote,
      label: t('categories.paymentConfirmations'),
      description: t('categories.paymentConfirmationsDesc'),
    },
    {
      category: 'CONTRACT_CHANGES',
      icon: FileText,
      label: t('categories.contractChanges'),
      description: t('categories.contractChangesDesc'),
    },
    {
      category: 'DOCUMENT_UPLOADS',
      icon: FolderOpen,
      label: t('categories.documentUploads'),
      description: t('categories.documentUploadsDesc'),
    },
    {
      category: 'SECURITY_ALERTS',
      icon: Shield,
      label: t('categories.securityAlerts'),
      description: t('categories.securityAlertsDesc'),
      locked: true,
    },
  ];
}

// ---------------------------------------------------------------------------
// Loading skeleton
// ---------------------------------------------------------------------------

function PreferencesSkeleton() {
  return (
    <div className="space-y-1">
      {Array.from({ length: 5 }).map((_, i) => (
        // biome-ignore lint/suspicious/noArrayIndexKey: static skeleton list
        <div key={`pref-${i}`} className="flex min-h-[48px] items-center justify-between px-4 py-3">
          <div className="flex items-center gap-3">
            <Skeleton className="h-5 w-5 rounded" />
            <div className="space-y-1">
              <Skeleton className="h-4 w-32" />
              <Skeleton className="h-3 w-56" />
            </div>
          </div>
          <Skeleton className="h-[18px] w-[32px] rounded-full" />
        </div>
      ))}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

/**
 * Notification preferences section with 5 toggle rows.
 * Each toggle saves immediately with optimistic updates.
 * Security alerts toggle is always on and disabled.
 *
 * Per D-06, D-07, and UI-SPEC.
 */
export function NotificationPreferencesSection() {
  const t = useTranslations('Portal.notificationPreferences');
  const [isOpen, setIsOpen] = useState(true);
  const queryClient = useQueryClient();

  const CATEGORIES = getCategories(t);

  const prefsQuery = useQuery(portalTrpc.portal.getNotificationPreferences.queryOptions());

  type PreferenceItem = { category: NotificationCategory; emailEnabled: boolean };

  const queryKey = portalTrpc.portal.getNotificationPreferences.queryOptions().queryKey;

  const updatePrefBase = portalTrpc.portal.updateNotificationPreference.mutationOptions({
    onError: err => toast.error(err.message),
    onSuccess: () => {
      toast.success(t('toast.updated'));
      queryClient.invalidateQueries(portalTrpc.portal.pathFilter());
    },
  });

  const updatePref = useMutation({
    mutationFn: updatePrefBase.mutationFn,
    onMutate: async (newPref: { category: NotificationCategory; emailEnabled: boolean }) => {
      await queryClient.cancelQueries({ queryKey });

      const previousPrefs = queryClient.getQueryData<PreferenceItem[]>(queryKey);

      queryClient.setQueryData<PreferenceItem[]>(
        queryKey,
        old =>
          old?.map(p =>
            p.category === newPref.category ? { ...p, emailEnabled: newPref.emailEnabled } : p,
          ) ?? [],
      );

      return { previousPrefs };
    },
    onError: (
      _err: unknown,
      _newPref: { category: NotificationCategory; emailEnabled: boolean },
      context: { previousPrefs: PreferenceItem[] | undefined } | undefined,
    ) => {
      if (context?.previousPrefs) {
        queryClient.setQueryData<PreferenceItem[]>(queryKey, context.previousPrefs);
      }
      toast.error(t('errors.updateFailed'));
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey });
    },
  });

  const preferences = prefsQuery.data;

  const getChecked = (category: NotificationCategory): boolean => {
    const pref = preferences?.find(p => p.category === category);
    return pref?.emailEnabled ?? true;
  };

  const handleToggle = (category: NotificationCategory, checked: boolean) => {
    updatePref.mutate({ category, emailEnabled: checked });
  };

  return (
    <Card>
      <Collapsible open={isOpen} onOpenChange={setIsOpen}>
        {/* Trigger row */}
        <CollapsibleTrigger
          // biome-ignore lint/nursery/noJsxPropsBind: render-prop pattern for headless UI
          render={props => (
            <button
              {...props}
              type="button"
              className="flex min-h-[48px] w-full items-center gap-3 px-4 py-3 text-start outline-none">
              <ChevronDown
                className={`h-4 w-4 shrink-0 text-muted-foreground transition-transform duration-200 ${
                  isOpen ? 'rotate-180' : ''
                }`}
              />
              <span className="text-sm font-semibold">{t('title')}</span>
            </button>
          )}
        />

        {/* Content */}
        <CollapsibleContent>
          <div className="border-t">
            {prefsQuery.isPending ? (
              <PreferencesSkeleton />
            ) : (
              <div className="divide-y">
                {CATEGORIES.map(cat => {
                  const Icon = cat.icon;
                  const checked = cat.locked ? true : getChecked(cat.category);

                  return (
                    <div
                      key={cat.category}
                      className="flex min-h-[48px] items-center justify-between gap-4 px-4 py-3">
                      <div className="flex items-center gap-3">
                        <Icon className="h-5 w-5 shrink-0 text-muted-foreground" />
                        <div>
                          <p className="text-sm">{cat.label}</p>
                          <p className="text-sm text-muted-foreground">{cat.description}</p>
                        </div>
                      </div>
                      <div className="shrink-0">
                        <Switch
                          checked={checked}
                          // biome-ignore lint/nursery/noJsxPropsBind: controlled component handler
                          onCheckedChange={val => handleToggle(cat.category, val)}
                          disabled={cat.locked}
                          aria-label={cat.label}
                        />
                        {!!cat.locked && (
                          <p className="mt-1 text-end text-xs text-muted-foreground">
                            {t('securityLocked')}
                          </p>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </CollapsibleContent>
      </Collapsible>
    </Card>
  );
}
