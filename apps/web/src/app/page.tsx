import { getTranslations } from 'next-intl/server';

export default async function HomePage() {
  const t = await getTranslations('Common');

  return (
    <main>
      <h1>{t('appName')}</h1>
      <p>{t('appTagline')}</p>
    </main>
  );
}
