/**
 * Locale-aware React Router navigation helpers — drop-in for the legacy
 * `next-intl/navigation` exports used across apps/web.
 */

import type { ComponentPropsWithoutRef } from 'react';
import { forwardRef } from 'react';
import type { NavigateOptions } from 'react-router-dom';
import { Link as RouterLink, useLocation, useNavigate, useParams } from 'react-router-dom';

export function useLocale(): string {
  const { locale } = useParams<{ locale: string }>();
  return locale ?? 'pl';
}

/** Prefix a locale-less app path (`/contractors`) with `/:locale`. */
export function localePath(path: string, locale?: string): string {
  const loc = locale ?? 'pl';
  const clean = path.startsWith('/') ? path : `/${path}`;
  if (clean === '/') return `/${loc}`;
  return `/${loc}${clean}`;
}

/** Pathname with the `/:locale` segment stripped (matches next-intl behaviour). */
export function usePathname(): string {
  const { pathname } = useLocation();
  const locale = useLocale();
  const prefix = `/${locale}`;
  if (pathname === prefix) return '/';
  if (pathname.startsWith(`${prefix}/`)) return pathname.slice(prefix.length);
  return pathname;
}

export function useRouter() {
  const navigate = useNavigate();
  const locale = useLocale();

  return {
    push: (path: string, options?: NavigateOptions) => navigate(localePath(path, locale), options),
    replace: (path: string, options?: NavigateOptions) =>
      navigate(localePath(path, locale), { ...options, replace: true }),
  };
}

type LocaleLinkProps = Omit<ComponentPropsWithoutRef<typeof RouterLink>, 'to'> & {
  href: string;
};

export const Link = forwardRef<HTMLAnchorElement, LocaleLinkProps>(function LocaleLink(
  { href, ...props },
  ref,
) {
  const locale = useLocale();
  return <RouterLink ref={ref} to={localePath(href, locale)} {...props} />;
});

export function redirect(path: string, locale?: string): Response {
  return Response.redirect(localePath(path, locale), 302);
}
