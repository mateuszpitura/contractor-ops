import { useTranslations } from 'next-intl';
import { Button } from '@/components/ui/button';
import { Link } from '@/i18n/navigation';

/**
 * Unauthorized access page.
 * Shown when user tries to access a page they don't have permission for.
 */
export default function UnauthorizedPage() {
  const t = useTranslations('Errors.unauthorized');

  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center text-center px-4">
      <div className="space-y-4">
        <p className="font-display text-6xl font-bold text-muted-foreground/20">{t('code')}</p>
        <h1 className="font-display text-[22px] font-semibold">{t('heading')}</h1>
        <p className="max-w-md text-sm text-muted-foreground">{t('body')}</p>
        <Button render={<Link href="/" />} className="mt-4">
          {t('cta')}
        </Button>
      </div>
    </div>
  );
}
