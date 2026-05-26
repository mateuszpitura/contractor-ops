/**
 * DOM inspection gates — render quality, loading state, layout, i18n.
 */

import type { Page } from 'playwright';
import type { Locale, RouteSpec } from './routes.js';

export interface RenderQualityResult {
  ok: boolean;
  reason?: string;
}

export interface LoadingStateResult {
  ok: boolean;
  count: number;
  selectors: string[];
}

export interface UiProbeFinding {
  cluster: string;
  severity: 'blocker' | 'high' | 'medium' | 'low';
  message: string;
  detail?: string;
}

const LOADING_SELECTORS = [
  '[data-slot="skeleton"]',
  '[data-sidebar="menu-skeleton-icon"]',
  '.animate-pulse',
  '[data-state="loading"]',
  '[aria-busy="true"]',
  'main [role="progressbar"]',
] as const;

export async function waitForDataReady(page: Page, timeoutMs = 12_000): Promise<void> {
  const selectorList = [
    '.animate-pulse',
    '[data-slot="skeleton"]',
    '[data-state="loading"]',
    '[aria-busy="true"][role="status"]',
    '[data-sidebar="menu-skeleton-icon"]',
  ].join(', ');
  try {
    await page.waitForFunction(sel => document.querySelectorAll(sel).length === 0, selectorList, {
      timeout: timeoutMs,
      polling: 200,
    });
  } catch {
    // Caller runs inspectLoadingState — do not treat timeout as success.
  }
}

export async function inspectLoadingState(page: Page): Promise<LoadingStateResult> {
  try {
    const report = await page.evaluate(selectors => {
      const hits: string[] = [];
      for (const sel of selectors) {
        const n = document.querySelectorAll(sel).length;
        if (n > 0) hits.push(`${sel}(${n})`);
      }
      return { count: hits.length, selectors: hits.slice(0, 5) };
    }, LOADING_SELECTORS);
    return { ok: report.count === 0, count: report.count, selectors: report.selectors };
  } catch (err) {
    return {
      ok: false,
      count: -1,
      selectors: [`evaluate failed: ${(err as Error).message}`],
    };
  }
}

export async function inspectRenderQuality(page: Page): Promise<RenderQualityResult> {
  try {
    const report = await page.evaluate(() => {
      const portal = document.querySelector('nextjs-portal');
      const dialog =
        portal?.shadowRoot?.querySelector('[data-nextjs-dialog]') ??
        portal?.shadowRoot?.querySelector('[data-nextjs-error-overlay]') ??
        document.querySelector('[data-nextjs-dialog-overlay]') ??
        document.querySelector('[data-nextjs-error-page]') ??
        null;
      const dialogText = dialog ? (dialog.textContent ?? '').replace(/\s+/g, ' ').trim() : '';
      const bodyText = (document.body?.innerText ?? '').replace(/\s+/g, ' ').trim();
      const mainEl =
        document.querySelector('main') ?? document.querySelector('[role="main"]') ?? document.body;
      const mainText = (mainEl?.textContent ?? '').replace(/\s+/g, ' ').trim();
      const pageState = document.documentElement.getAttribute('data-page-state');
      const title = document.title.trim();
      const h1 = document.querySelector('h1')?.textContent?.trim() ?? '';
      return {
        dialogText: dialogText.slice(0, 400),
        bodyLen: bodyText.length,
        mainLen: mainText.length,
        mainText: mainText.slice(0, 400),
        bodyHead: bodyText.slice(0, 200),
        pageState,
        title,
        h1,
      };
    });

    if (report.pageState === 'error' || report.pageState === 'not-found') {
      return { ok: false, reason: `data-page-state=${report.pageState}` };
    }

    if (report.dialogText && report.dialogText.length > 0) {
      const benignWarningPatterns = [
        /SECURITY WARNING/,
        /DeprecationWarning/,
        /\[browser\] /,
        /node:\d+/,
      ];
      const isBenign = benignWarningPatterns.some(p => p.test(report.dialogText));
      if (!isBenign) {
        return {
          ok: false,
          reason: `Next.js error overlay: ${report.dialogText.slice(0, 200)}`,
        };
      }
    }
    if (/Application error|Internal Server Error|500: Internal/i.test(report.bodyHead)) {
      return { ok: false, reason: `Error page rendered: ${report.bodyHead}` };
    }
    if (
      /\b500\b/.test(report.bodyHead) &&
      /(Something went wrong|Coś poszło nie tak|Etwas ist schief|حدث خطأ)/i.test(report.bodyHead)
    ) {
      return { ok: false, reason: `error.tsx fallback rendered: ${report.bodyHead}` };
    }
    if (
      /\b404\b/.test(report.bodyHead) &&
      /(Page not found|Strona nie została|Seite nicht|الصفحة غير)/i.test(report.bodyHead)
    ) {
      return { ok: false, reason: `not-found.tsx rendered: ${report.bodyHead}` };
    }
    if (/\bnot found\b/i.test(report.h1) || /\bnot found\b/i.test(report.mainText.slice(0, 120))) {
      return {
        ok: false,
        reason: `Entity-not-found state: h1="${report.h1}" main="${report.mainText.slice(0, 100)}"`,
      };
    }
    if (report.mainLen < 40) {
      return {
        ok: false,
        reason: `Empty main region (mainLen=${report.mainLen}, title="${report.title}", bodyHead="${report.bodyHead}")`,
      };
    }
    return { ok: true };
  } catch (err) {
    return { ok: false, reason: `inspectRenderQuality threw: ${(err as Error).message}` };
  }
}

