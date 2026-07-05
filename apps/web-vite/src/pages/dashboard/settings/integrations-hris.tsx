/**
 * HRIS two-way sync settings — thin route shell.
 *
 * Composes the header + the section container; all data access lives in the
 * container's hook (`use-hris-sync`), so this page has no tRPC. The whole
 * surface is dark behind module.workforce-employees + integration.*-sync.
 */

import { Button } from '@contractor-ops/ui/components/shadcn/button';
import { ArrowLeft } from 'lucide-react';

import { HrisSyncSettingsContainer } from '../../../components/hris-sync/hris-sync-settings-container.js';
import { AnimateIn } from '../../../components/shared/animate-in.js';
import { WorkbenchPageHeader } from '../../../components/shared/workbench-page-header.js';
import { Link } from '../../../i18n/navigation.js';
import { useTranslations } from '../../../i18n/useTranslations.js';

function HrisIntegrationPageContent() {
  const t = useTranslations('HrisSync');
  return (
    <div className="space-y-6">
      <AnimateIn delay={0}>
        <WorkbenchPageHeader
          title={t('title')}
          description={t('description')}
          actions={
            <Button
              variant="ghost"
              size="icon"
              render={<Link href="/settings?tab=integrations" />}
              aria-label={t('backAriaLabel')}>
              <ArrowLeft className="h-4 w-4" />
            </Button>
          }
        />
      </AnimateIn>
      <AnimateIn delay={1}>
        <HrisSyncSettingsContainer />
      </AnimateIn>
    </div>
  );
}

export default function HrisIntegrationPage() {
  return <HrisIntegrationPageContent />;
}
