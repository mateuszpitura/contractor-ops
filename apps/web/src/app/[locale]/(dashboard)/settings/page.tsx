'use client';

import { AtelierPageHeader } from '@contractor-ops/ui';
import { useTranslations } from 'next-intl';
import { parseAsString, useQueryState } from 'nuqs';
import { Suspense, useCallback } from 'react';
import { BillingTab } from '@/components/billing/billing-tab';
import { ConsentManagementSection } from '@/components/consent/consent-management-section';
import { EInvoiceComplianceDetail } from '@/components/einvoice/compliance-detail';
import { AdminBrandingSection } from '@/components/settings/admin-branding-section';
import { ApiKeysTab } from '@/components/settings/api-keys-tab';
import { ApprovalChainsTab } from '@/components/settings/approval-chains-tab';
import { AuditLogTab } from '@/components/settings/audit-log-tab';
import { ExpiryReminderDefaults } from '@/components/settings/expiry-reminder-defaults';
import { IntegrationsTab } from '@/components/settings/integrations-tab';
import { InvoiceMatchingSettings } from '@/components/settings/invoice-matching-settings';
import { NotificationPreferences } from '@/components/settings/notification-preferences';
import { OrgSettingsForm } from '@/components/settings/org-settings-form';
import { ReminderRulesSection } from '@/components/settings/reminder-rules-section';
import { TransferTitleSettings } from '@/components/settings/transfer-title-settings';
import { AnimateIn } from '@/components/shared/animate-in';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { usePermissions } from '@/hooks/use-permissions';
import { useRouter } from '@/i18n/navigation';

// ---------------------------------------------------------------------------
// Inner content (uses nuqs, needs Suspense boundary)
// ---------------------------------------------------------------------------

function SettingsContent() {
  const t = useTranslations('Settings');
  const router = useRouter();
  const { can } = usePermissions();

  // URL-synced tab state for deep linking (e.g. OAuth callback to ?tab=integrations)
  const [activeTab, setActiveTab] = useQueryState('tab', parseAsString.withDefault('general'));

  const onSettingsTabChange = useCallback(
    (value: string) => {
      void setActiveTab(value);
    },
    [setActiveTab],
  );

  const goToMembers = useCallback(() => router.push('/settings/members'), [router]);
  const canManageIntegrations = can('organization', ['update']);
  const canManageBilling = can('organization', ['update']);
  const canViewAuditLog = can('settings', ['read']);

  return (
    <div className="space-y-6">
      <AnimateIn delay={0}>
        <AtelierPageHeader title={t('title')} description={t('subtitle')} />
      </AnimateIn>

      <AnimateIn delay={1}>
        <Tabs value={activeTab} onValueChange={onSettingsTabChange} className="w-full">
          <TabsList>
            <TabsTrigger value="general">{t('tabs.general')}</TabsTrigger>
            <TabsTrigger value="approvals">{t('tabs.approvals')}</TabsTrigger>
            <TabsTrigger value="notifications">{t('tabs.notifications')}</TabsTrigger>
            {canManageIntegrations && (
              <TabsTrigger value="integrations">{t('tabs.integrations')}</TabsTrigger>
            )}
            {canManageBilling && <TabsTrigger value="billing">{t('tabs.billing')}</TabsTrigger>}
            {canViewAuditLog && <TabsTrigger value="audit-log">{t('tabs.auditLog')}</TabsTrigger>}
            <TabsTrigger value="privacy">{t('tabs.privacy')}</TabsTrigger>
            {canManageIntegrations && (
              <TabsTrigger value="api-keys">
                {t('tabs.apiKeys', { defaultMessage: 'API Keys' })}
              </TabsTrigger>
            )}
            <TabsTrigger value="members" onClick={goToMembers}>
              {t('tabs.members')}
            </TabsTrigger>
          </TabsList>

          <TabsContent value="general" className="mt-6 space-y-6">
            <OrgSettingsForm />
            <ExpiryReminderDefaults />
            <InvoiceMatchingSettings />
            <TransferTitleSettings />
            <AdminBrandingSection />
          </TabsContent>

          <TabsContent value="approvals" className="mt-6">
            <ApprovalChainsTab />
          </TabsContent>

          <TabsContent value="notifications" className="mt-6 space-y-8">
            <NotificationPreferences />
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