export async function inspectLayout(page: Page, viewportName: string): Promise<UiProbeFinding[]> {
  const findings: UiProbeFinding[] = [];
  try {
    const metrics = await page.evaluate(() => {
      const doc = document.documentElement;
      const overflow = doc.scrollWidth > window.innerWidth + 1;
      const main = document.querySelector('main');
      const sidebar = document.querySelector('[data-slot="sidebar-container"]');
      let overlap = false;
      if (main && sidebar) {
        const ml = main.getBoundingClientRect().left;
        const sw = sidebar.getBoundingClientRect().width;
        overlap = ml < sw - 4;
      }
      return { overflow, overlap, innerWidth: window.innerWidth, scrollWidth: doc.scrollWidth };
    });
    if (metrics.overflow && (viewportName === 'mobile' || viewportName === 'tablet')) {
      findings.push({
        cluster: 'layout',
        severity: 'blocker',
        message: `Horizontal overflow (${metrics.scrollWidth}px > ${metrics.innerWidth}px viewport)`,
      });
    } else if (metrics.overflow) {
      findings.push({
        cluster: 'layout',
        severity: 'medium',
        message: `Horizontal overflow (${metrics.scrollWidth}px > ${metrics.innerWidth}px)`,
      });
    }
    if (metrics.overlap) {
      findings.push({
        cluster: 'layout',
        severity: 'high',
        message: 'Main content overlaps sidebar width',
      });
    }
  } catch {
    /* page may be closed */
  }
  return findings;
}

export async function inspectI18n(page: Page, locale: Locale): Promise<UiProbeFinding[]> {
  const findings: UiProbeFinding[] = [];
  try {
    const report = await page.evaluate(_expectedLocale => {
      const html = document.documentElement;
      const lang = html.getAttribute('lang') ?? '';
      const dir = html.getAttribute('dir') ?? '';
      const main = document.querySelector('main');
      const mainText = (main?.innerText ?? '').slice(0, 8000);
      const keyLeak = /\b[A-Z][a-zA-Z]+\.[a-zA-Z]+\b/.test(mainText);
      return { lang, dir, keyLeak, mainText: mainText.slice(0, 200) };
    }, locale);

    if (locale === 'ar' && report.dir !== 'rtl') {
      findings.push({
        cluster: 'i18n',
        severity: 'blocker',
        message: `Expected dir=rtl for ar, got dir=${report.dir || '(none)'}`,
      });
    }
    if (locale !== 'ar' && report.dir === 'rtl') {
      findings.push({
        cluster: 'i18n',
        severity: 'medium',
        message: `Unexpected dir=rtl for locale ${locale}`,
      });
    }
    if (report.keyLeak) {
      findings.push({
        cluster: 'i18n',
        severity: 'high',
        message: 'Possible i18n key leak in main (Namespace.key pattern)',
        detail: report.mainText,
      });
    }
  } catch {
    /* ignore */
  }
  return findings;
}

export async function inspectDesignCompliance(
  page: Page,
  _route: RouteSpec,
): Promise<UiProbeFinding[]> {
  const findings: UiProbeFinding[] = [];
  try {
    const report = await page.evaluate(() => {
      const main = document.querySelector('main');
      if (!main) return { rawTable: false, oneOffButton: false };
      const rawTable =
        main.querySelector('table') !== null &&
        main.querySelector('[data-slot="atelier-table"]') === null &&
        main.querySelector('[data-component="atelier-table"]') === null;
      const oneOffButton =
        main.querySelector('button.bg-blue-600, button[class*="bg-blue-600"]') !== null;
      return { rawTable, oneOffButton };
    });
    if (report.rawTable) {
      findings.push({
        cluster: 'design-system',
        severity: 'medium',
        message: 'Raw <table> in main without Atelier table wrapper',
      });
    }
    if (report.oneOffButton) {
      findings.push({
        cluster: 'design-system',
        severity: 'low',
        message: 'One-off blue button styling detected in main',
      });
    }
  } catch {
    /* ignore */
  }
  return findings;
}

export async function maskSecrets(page: Page): Promise<void> {
  try {
    await page.addStyleTag({
      content: `
      [data-secret],
      input[type="password"],
      input[name="password"],
      input[name*="secret" i],
      input[name*="apiKey" i],
      input[name*="api_key" i],
      input[name*="token" i],
      [data-qa-mask],
      [aria-label*="api key" i],
      [aria-label*="secret" i] {
        filter: blur(8px) !important;
        background: repeating-linear-gradient(45deg, #000, #000 4px, #444 4px, #444 8px) !important;
        color: transparent !important;
      }
      [data-slot="sidebar-container"] {
        height: 100vh !important;
        min-height: 100vh !important;
      }
      nextjs-portal, [data-next-mark], [data-nextjs-dev-tools-button] {
        display: none !important;
      }
    `,
    });
  } catch {
    /* Page without head */
  }
}

export async function disableAnimations(page: Page): Promise<void> {
  try {
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.addStyleTag({
      content: `*, *::before, *::after { animation-duration: 0.01ms !important; transition-duration: 0.01ms !important; }`,
    });
  } catch {
    /* ignore */
  }
}
