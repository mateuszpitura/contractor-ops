import { APP_BASE_URLS } from './auth.js';
import type { Locale, RouteSpec, Theme, ViewportSpec, WalkState } from './routes.js';

export interface MatrixEntry {
  route: RouteSpec;
  locale: Locale;
  theme: Theme;
  viewport: ViewportSpec;
  walkState: WalkState;
}

export function buildUrl(
  route: RouteSpec,
  locale: Locale,
): { url: string; missingParams: string[] } {
  const base = APP_BASE_URLS[route.app];
  const localized = route.localized ?? true;
  const samples = route.paramSamples ?? {};

  let path = route.pathTemplate;
  const missingParams: string[] = [];
  path = path.replace(/\[([^\]]+)\]/g, (_match, name: string) => {
    const fromEnv = process.env[`QA_PARAM_${name.toUpperCase()}`];
    if (fromEnv) return fromEnv;
    if (samples[name]) return samples[name];
    missingParams.push(name);
    return `__missing_${name}__`;
  });

  if (localized && !path.startsWith(`/${locale}`)) {
    path = path === '/' ? `/${locale}` : `/${locale}${path}`;
  }

  return { url: `${base}${path}`, missingParams };
}
