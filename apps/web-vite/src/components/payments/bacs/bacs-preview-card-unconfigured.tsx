import { Alert, AlertDescription, AlertTitle } from '@contractor-ops/ui/components/shadcn/alert';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from '@contractor-ops/ui/components/shadcn/card';

import { Link } from '../../../i18n/navigation.js';
import { useTranslations } from '../../../i18n/useTranslations.js';

export function BacsPreviewCardUnconfigured() {
  const t = useTranslations('Payments.bacs');
  return (
    <Card data-testid="bacs-preview-card-unconfigured">
      <CardHeader>
        <CardTitle className="text-xl">{t('previewCardTitle')}</CardTitle>
      </CardHeader>
      <CardContent>
        <Alert variant="default" className="border-amber-300/50 bg-amber-500/5">
          <AlertTitle className="text-amber-700 dark:text-amber-400">
            {t('submitterNotConfigured')}
          </AlertTitle>
          <AlertDescription className="mt-2">
            <Link
              href="/settings/payments"
              className="text-primary underline underline-offset-4 hover:no-underline">
              {t('settingsPageTitle')} →
            </Link>
          </AlertDescription>
        </Alert>
      </CardContent>
    </Card>
  );
}
