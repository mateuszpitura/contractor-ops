import { getTranslations } from 'next-intl/server';
import { Link } from '@/i18n/navigation';

export default async function LegalLayout({ children }: { children: React.ReactNode }) {
  const t = await getTranslations('Legal');

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b">
        <div className="container mx-auto flex h-14 items-center px-6">
          <Link href="/" className="text-lg font-semibold">
            {t('nav.brand')}
          </Link>
        </div>
      </header>
      <main className="container mx-auto max-w-3xl px-6 py-12">{children}</main>
      <footer className="border-t py-8">
        <div className="container mx-auto flex gap-6 px-6 text-sm text-muted-foreground">
          <Link href="/legal/privacy" className="hover:underline">
            {t('nav.privacy')}
          </Link>
          <Link href="/legal/terms" className="hover:underline">
            {t('nav.terms')}
          </Link>
          <Link href="/legal/sub-processors" className="hover:underline">
            {t('nav.subProcessors')}
          </Link>
          <Link href="/legal/breach-notification" className="hover:underline">
            {t('nav.breachNotification')}
          </Link>
        </div>
      </footer>
    </div>
  );
}
