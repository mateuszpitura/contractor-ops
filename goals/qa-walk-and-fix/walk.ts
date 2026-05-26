/**
 * walk.ts — QA walk-and-fix orchestrator.
 *
 * Playwright-driven visual catalog: every route × locale × theme × viewport
 * (+ optional surfaces / walk states), flat PNG layout, manifest.json.
 *
 * Run (from repo root):
 *   pnpm qa:walk
 *   pnpm qa:walk -- --catalog --strict --run-id=fix01
 *   pnpm qa:walk -- --smoke --routes=web-contractors-list
 */

import { mkdir } from 'node:fs/promises';
import { dirname, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { AxeBuilder } from '@axe-core/playwright';
import type { BrowserContext, ConsoleMessage, Page, Request, Response } from 'playwright';
import { chromium } from 'playwright';
import { APP_BASE_URLS, ensureContext, PAGE_LOAD_TIMEOUT_MS, resolveQaParams } from './auth.js';
import type { CaptureContext } from './capture.js';
import { capturePageScreenshot, runCapturePlan } from './capture.js';
import { runChaosProbe } from './chaos.js';
import { RequestJournal } from './journal.js';
import type { ManifestShot } from './manifest.js';
import { ManifestBuilder } from './manifest.js';
import { comboKey, ShotIndexRegistry } from './paths.js';
import { runPreflight } from './preflight.js';
import type { Finding, RouteResult } from './report.js';
import { writeReports } from './report.js';
import type { Locale, RouteSpec, Theme, WalkState } from './routes.js';
import {
  countExpectedSurfaces,
  DEFAULT_STATES,
  LOCALES,
  ROUTES,
  THEMES,
  VIEWPORTS,
} from './routes.js';
import {
  disableAnimations,
  inspectDesignCompliance,
  inspectI18n,
  inspectLayout,
} from './ui-probe.js';
import { compareOrUpdateBaseline } from './visual-baseline.js';
import type { MatrixEntry } from './walk-types.js';
import { buildUrl } from './walk-types.js';

const HERE = dirname(fileURLToPath(import.meta.url));
const FINDINGS_ROOT = resolve(HERE, 'findings');
const NETWORK_IDLE_TIMEOUT_MS = 15_000;
const DATA_READY_TIMEOUT_MS = 12_000;

// ---------------------------------------------------------------------------
// CLI
// ---------------------------------------------------------------------------

export interface CliFlags {
  dryRun: boolean;
  routes: readonly string[];
  app: 'web' | 'landing' | 'cms' | null;
  locales: readonly Locale[];
  themes: readonly Theme[];
  viewportNames: readonly string[];
  chaos: boolean;
  publicApi: boolean;
  routeTimeoutMs: number;
  fullMatrix: boolean;
  failFast: boolean;
  catalog: boolean;
  smoke: boolean;
  strict: boolean;
  runId: string | null;
  skipPreflight: boolean;
  uiDeep: boolean;
  compareBaseline: boolean;
  updateBaselines: boolean;
  walkStates: boolean;
  surfacesOnly: readonly string[];
  skipPreflightAlias: boolean;
}

function parseFlags(argv: readonly string[]): CliFlags {
  // pnpm may pass a literal `--` between script path and flags
  const args = argv.filter(a => a !== '--');

  const hasCatalog = args.includes('--catalog');
  const hasSmoke = args.includes('--smoke');
  const catalog = hasCatalog || !(hasSmoke || args.includes('--no-catalog'));
  const fullMatrix =
    args.includes('--full-matrix') ||
    (catalog && !hasSmoke && !args.some(a => a.startsWith('--locales=')));

  const opts: CliFlags = {
    dryRun: false,
    routes: [],
    app: null,
    locales: (fullMatrix ? [...LOCALES] : (['en'] as Locale[])) as Locale[],
    themes: (fullMatrix ? [...THEMES] : (['light'] as Theme[])) as Theme[],
    viewportNames: (fullMatrix ? VIEWPORTS.map(v => v.name) : ['desktop']) as string[],
    chaos: false,
    publicApi: false,
    routeTimeoutMs: PAGE_LOAD_TIMEOUT_MS,
    fullMatrix,
    failFast: !catalog,
    catalog,
    smoke: hasSmoke,
    strict: args.includes('--strict'),
    runId: null,
    skipPreflight: args.includes('--skip-preflight'),
    uiDeep: args.includes('--ui-deep') || catalog,
    compareBaseline: args.includes('--compare-baseline'),
    updateBaselines: args.includes('--update-baselines'),
    walkStates: args.includes('--walk-states'),
    surfacesOnly: [],
    skipPreflightAlias: false,
  };

  for (const raw of args) {
    if (raw === '--dry-run') opts.dryRun = true;
    else if (raw === '--chaos') opts.chaos = true;
    else if (raw === '--public-api') opts.publicApi = true;
    else if (raw === '--no-fail-fast') opts.failFast = false;
    else if (raw === '--fail-fast') opts.failFast = true;
    else if (raw === '--smoke') opts.smoke = true;
    else if (raw === '--catalog') opts.catalog = true;
    else if (raw === '--no-catalog') opts.catalog = false;
    else if (raw === '--strict') opts.strict = true;
    else if (raw === '--ui-deep') opts.uiDeep = true;
    else if (raw === '--compare-baseline') opts.compareBaseline = true;
    else if (raw === '--update-baselines') opts.updateBaselines = true;
    else if (raw === '--walk-states') opts.walkStates = true;
    else if (raw === '--skip-preflight') opts.skipPreflight = true;
    else if (raw.startsWith('--run-id=')) {
      opts.runId = raw.slice('--run-id='.length) || null;
    } else if (raw.startsWith('--route=')) {
      opts.routes = raw.slice('--route='.length) ? [raw.slice('--route='.length)] : [];
    } else if (raw.startsWith('--routes=')) {
      opts.routes = raw
        .slice('--routes='.length)
        .split(',')
        .map(s => s.trim())
        .filter(Boolean);
    } else if (raw.startsWith('--app=')) {
      const value = raw.slice('--app='.length) as CliFlags['app'];
      if (value !== 'web' && value !== 'landing' && value !== 'cms') {
        throw new Error(`--app must be web|landing|cms`);
      }
      opts.app = value;
    } else if (raw.startsWith('--locales=')) {
      opts.locales = raw
        .slice('--locales='.length)
        .split(',')
        .map(s => s.trim()) as Locale[];
    } else if (raw.startsWith('--themes=')) {
      opts.themes = raw
        .slice('--themes='.length)
        .split(',')
        .map(s => s.trim()) as Theme[];
    } else if (raw.startsWith('--viewports=')) {
      opts.viewportNames = raw
        .slice('--viewports='.length)
        .split(',')
        .map(s => s.trim());
    } else if (raw.startsWith('--surfaces-only=')) {
      opts.surfacesOnly = raw
        .slice('--surfaces-only='.length)
        .split(',')
        .map(s => s.trim());
    } else if (raw.startsWith('--route-timeout=')) {
      opts.routeTimeoutMs = Number.parseInt(raw.slice('--route-timeout='.length), 10);
    } else if (raw === '--help' || raw === '-h') {
      printHelp();
      process.exit(0);
    } else if (raw.startsWith('--')) {
      throw new Error(`unknown flag: ${raw}`);
    }
  }

  if (opts.smoke) {
    opts.catalog = false;
    opts.locales = ['en'];
    opts.themes = ['light'];
    opts.viewportNames = ['desktop'];
    opts.fullMatrix = false;
  }

  return opts;
}

function printHelp(): void {
  process.stdout.write(`pnpm qa:walk — QA walk-and-fix orchestrator

Flags:
  --catalog (default)          Page + all registered surfaces from routes.ts
  --smoke                      Single combo: en/light/desktop, page only
  --dry-run                    Print matrix only
  --strict                     exit 1 on findings or incomplete coverage
  --run-id=<suffix>            findings/<date>-<suffix>/
  --skip-preflight             Skip health checks
  --route=<id>  --routes=...   Subset routes
  --app=web|landing|cms
  --locales=  --themes=  --viewports=
  --full-matrix                4×2×3 per route (default with --catalog)
  --no-fail-fast               Continue after route-level blocker
  --walk-states                Include loading/empty/error states in matrix
  --surfaces-only=modal,tab    Filter surface kinds
  --ui-deep                    layout + i18n + design-system probes
  --compare-baseline           Pixel compare vs baselines/
  --update-baselines           Write baselines on success
  --chaos                      Human-like second pass
  --public-api                 [reserved Step 10]
`);
}

function resolveOutDir(flags: CliFlags): { outDir: string; runId: string } {
  const iso = new Date().toISOString().slice(0, 10);
  const suffix = flags.runId ?? new Date().toISOString().slice(11, 19).replace(/:/g, '');
  const runId = `${iso}-${suffix}`;
  const outDir = resolve(FINDINGS_ROOT, runId);
  return { outDir, runId };
}

function buildMatrix(flags: CliFlags): readonly MatrixEntry[] {
  const routes = ROUTES.filter(r => {
    if (flags.app && r.app !== flags.app) return false;
    if (flags.routes.length > 0 && !flags.routes.includes(r.id)) return false;
    return true;
  });
  const viewports = VIEWPORTS.filter(v => flags.viewportNames.includes(v.name));
  const entries: MatrixEntry[] = [];

  for (const route of routes) {
    const localized = route.localized ?? true;
    const localesForRoute = localized ? flags.locales : (['en'] as Locale[]);
    const states: WalkState[] = flags.walkStates
      ? [...(route.states ?? DEFAULT_STATES)]
      : ['default'];
    for (const walkState of states) {
      for (const locale of localesForRoute) {
        for (const theme of flags.themes) {
          for (const viewport of viewports) {
            entries.push({ route, locale, theme, viewport, walkState });
          }
        }
      }
    }
  }
  return entries;
}

interface ProbeOutcome {
  findings: Finding[];
  routeBroken: boolean;
  shotIndexes: number[];
}

interface RunContext {
  outDir: string;
  runId: string;
  flags: CliFlags;
  registry: ShotIndexRegistry;
  manifest: ManifestBuilder;
}

function relFile(outDir: string, abs: string): string {
  return relative(outDir, abs).replace(/\\/g, '/');
}

function pushFinding(
  findings: Finding[],
  base: Omit<Finding, 'severity' | 'cluster' | 'message'> & {
    severity: Finding['severity'];
    cluster: string;
    message: string;
  },
): void {
  findings.push(base);
}

async function applyWalkState(page: Page, walkState: WalkState): Promise<void> {
  if (walkState === 'loading') {
    await page.route('**/api/trpc/**', async route => {
      await new Promise(r => setTimeout(r, 2500));
      await route.continue();
    });
  }
  if (walkState === 'error') {
    await page.route('**/api/trpc/**', route => route.abort('failed'));
  }
}

async function probeOne(
  context: BrowserContext,
  entry: MatrixEntry,
  flags: CliFlags,
  run: RunContext,
): Promise<ProbeOutcome> {
  const findings: Finding[] = [];
  const shotIndexes: number[] = [];
  const page = await context.newPage();
  const journal = new RequestJournal();
  journal.markStart();

  const consoleErrors: string[] = [];
  const unhandledRejections: string[] = [];

  page.on('console', (msg: ConsoleMessage) => {
    if (msg.type() !== 'error' && msg.type() !== 'warning') return;
    const text = msg.text();
    if (
      text.includes('Download the React DevTools') ||
      text.includes('[HMR]') ||
      text.includes('Fast Refresh') ||
      text.includes('Failed to load resource') ||
      text.includes('The width(-1) and height(-1) of chart') ||
      text.includes('Loading plugin data from') ||
      /Hydration failed|Text content does not match/i.test(text)
    ) {
      if (/Hydration failed|Text content does not match/i.test(text)) {
        pushFinding(findings, {
          severity: 'blocker',
          cluster: 'hydration',
          routeId: entry.route.id,
          locale: entry.locale,
          theme: entry.theme,
          viewport: entry.viewport.name,
          message: text.slice(0, 300),
        });
      }
      return;
    }
    consoleErrors.push(`${msg.type()}: ${text}`);
  });
  page.on('pageerror', err => unhandledRejections.push(err.message));
  page.on('requestfailed', (req: Request) => {
    journal.recordRequestFailed(req.url(), req.failure()?.errorText ?? 'failed');
  });
  page.on('response', (res: Response) => {
    const status = res.status();
    journal.recordResponse(res.url(), status, res.statusText());
    if (status < 400 || status === 401 || status === 403) return;
    const url = res.url();
    if (status === 404 && url.includes('/api/trpc/')) return;
    if (status === 415 && url.includes('/api/trpc/classification.')) return;
    if (status >= 400) {
      pushFinding(findings, {
        severity: status >= 500 ? 'high' : 'medium',
        cluster: 'network',
        routeId: entry.route.id,
        locale: entry.locale,
        theme: entry.theme,
        viewport: entry.viewport.name,
        message: `network ${status} ${res.statusText()} ${url}`,
      });
    }
  });

  const { url, missingParams } = buildUrl(entry.route, entry.locale);
  const combo = comboKey({
    routeId: entry.route.id,
    locale: entry.locale,
    viewport: entry.viewport.name,
    theme: entry.theme,
    walkState: entry.walkState,
  });
  const index = run.registry.getIndex(entry.locale, combo);
  if (!shotIndexes.includes(index)) shotIndexes.push(index);

  const captureCtx: CaptureContext = {
    outDir: run.outDir,
    locale: entry.locale,
    theme: entry.theme,
    viewport: entry.viewport.name,
    index,
    route: entry.route,
    registry: run.registry,
    walkState: entry.walkState,
    dataReadyTimeoutMs: DATA_READY_TIMEOUT_MS,
    surfacesOnly: flags.surfacesOnly.length ? flags.surfacesOnly : undefined,
    strictCapture: flags.strict || flags.catalog,
  };

  if (missingParams.length > 0) {
    pushFinding(findings, {
      severity: 'medium',
      cluster: 'route-resolution',
      routeId: entry.route.id,
      locale: entry.locale,
      theme: entry.theme,
      viewport: entry.viewport.name,
      message: `Missing param sample(s): ${missingParams.join(', ')}`,
    });
    await page.close();
    return { findings, routeBroken: true, shotIndexes };
  }

  await page.setViewportSize({ width: entry.viewport.width, height: entry.viewport.height });
  await page.emulateMedia({ colorScheme: entry.theme === 'dark' ? 'dark' : 'light' });
  await disableAnimations(page);
  await applyWalkState(page, entry.walkState);

  let loaded = false;
  let routeBroken = false;

  try {
    const response = await page.goto(url, {
      waitUntil: 'domcontentloaded',
      timeout: flags.routeTimeoutMs,
    });
    if (response) journal.recordNavigation(url, response.status());
    if (!response) {
      routeBroken = true;
      pushFinding(findings, {
        severity: 'high',
        cluster: 'navigation',
        routeId: entry.route.id,
        locale: entry.locale,
        theme: entry.theme,
        viewport: entry.viewport.name,
        message: 'Navigation returned no response',
      });
    } else if (response.status() >= 500) {
      routeBroken = true;
      pushFinding(findings, {
        severity: 'blocker',
        cluster: 'navigation',
        routeId: entry.route.id,
        locale: entry.locale,
        theme: entry.theme,
        viewport: entry.viewport.name,
        message: `HTTP ${response.status()} at ${url}`,
        detail: journal.toDetail(),
      });
    } else if (response.status() === 404) {
      routeBroken = true;
      pushFinding(findings, {
        severity: 'high',
        cluster: 'navigation',
        routeId: entry.route.id,
        locale: entry.locale,
        theme: entry.theme,
        viewport: entry.viewport.name,
        message: `404 at ${url}`,
      });
    } else {
      loaded = true;
    }

    try {
      await page.waitForLoadState('networkidle', { timeout: NETWORK_IDLE_TIMEOUT_MS });
    } catch {
      /* soft */
    }

    await page
      .getByRole('button', { name: /got it|accept all|i agree/i })
      .first()
      .click({ timeout: 1500 })
      .catch(() => {
        /* noop */
      });
    await page
      .getByRole('button', { name: /i accept the terms of service/i })
      .first()
      .click({ timeout: 1500 })
      .catch(() => {
        /* noop */
      });

    const role = entry.route.role;
    const expectsAuth =
      role === 'admin' ||
      role === 'accountant' ||
      role === 'contractor-portal' ||
      role === 'cms-admin';
    if (loaded && expectsAuth && !entry.route.pathTemplate.includes('/login')) {
      const finalUrl = page.url();
      if (/\/(login|portal\/login|admin\/login)(\/|\?|$)/.test(finalUrl)) {
        routeBroken = true;
        loaded = false;
        pushFinding(findings, {
          severity: 'blocker',
          cluster: 'auth',
          routeId: entry.route.id,
          locale: entry.locale,
          theme: entry.theme,
          viewport: entry.viewport.name,
          message: `Redirected to login (final: ${finalUrl})`,
        });
      }
    }
  } catch (err) {
    routeBroken = true;
    pushFinding(findings, {
      severity: 'blocker',
      cluster: 'navigation',
      routeId: entry.route.id,
      locale: entry.locale,
      theme: entry.theme,
      viewport: entry.viewport.name,
      message: `Navigation crashed: ${(err as Error).message}`,
    });
  }

  if (loaded) {
    const procFails = journal.findCriticalProcedureFailures(entry.route.primaryProcedures ?? []);
    for (const ev of procFails) {
      routeBroken = true;
      pushFinding(findings, {
        severity: 'blocker',
        cluster: 'server-log',
        routeId: entry.route.id,
        locale: entry.locale,
        theme: entry.theme,
        viewport: entry.viewport.name,
        message: `Critical tRPC failure: ${ev.procedure} → ${ev.status}`,
        detail: journal.toDetail(),
      });
    }

    if (flags.uiDeep) {
      for (const f of await inspectLayout(page, entry.viewport.name)) {
        pushFinding(findings, {
          ...f,
          routeId: entry.route.id,
          locale: entry.locale,
          theme: entry.theme,
          viewport: entry.viewport.name,
        });
      }
      for (const f of await inspectI18n(page, entry.locale)) {
        pushFinding(findings, {
          ...f,
          routeId: entry.route.id,
          locale: entry.locale,
          theme: entry.theme,
          viewport: entry.viewport.name,
        });
      }
      for (const f of await inspectDesignCompliance(page, entry.route)) {
        pushFinding(findings, {
          ...f,
          routeId: entry.route.id,
          locale: entry.locale,
          theme: entry.theme,
          viewport: entry.viewport.name,
        });
      }
    }

    try {
      const axe = new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag22aa']);
      if (entry.route.app === 'cms' && entry.route.role === 'cms-admin') {
        axe.exclude('.payload__app');
        axe.exclude('[class*="payload-"]');
      }
      axe.exclude('[data-base-ui-portal]');
      axe.exclude('[id^="base-ui-"]');
      const result = await axe.analyze();
      for (const violation of result.violations) {
        const severity: Finding['severity'] =
          violation.impact === 'critical'
            ? 'blocker'
            : violation.impact === 'serious'
              ? 'high'
              : violation.impact === 'moderate'
                ? 'medium'
                : 'low';
        pushFinding(findings, {
          severity,
          cluster: 'a11y',
          routeId: entry.route.id,
          locale: entry.locale,
          theme: entry.theme,
          viewport: entry.viewport.name,
          message: `${violation.id}: ${violation.help}`,
        });
      }
    } catch (err) {
      pushFinding(findings, {
        severity: 'low',
        cluster: 'a11y',
        routeId: entry.route.id,
        locale: entry.locale,
        theme: entry.theme,
        viewport: entry.viewport.name,
        message: `axe failed: ${(err as Error).message}`,
      });
    }

    const pageCapture = await capturePageScreenshot(page, captureCtx, {
      forcedWalkState: entry.walkState,
    });
    for (const cf of pageCapture.findings) {
      const sev = cf.severity;
      if (cf.cluster === 'render' || cf.cluster === 'loading') routeBroken = true;
      pushFinding(findings, {
        severity: sev,
        cluster: cf.cluster,
        routeId: entry.route.id,
        locale: entry.locale,
        theme: entry.theme,
        viewport: entry.viewport.name,
        message: cf.message,
        detail: cf.detail,
      });
    }

    const variant = entry.walkState === 'default' ? 'default' : `state-${entry.walkState}`;
    const pageStatus: ManifestShot['status'] = pageCapture.renderOk
      ? 'success'
      : pageCapture.findings.some(f => f.cluster === 'loading')
        ? 'loading'
        : 'broken';

    if (pageCapture.file) {
      const file = relFile(run.outDir, pageCapture.file);
      run.manifest.addShot({
        index,
        locale: entry.locale,
        routeId: entry.route.id,
        viewport: entry.viewport.name,
        theme: entry.theme,
        variant,
        status: pageStatus,
        file,
        findings: findings.length,
      });
      if (pageStatus === 'success' && (flags.compareBaseline || flags.updateBaselines)) {
        const vis = await compareOrUpdateBaseline(page, {
          locale: entry.locale,
          routeId: entry.route.id,
          viewport: entry.viewport.name,
          theme: entry.theme,
          screenshotPath: pageCapture.file,
          updateBaselines: flags.updateBaselines,
          compareBaseline: flags.compareBaseline,
        });
        if (!vis.matched) {
          pushFinding(findings, {
            severity: 'high',
            cluster: 'visual',
            routeId: entry.route.id,
            locale: entry.locale,
            theme: entry.theme,
            viewport: entry.viewport.name,
            message: vis.message ?? 'Baseline mismatch',
          });
        }
      }
    }

    if (flags.catalog && !flags.smoke) {
      const plan = await runCapturePlan(page, captureCtx);
      for (const cf of plan.findings) {
        pushFinding(findings, {
          severity: cf.severity,
          cluster: cf.cluster,
          routeId: entry.route.id,
          locale: entry.locale,
          theme: entry.theme,
          viewport: entry.viewport.name,
          message: cf.message,
          detail: cf.detail,
          variant: cf.variant,
        });
      }
      for (const shot of plan.shots) {
        if (!shot.file) {
          run.manifest.addShot({
            index,
            locale: entry.locale,
            routeId: entry.route.id,
            viewport: entry.viewport.name,
            theme: entry.theme,
            variant: shot.variant,
            surfaceId: shot.surfaceId,
            kind: shot.kind,
            status: shot.status,
            file: '',
            findings: shot.findingsCount,
          });
          continue;
        }
        run.manifest.addShot({
          index,
          locale: entry.locale,
          routeId: entry.route.id,
          viewport: entry.viewport.name,
          theme: entry.theme,
          variant: shot.variant,
          surfaceId: shot.surfaceId,
          kind: shot.kind,
          status: shot.status,
          file: relFile(run.outDir, shot.file),
          findings: shot.findingsCount,
        });
      }
    }
  }

  for (const msg of consoleErrors) {
    pushFinding(findings, {
      severity: 'high',
      cluster: 'console',
      routeId: entry.route.id,
      locale: entry.locale,
      theme: entry.theme,
      viewport: entry.viewport.name,
      message: msg,
    });
  }
  for (const msg of unhandledRejections) {
    pushFinding(findings, {
      severity: 'blocker',
      cluster: 'console',
      routeId: entry.route.id,
      locale: entry.locale,
      theme: entry.theme,
      viewport: entry.viewport.name,
      message: `unhandled: ${msg}`,
    });
  }

  const renderFail = findings.some(f => f.cluster === 'render' || f.cluster === 'not-found');
  if (renderFail) run.manifest.notFoundPatternCount += 1;

  const status = loaded ? (routeBroken ? 'broken' : 'ok') : 'fail';
  process.stdout.write(
    `· ${entry.route.id} ${entry.locale}/${entry.theme}/${entry.viewport.name}/${entry.walkState} ${status} findings=${findings.length}\n`,
  );

  await page.close();
  return { findings, routeBroken, shotIndexes };
}

async function main(): Promise<void> {
  const flags = parseFlags(process.argv.slice(2));
  await resolveQaParams();
  const matrix = buildMatrix(flags);
  const { outDir, runId } = resolveOutDir(flags);
  const startedAt = new Date().toISOString();

  const needsAdmin = matrix.some(
    e => e.route.role === 'admin' || e.route.role === 'accountant' || e.route.role === 'cms-admin',
  );
  const needsOrg = matrix.some(e => (e.route.requiresEntity?.length ?? 0) > 0);

  process.stdout.write(
    `qa:walk · run=${runId} · combinations=${matrix.length} · catalog=${flags.catalog} · dry-run=${flags.dryRun}\n`,
  );

  if (flags.publicApi) {
    process.stderr.write('! --public-api reserved for Step 10; ignored.\n');
  }

  if (flags.dryRun) {
    for (const e of matrix) {
      const { url } = buildUrl(e.route, e.locale);
      process.stdout.write(
        `  ${e.route.id}  ${e.locale}/${e.theme}/${e.viewport.name}/${e.walkState}  -> ${url}\n`,
      );
    }
    process.stdout.write(`total combinations: ${matrix.length}\n`);
    return;
  }

  await runPreflight({
    webUrl: APP_BASE_URLS.web,
    landingUrl: APP_BASE_URLS.landing,
    cmsUrl: APP_BASE_URLS.cms,
    needsAdmin,
    needsOrg,
    skip: flags.skipPreflight,
  });

  await mkdir(outDir, { recursive: true });

  const manifest = new ManifestBuilder();
  const expectedPerRoute = new Map<string, number>();
  for (const entry of matrix) {
    const surfaces = flags.catalog && !flags.smoke ? countExpectedSurfaces(entry.route) : 1;
    expectedPerRoute.set(entry.route.id, (expectedPerRoute.get(entry.route.id) ?? 0) + surfaces);
  }
  for (const [routeId, count] of expectedPerRoute) manifest.setExpected(routeId, count);

  const run: RunContext = {
    outDir,
    runId,
    flags,
    registry: new ShotIndexRegistry(),
    manifest,
  };

  const browser = await chromium.launch({ headless: true });
  const contexts: Partial<Record<RouteSpec['app'] | 'portal' | 'cmsAdmin', BrowserContext>> = {};
  const resultsById = new Map<string, RouteResult>();
  const brokenRoutes = new Set<string>();

  try {
    for (const entry of matrix) {
      if (flags.failFast && brokenRoutes.has(entry.route.id)) {
        process.stdout.write(`· ${entry.route.id} skipped (fail-fast)\n`);
        continue;
      }
      const ctx = await ensureContext(browser, contexts, entry.route.app, entry.route.role);
      const outcome = await probeOne(ctx, entry, flags, run);
      const slot: RouteResult = resultsById.get(entry.route.id) ?? {
        routeId: entry.route.id,
        app: entry.route.app,
        pathTemplate: entry.route.pathTemplate,
        combinations: 0,
        findings: [],
        shotIndexes: [],
      };
      slot.combinations += 1;
      slot.findings.push(...outcome.findings);
      for (const idx of outcome.shotIndexes) {
        if (!slot.shotIndexes.includes(idx)) slot.shotIndexes.push(idx);
      }
      resultsById.set(entry.route.id, slot);
      if (outcome.routeBroken) brokenRoutes.add(entry.route.id);

      if (flags.chaos) {
        const chaosFindings = await runChaosProbe(ctx, entry, flags.routeTimeoutMs);
        for (const cf of chaosFindings) {
          slot.findings.push({
            severity: cf.severity,
            cluster: cf.cluster,
            routeId: entry.route.id,
            locale: entry.locale,
            theme: entry.theme,
            viewport: entry.viewport.name,
            message: cf.message,
          });
        }
      }
    }
  } finally {
    for (const ctx of Object.values(contexts)) {
      if (ctx) await ctx.close();
    }
    await browser.close();
  }

  const finishedAt = new Date().toISOString();
  const manifestDoc = manifest.build(runId, startedAt, finishedAt);
  const totalFindings = await writeReports({
    outDir,
    runId,
    flags: flags as unknown as Record<string, unknown>,
    matrixSize: matrix.length,
    routes: [...resultsById.values()].sort((a, b) => a.routeId.localeCompare(b.routeId)),
    manifest: manifestDoc,
    startedAt,
    finishedAt,
  });

  const coverageOk = manifestDoc.coverage.missing === 0;
  if (flags.strict && (totalFindings > 0 || !coverageOk)) {
    process.stderr.write(
      `! --strict: exiting 1 (findings=${totalFindings}, coverage missing=${manifestDoc.coverage.missing})\n`,
    );
    process.exit(1);
  }
  if (totalFindings > 0) {
    process.stderr.write(
      `! Walk finished with ${totalFindings} findings (use --strict to fail CI)\n`,
    );
  }
}

main().catch(err => {
  process.stderr.write(`walk failed: ${(err as Error).stack ?? err}\n`);
  process.exit(1);
});

export { DEFAULT_STATES };
