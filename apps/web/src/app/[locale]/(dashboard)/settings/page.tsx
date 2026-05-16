'use client';

import { AtelierPageHeader } from '@contractor-ops/ui';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { RefreshCw } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { parseAsString, useQueryState } from 'nuqs';
import { Suspense, useCallback, useMemo } from 'react';
import { toast } from 'sonner';
import { BillingTab } from '@/components/billing/billing-tab';
import { ConsentManagementSection } from '@/components/consent/consent-management-section';
import { EInvoiceComplianceDetail } from '@/components/einvoice/compliance-detail';
import { AdminBrandingSection } from '@/components/settings/admin-branding-section';
import { ApiKeysTab } from '@/components/settings/api-keys-tab';
import { ApprovalChainsTab } from '@/components/settings/approval-chains-tab';
import { AuditLogTab } from '@/components/settings/audit-log-tab';
import { ExpiryReminderDefaults } from '@/components/settings/expiry-reminder-defaults';
import { GdprDataRightsSection } from '@/components/settings/gdpr-data-rights-section';
import { IntegrationsTab } from '@/components/settings/integrations-tab';
import { InvoiceMatchingSettings } from '@/components/settings/invoice-matching-settings';
import { LanguageCard } from '@/components/settings/language-card';
import { NotificationPreferences } from '@/components/settings/notification-preferences';
import { OrgSettingsForm } from '@/components/settings/org-settings-form';
import { OutOfOfficeSection } from '@/components/settings/out-of-office-section';
import { PinTabButton } from '@/components/settings/pin-tab-button';
import { PortalSubdomainSection } from '@/components/settings/portal-subdomain-section';
import { ReminderRulesSection } from '@/components/settings/reminder-rules-section';
import { TransferTitleSettings } from '@/components/settings/transfer-title-settings';
import { AnimateIn } from '@/components/shared/animate-in';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { usePermissions } from '@/hooks/use-permissions';
import { Link, useRouter } from '@/i18n/navigation';
import type { SettingsTabKey } from '@/lib/settings-tabs';
import { SETTINGS_TABS } from '@/lib/settings-tabs';
import { cn } from '@/lib/utils';
import { trpc } from '@/trpc/init';

const PIN_KIND = 'settings-tab' as const;

type PinnedView = { kind: string; key: string; pinnedAt: Date };

// ---------------------------------------------------------------------------
// Inner content (uses nuqs, needs Suspense boundary)
// ---------------------------------------------------------------------------

