import Link from 'next/link';
import { notFound } from 'next/navigation';
import type { ReactNode } from 'react';
import type { Locale } from '@/i18n/config';
import { direction, isSupportedLocale, SUPPORTED_LOCALES } from '@/i18n/config';

type Props = {
  children: ReactNode;
  params: Promise<{ locale: string }>;
};

export default async function LocaleLayout({ children, params }: Props): Promise<ReactNode> {
  const { locale } = await params;
  if (!isSupportedLocale(locale)) {
    notFound();
  }

  return (
    <div lang={locale} dir={direction(locale)} className="layout">
      <header className="site-header">
        <div className="container site-header__inner">
          <Link href={`/${locale}`} className="site-header__brand" aria-label="Contractor-Ops Blog">
            <span className="brand-mark" aria-hidden="true">
              CO
            </span>
            <span className="brand-text">Contractor-Ops · Blog</span>
          </Link>
          <nav className="site-header__nav" aria-label="Primary">
            <Link href={`/${locale}/blog`}>Articles</Link>
            <Link href="https://contractor-ops.io" rel="noopener noreferrer">
              ← Product
            </Link>
          </nav>
        </div>
      </header>
      <main className="site-main">{children}</main>
      <footer className="site-footer">
        <div className="container site-footer__inner">
          <p>© {new Date().getFullYear()} Contractor-Ops · All rights reserved.</p>
          <ul className="locale-switch">
            {SUPPORTED_LOCALES.map(alt => (
              <li key={alt} className={alt === locale ? 'is-active' : ''}>
                <Link href={`/${alt}`} hrefLang={alt}>
                  {alt.toUpperCase()}
                </Link>
              </li>
            ))}
          </ul>
        </div>
      </footer>
    </div>
  );
}
