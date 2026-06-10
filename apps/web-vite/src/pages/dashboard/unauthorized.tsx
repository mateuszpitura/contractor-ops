import { Button } from '@contractor-ops/ui/components/shadcn/button';

import { Link } from '../../i18n/navigation.js';
import { useTranslations } from '../../i18n/useTranslations.js';

export default function UnauthorizedPage() {
  const t = useTranslations('Errors.unauthorized');

  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center px-4 text-center">
      <div className="space-y-4">
        <p className="font-display text-6xl font-bold text-muted-foreground/80">{t('code')}</p>
        <h1 className="font-display text-[22px] font-semibold">{t('heading')}</h1>
        <p className="max-w-md text-sm text-muted-foreground">{t('body')}</p>
        <Button render={<Link href="/" />} className="mt-4">
          {t('cta')}
        </Button>
      </div>
    </div>
  );
}