function SettingsContent() {
  const t = useTranslations('Settings');
  const tPin = useTranslations('Settings.pin');
  const router = useRouter();
  const { can } = usePermissions();
  const queryClient = useQueryClient();

  // URL-synced tab state for deep linking (e.g. OAuth callback to ?tab=integrations)
  const [activeTab, setActiveTab] = useQueryState('tab', parseAsString.withDefault('general'));

  const onSettingsTabChange = useCallback(
    (value: string) => {
      if (value === 'members') {
        router.push('/settings/members');
        return;
      }
      if (value === 'workflow-roles') {
        router.push('/settings/workflow-roles');
        return;
      }
      if (value === 'tax') {
        router.push('/settings/tax');
        return;
      }
      void setActiveTab(value);
    },
    [setActiveTab, router],
  );
  const canManageIntegrations = can('organization', ['update']);
  const canManageBilling = can('organization', ['update']);
  const canViewAuditLog = can('settings', ['read']);
  const canViewTaxAdmin = can('settings', ['read']);

  // ---- Pinned tabs (single source of truth lives in `lib/settings-tabs.ts`) --
  const pinsQueryOpts = trpc.user.pins.list.queryOptions({ kind: PIN_KIND });
  const pinsQueryKey = trpc.user.pins.list.queryKey({ kind: PIN_KIND });
  const pinsQuery = useQuery(pinsQueryOpts);
  const pinnedKeys = useMemo(() => {
    const set = new Set<string>();
    for (const pin of pinsQuery.data ?? []) {
      if (pin.kind === PIN_KIND) set.add(pin.key);
    }
    return set;
  }, [pinsQuery.data]);

  const pinToggle = useMutation(
    trpc.user.pins.toggle.mutationOptions({
      onMutate: async variables => {
        await queryClient.cancelQueries({ queryKey: pinsQueryKey });
        const previous = queryClient.getQueryData<PinnedView[]>(pinsQueryKey) ?? [];
        const exists = previous.some(p => p.kind === variables.kind && p.key === variables.key);
        const next: PinnedView[] = exists
          ? previous.filter(p => !(p.kind === variables.kind && p.key === variables.key))
          : [...previous, { kind: variables.kind, key: variables.key, pinnedAt: new Date() }];
        queryClient.setQueryData(pinsQueryKey, next);
        return { previous };
      },
      onError: (_err, _variables, context) => {
        if (context && 'previous' in context) {
          queryClient.setQueryData(pinsQueryKey, context.previous);
        }
        toast.error(tPin('error'));
      },
      onSettled: () => {
        void queryClient.invalidateQueries({ queryKey: pinsQueryKey });
      },
    }),
  );

  const togglePin = useCallback(
    (key: SettingsTabKey) => {
      pinToggle.mutate({ kind: PIN_KIND, key });
    },
    [pinToggle],
  );

  type RenderableTab = {
    key: SettingsTabKey;
    label: string;
    pinned: boolean;
    pinAriaLabel: string;
    unpinAriaLabel: string;
  };

  const tabsToRender: RenderableTab[] = useMemo(() => {
    return SETTINGS_TABS.filter(tab => {
      if (tab.key === 'integrations') return canManageIntegrations;
      if (tab.key === 'billing') return canManageBilling;
      if (tab.key === 'audit-log') return canViewAuditLog;
      if (tab.key === 'api-keys') return canManageIntegrations;
      return true;
    }).map(tab => {
      const label = t(`tabs.${tab.i18nKey}`);
      return {
        key: tab.key,
        label,
        pinned: pinnedKeys.has(tab.key),
        pinAriaLabel: tPin('pin', { tab: label }),
        unpinAriaLabel: tPin('unpin', { tab: label }),
      };
    });
  }, [t, tPin, pinnedKeys, canManageIntegrations, canManageBilling, canViewAuditLog]);

  return (
    <div className="space-y-6">
      <AnimateIn delay={0}>
        <AtelierPageHeader title={t('title')} description={t('subtitle')} />
      </AnimateIn>

      <AnimateIn delay={1}>
        <Tabs value={activeTab} onValueChange={onSettingsTabChange} className="w-full">
          <TabsList>
            {tabsToRender.map(tab => {
              const isActive = activeTab === tab.key;
              const showsButton = tab.pinned || isActive;
              return (
                <TabsTrigger
                  key={tab.key}
                  value={tab.key}
                  className={cn('gap-1.5', showsButton && 'pe-1.5')}>
                  <span>{tab.label}</span>
                  <PinTabButton
                    tabKey={tab.key}
                    tabLabel={tab.label}
                    pinned={tab.pinned}
                    active={isActive}
                    disabled={pinToggle.isPending}
                    pinAriaLabel={tab.pinAriaLabel}
                    unpinAriaLabel={tab.unpinAriaLabel}
                    // biome-ignore lint/nursery/noJsxPropsBind: per-row callback
                    onToggle={() => togglePin(tab.key)}
                  />
                </TabsTrigger>
              );
            })}
            <TabsTrigger value="workflow-roles">{t('tabs.workflowRoles')}</TabsTrigger>
            {canViewTaxAdmin && <TabsTrigger value="tax">{t('tabs.tax')}</TabsTrigger>}
          </TabsList>

          <TabsContent value="general" className="mt-6 space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="text-base">{t('reimport.title')}</CardTitle>
                <CardDescription>{t('reimport.description')}</CardDescription>
              </CardHeader>
              <CardContent>
                <Button variant="outline" render={<Link href="/onboarding/import" />}>
                  <RefreshCw className="h-4 w-4" />
                  {t('reimport.cta')}
                </Button>
              </CardContent>
            </Card>
            <LanguageCard />
            <OrgSettingsForm />
            <ExpiryReminderDefaults />
            <InvoiceMatchingSettings />
            <TransferTitleSettings />
            <AdminBrandingSection />
            <PortalSubdomainSection />
          </TabsContent>

          <TabsContent value="approvals" className="mt-6">
            <ApprovalChainsTab />
          </TabsContent>

          <TabsContent value="notifications" className="mt-6 space-y-8">
            <NotificationPreferences />
            <OutOfOfficeSection />
            <ReminderRulesSection />
          </TabsContent>

          {canManageIntegrations && (
            <TabsContent value="integrations" className="mt-6 space-y-8">
              <EInvoiceComplianceDetail />
              <IntegrationsTab />
            </TabsContent>
          )}

          {canManageBilling && (
            <TabsContent value="billing" className="mt-6 space-y-8">
              <BillingTab />
            </TabsContent>
          )}

          {canViewAuditLog && (
            <TabsContent value="audit-log" className="mt-6">
              <AuditLogTab />
            </TabsContent>
          )}

          <TabsContent value="privacy" className="mt-6 space-y-6">
            <ConsentManagementSection />
            <GdprDataRightsSection />
          </TabsContent>

          {canManageIntegrations && (
            <TabsContent value="api-keys" className="mt-6">
              <ApiKeysTab />
            </TabsContent>
          )}
        </Tabs>
      </AnimateIn>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Page (with Suspense boundary for nuqs)
// ---------------------------------------------------------------------------

/**
 * Organization settings page.
 * Tabs: General, Approvals, Notifications, Integrations (admin), Members.
 * Tab state synced to URL via nuqs for deep linking (OAuth callback support).
 */
export default function SettingsPage() {
  return (
    <Suspense>
      <SettingsContent />
    </Suspense>
  );
}
