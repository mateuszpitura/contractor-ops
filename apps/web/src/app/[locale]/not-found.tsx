import { useTranslations } from 'next-intl';
import { Button } from '@/components/ui/button';
import { Link } from '@/i18n/navigation';

/**
 * 404 Not Found page.
 * Styled error page with CTA to return to dashboard.
 */
export default function NotFoundPage() {
  const t = useTranslations('Errors.notFound');

  return (
    <div className="flex min-h-screen flex-col items-center justify-center text-center px-4">
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
