/**
 * walk.ts — QA walk-and-fix orchestrator (v1).
 *
 * Drives Playwright across every route × locale × theme × viewport in the
 * registry exported by `routes.ts`, captures findings (console errors,
 * unhandled rejections, network 4xx/5xx, asset 404s, axe-core a11y
 * violations), saves a success screenshot for each combination, and writes
 * a dated `findings/<iso-date>/REPORT.md` + per-route Markdown sheets +
 * `findings.json` index.
 *
 * Scope of v1 (this file):
 *   - Default-state walk per route × locale × theme × viewport
 *   - Console / network / unhandled-rejection capture
 *   - axe-core scan per page
 *   - Secret redaction at the DOM-region level before screenshotting
 *
 * Out of scope for v1 (later steps in the plan):
 *   - Modal / sheet / popover walking (relies on `routes.ts` ModalSpec —
 *     wired through the loop but the trigger discovery is best-effort and
 *     non-failing for now)
 *   - Forced loading + forced error states (Playwright route interception)
 *   - Chaos pass (`--chaos`) — Step 9
 *   - Public-API parity (`--public-api`) — Step 10
 *
 * Run (from repo root):
 *   pnpm qa:walk                                  # full matrix
 *   pnpm qa:walk -- --dry-run                     # print matrix only
 *   pnpm qa:walk -- --route=web-contractors-list  # single route
 *   pnpm qa:walk -- --app=landing                 # one app
 *   pnpm qa:walk -- --locales=en,ar               # subset locales
 *   pnpm qa:walk -- --themes=dark                 # one theme
 *   pnpm qa:walk -- --viewports=desktop           # one viewport
 */

import { mkdir, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { AxeBuilder } from '@axe-core/playwright';
import type { Browser, BrowserContext, ConsoleMessage, Page, Request, Response } from 'playwright';
import { chromium } from 'playwright';
import type { Locale, RouteSpec, Theme, ViewportSpec } from './routes.js';
import { DEFAULT_STATES, LOCALES, ROUTES, THEMES, VIEWPORTS } from './routes.js';

// ---------------------------------------------------------------------------
// Paths + config
// ---------------------------------------------------------------------------

const HERE = dirname(fileURLToPath(import.meta.url));
const FINDINGS_ROOT = resolve(HERE, 'findings');
const ISO_DATE = new Date().toISOString().slice(0, 10);
const OUT_DIR = resolve(FINDINGS_ROOT, ISO_DATE);
const SCREENSHOTS_DIR = resolve(OUT_DIR, 'screenshots');
const REPORTS_DIR = resolve(OUT_DIR, 'routes');

const APP_BASE_URLS: Record<'web' | 'landing' | 'cms', string> = {
  web: process.env.QA_WALK_WEB_URL ?? 'http://localhost:3000',
  landing: process.env.QA_WALK_LANDING_URL ?? 'http://localhost:3001',
  cms: process.env.QA_WALK_CMS_URL ?? 'http://localhost:3002',
};

const PAGE_LOAD_TIMEOUT_MS = 30_000;
const NETWORK_IDLE_TIMEOUT_MS = 15_000;

// ---------------------------------------------------------------------------
// CLI
// ---------------------------------------------------------------------------

interface CliFlags {
  dryRun: boolean;
  routes: readonly string[]; // empty = all
  app: 'web' | 'landing' | 'cms' | null;
  locales: readonly Locale[];
  themes: readonly Theme[];
  viewportNames: readonly string[];
  chaos: boolean;
  publicApi: boolean;
  /** Per (route × locale × theme × viewport) budget — overrides default. */
  routeTimeoutMs: number;
}

function parseFlags(argv: readonly string[]): CliFlags {
  const opts = {
    dryRun: false,
    routes: [] as string[],
    app: null as CliFlags['app'],
    locales: [...LOCALES] as Locale[],
    themes: [...THEMES] as Theme[],
    viewportNames: VIEWPORTS.map(v => v.name) as string[],
    chaos: false,
    publicApi: false,
    routeTimeoutMs: PAGE_LOAD_TIMEOUT_MS,
  };

  for (const raw of argv) {
    if (raw === '--') continue; // pnpm pass-through separator
    if (raw === '--dry-run') opts.dryRun = true;
    else if (raw === '--chaos') opts.chaos = true;
    else if (raw === '--public-api') opts.publicApi = true;
    else if (raw.startsWith('--route=')) {
      const value = raw.slice('--route='.length);
      opts.routes = value ? [value] : [];
    } else if (raw.startsWith('--routes=')) {
      opts.routes = raw
        .slice('--routes='.length)
        .split(',')
        .map(s => s.trim())
        .filter(Boolean);
    } else if (raw.startsWith('--app=')) {
      const value = raw.slice('--app='.length) as CliFlags['app'];
      if (value !== 'web' && value !== 'landing' && value !== 'cms') {
        throw new Error(`--app must be one of web|landing|cms (got "${value}")`);
      }
      opts.app = value;
    } else if (raw.startsWith('--locales=')) {
      const values = raw
        .slice('--locales='.length)
        .split(',')
        .map(s => s.trim())
        .filter(Boolean) as Locale[];
      const allowed = new Set<Locale>(LOCALES);
      for (const v of values) {
        if (!allowed.has(v)) throw new Error(`--locales: unknown locale "${v}"`);
      }
      opts.locales = values;
    } else if (raw.startsWith('--themes=')) {
      const values = raw
        .slice('--themes='.length)
        .split(',')
        .map(s => s.trim())
        .filter(Boolean) as Theme[];
      const allowed = new Set<Theme>(THEMES);
      for (const v of values) {
        if (!allowed.has(v)) throw new Error(`--themes: unknown theme "${v}"`);
      }
      opts.themes = values;
    } else if (raw.startsWith('--viewports=')) {
      opts.viewportNames = raw
        .slice('--viewports='.length)
        .split(',')
        .map(s => s.trim())
        .filter(Boolean);
      const allowed = new Set<string>(VIEWPORTS.map(v => v.name));
      for (const v of opts.viewportNames) {
        if (!allowed.has(v)) throw new Error(`--viewports: unknown viewport "${v}"`);
      }
    } else if (raw.startsWith('--route-timeout=')) {
      const n = Number.parseInt(raw.slice('--route-timeout='.length), 10);
      if (!Number.isFinite(n) || n <= 0) {
        throw new Error('--route-timeout must be a positive integer (ms)');
      }
      opts.routeTimeoutMs = n;
    } else if (raw === '--help' || raw === '-h') {
      printHelp();
      process.exit(0);
    } else if (raw.startsWith('--')) {
      throw new Error(`unknown flag: ${raw}`);
    }
  }
  return opts;
}

function printHelp(): void {
  process.stdout.write(`pnpm qa:walk — QA walk-and-fix orchestrator

Flags:
  --dry-run                    Print the matrix without opening a browser
  --route=<id>                 Run only the route with this id
  --routes=<id,id,...>         Run only these routes
  --app=web|landing|cms        Restrict to one app
  --locales=en,pl,de,ar        Restrict to subset
  --themes=light,dark          Restrict to subset
  --viewports=mobile,tablet,desktop
                               Restrict to subset
  --route-timeout=<ms>         Per-combination timeout (default 30000)
  --chaos                      [Step 9] Run the chaos / act-as-human pass
  --public-api                 [Step 10] Run the public-API parity check
  --help                       Show this message
`);
}

// ---------------------------------------------------------------------------
// Matrix expansion
// ---------------------------------------------------------------------------

interface MatrixEntry {
  route: RouteSpec;
  locale: Locale;
  theme: Theme;
  viewport: ViewportSpec;
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
    const localesForRoute = localized ? flags.locales : ['en' as Locale];
    for (const locale of localesForRoute) {
      for (const theme of flags.themes) {
        for (const viewport of viewports) {
          entries.push({ route, locale, theme, viewport });
        }
      }
    }
  }
  return entries;
}

// ---------------------------------------------------------------------------
// Finding model
// ---------------------------------------------------------------------------

type Severity = 'blocker' | 'high' | 'medium' | 'low';

interface Finding {
  severity: Severity;
  cluster: string;
  routeId: string;
  locale: Locale;
  theme: Theme;
  viewport: string;
  message: string;
  detail?: string;
}

interface RouteResult {
  routeId: string;
  app: 'web' | 'landing' | 'cms';
  pathTemplate: string;
  combinations: number;
  findings: Finding[];
  screenshots: string[];
}

// ---------------------------------------------------------------------------
// URL builder
// ---------------------------------------------------------------------------

/** Replace `[param]` placeholders with paramSamples (env-overridable) and
 * prefix `/[locale]/...` paths with the active locale. Falls back to the
 * raw template when a param is missing — the orchestrator logs a finding
 * for that combination instead of crashing. */
function buildUrl(route: RouteSpec, locale: Locale): { url: string; missingParams: string[] } {
  const base = APP_BASE_URLS[route.app];
  const localized = route.localized ?? true;
  const samples = route.paramSamples ?? {};

  let path = route.pathTemplate;
  const missingParams: string[] = [];
  const paramRe = /\[([^\]]+)\]/g;
  path = path.replace(paramRe, (_match, name: string) => {
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

// ---------------------------------------------------------------------------
// Secret redaction
// ---------------------------------------------------------------------------

/** Hide DOM regions that may contain secrets before screenshotting. */
async function maskSecrets(page: Page): Promise<void> {
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
        background: repeating-linear-gradient(
          45deg,
          #000,
          #000 4px,
          #444 4px,
          #444 8px
        ) !important;
        color: transparent !important;
        text-shadow: none !important;
      }
    `,
  });
}

// ---------------------------------------------------------------------------
// Per-combination probe
// ---------------------------------------------------------------------------

interface ProbeOutcome {
  findings: Finding[];
  screenshotPath: string | null;
}

async function probeOne(
  context: BrowserContext,
  entry: MatrixEntry,
  flags: CliFlags,
): Promise<ProbeOutcome> {
  const findings: Finding[] = [];
  const page = await context.newPage();
  const consoleErrors: string[] = [];
  const unhandledRejections: string[] = [];
  const failedRequests: { url: string; status: number; statusText: string }[] = [];

  page.on('console', (msg: ConsoleMessage) => {
    if (msg.type() === 'error' || msg.type() === 'warning') {
      const text = msg.text();
      // Filter known framework HMR / dev-only noise so the report focuses on
      // app-code regressions. Tune the allowlist as patterns surface.
      if (
        text.includes('Download the React DevTools') ||
        text.includes('[HMR]') ||
        text.includes('Fast Refresh')
      ) {
        return;
      }
      consoleErrors.push(`${msg.type()}: ${text}`);
    }
  });
  page.on('pageerror', err => {
    unhandledRejections.push(err.message);
  });
  page.on('requestfailed', (req: Request) => {
    failedRequests.push({
      url: req.url(),
      status: 0,
      statusText: req.failure()?.errorText ?? 'requestfailed',
    });
  });
  page.on('response', (res: Response) => {
    const status = res.status();
    if (status >= 400 && status !== 401 && status !== 403) {
      // 401/403 on unauthenticated probes are expected — every other 4xx /
      // 5xx is a finding.
      failedRequests.push({
        url: res.url(),
        status,
        statusText: res.statusText(),
      });
    }
  });

  const { url, missingParams } = buildUrl(entry.route, entry.locale);
  const combinationLabel = `${entry.locale}/${entry.theme}/${entry.viewport.name}`;

  if (missingParams.length > 0) {
    findings.push({
      severity: 'medium',
      cluster: 'route-resolution',
      routeId: entry.route.id,
      locale: entry.locale,
      theme: entry.theme,
      viewport: entry.viewport.name,
      message: `Missing param sample(s): ${missingParams.join(', ')}`,
      detail: `Set QA_PARAM_${missingParams[0]!.toUpperCase()} or extend routes.ts paramSamples.`,
    });
    await page.close();
    return { findings, screenshotPath: null };
  }

  await page.setViewportSize({ width: entry.viewport.width, height: entry.viewport.height });
  if (entry.theme === 'dark') {
    await page.emulateMedia({ colorScheme: 'dark' });
  } else {
    await page.emulateMedia({ colorScheme: 'light' });
  }

  let loaded = false;
  try {
    const response = await page.goto(url, {
      waitUntil: 'domcontentloaded',
      timeout: flags.routeTimeoutMs,
    });
    if (!response) {
      findings.push({
        severity: 'high',
        cluster: 'navigation',
        routeId: entry.route.id,
        locale: entry.locale,
        theme: entry.theme,
        viewport: entry.viewport.name,
        message: `Navigation returned no response`,
      });
    } else if (response.status() >= 500) {
      findings.push({
        severity: 'blocker',
        cluster: 'navigation',
        routeId: entry.route.id,
        locale: entry.locale,
        theme: entry.theme,
        viewport: entry.viewport.name,
        message: `HTTP ${response.status()} ${response.statusText()} at ${url}`,
      });
    } else if (response.status() === 404) {
      findings.push({
        severity: 'high',
        cluster: 'navigation',
        routeId: entry.route.id,
        locale: entry.locale,
        theme: entry.theme,
        viewport: entry.viewport.name,
        message: `404 Not Found at ${url}`,
      });
    } else {
      loaded = true;
    }
    // Best-effort wait for network-idle. Pages that keep a persistent SSE
    // / websocket open will hit this timeout — treat as a soft signal, not
    // a hard finding.
    try {
      await page.waitForLoadState('networkidle', { timeout: NETWORK_IDLE_TIMEOUT_MS });
    } catch {
      // ignored — quiescence is best-effort
    }
  } catch (err) {
    findings.push({
      severity: 'blocker',
      cluster: 'navigation',
      routeId: entry.route.id,
      locale: entry.locale,
      theme: entry.theme,
      viewport: entry.viewport.name,
      message: `Navigation crashed: ${(err as Error).message}`,
    });
  }

  // axe-core scan (best-effort — failures are logged, not thrown)
  if (loaded) {
    try {
      const axe = new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag22aa']);
      const result = await axe.analyze();
      for (const violation of result.violations) {
        const severity: Severity =
          violation.impact === 'critical'
            ? 'blocker'
            : violation.impact === 'serious'
              ? 'high'
              : violation.impact === 'moderate'
                ? 'medium'
                : 'low';
        // Capture up to 3 failing node selectors + failure summary per
        // violation so the fix loop can target specific elements without
        // re-running axe by hand.
        const sampledNodes = violation.nodes.slice(0, 3).map(n => {
          const selector = Array.isArray(n.target) ? n.target.join(' > ') : String(n.target);
          const summary = n.failureSummary?.replace(/\s+/g, ' ').trim() ?? '';
          return summary ? `${selector} — ${summary}` : selector;
        });
        findings.push({
          severity,
          cluster: 'a11y',
          routeId: entry.route.id,
          locale: entry.locale,
          theme: entry.theme,
          viewport: entry.viewport.name,
          message: `${violation.id}: ${violation.help}`,
          detail: `${violation.helpUrl}\n${sampledNodes.join('\n')}`,
        });
      }
    } catch (err) {
      findings.push({
        severity: 'low',
        cluster: 'a11y',
        routeId: entry.route.id,
        locale: entry.locale,
        theme: entry.theme,
        viewport: entry.viewport.name,
        message: `axe-core scan failed: ${(err as Error).message}`,
      });
    }
  }

  for (const msg of consoleErrors) {
    findings.push({
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
    findings.push({
      severity: 'blocker',
      cluster: 'console',
      routeId: entry.route.id,
      locale: entry.locale,
      theme: entry.theme,
      viewport: entry.viewport.name,
      message: `unhandled: ${msg}`,
    });
  }
  for (const fr of failedRequests) {
    findings.push({
      severity: fr.status >= 500 || fr.status === 0 ? 'high' : 'medium',
      cluster: 'network',
      routeId: entry.route.id,
      locale: entry.locale,
      theme: entry.theme,
      viewport: entry.viewport.name,
      message: `network ${fr.status || 'failed'} ${fr.statusText} ${fr.url}`,
    });
  }

  let screenshotPath: string | null = null;
  if (loaded) {
    await maskSecrets(page);
    const dir = resolve(
      SCREENSHOTS_DIR,
      entry.route.app,
      entry.route.id,
      entry.locale,
      entry.theme,
    );
    await mkdir(dir, { recursive: true });
    const file = resolve(dir, `${entry.viewport.name}.png`);
    await page.screenshot({ path: file, fullPage: true });
    screenshotPath = file;
  }

  process.stdout.write(
    `· ${entry.route.id} ${combinationLabel} ${loaded ? 'ok' : 'fail'} findings=${findings.length}\n`,
  );

  await page.close();
  return { findings, screenshotPath };
}

// ---------------------------------------------------------------------------
// Report writer
// ---------------------------------------------------------------------------

interface ReportData {
  iso: string;
  flags: CliFlags;
  matrixSize: number;
  routes: RouteResult[];
  startedAt: string;
  finishedAt: string;
}

async function writeReports(data: ReportData): Promise<void> {
  await mkdir(REPORTS_DIR, { recursive: true });

  // JSON index
  const jsonPath = resolve(OUT_DIR, 'findings.json');
  await writeFile(jsonPath, JSON.stringify(data, null, 2), 'utf8');

  // Per-route Markdown sheets
  for (const result of data.routes) {
    const sheetPath = resolve(REPORTS_DIR, `${result.routeId}.md`);
    const lines = [
      `# ${result.routeId}`,
      ``,
      `**App:** ${result.app}`,
      `**Path:** \`${result.pathTemplate}\``,
      `**Combinations walked:** ${result.combinations}`,
      `**Findings:** ${result.findings.length}`,
      ``,
      `## Screenshots`,
      ``,
      ...result.screenshots.map(p => `- \`${p.replace(OUT_DIR + '/', '')}\``),
      ``,
      `## Findings`,
      ``,
    ];
    if (result.findings.length === 0) {
      lines.push('_None._');
    } else {
      lines.push('| severity | cluster | locale | theme | viewport | message |');
      lines.push('| --- | --- | --- | --- | --- | --- |');
      for (const f of result.findings) {
        lines.push(
          `| ${f.severity} | ${f.cluster} | ${f.locale} | ${f.theme} | ${f.viewport} | ${f.message.replace(/\|/g, '\\|')} |`,
        );
      }
    }
    await writeFile(sheetPath, lines.join('\n'), 'utf8');
  }

  // Top-level REPORT.md
  const reportPath = resolve(OUT_DIR, 'REPORT.md');
  const totalFindings = data.routes.reduce((acc, r) => acc + r.findings.length, 0);
  const byCluster = new Map<string, number>();
  const bySeverity = new Map<Severity, number>();
  for (const r of data.routes) {
    for (const f of r.findings) {
      byCluster.set(f.cluster, (byCluster.get(f.cluster) ?? 0) + 1);
      bySeverity.set(f.severity, (bySeverity.get(f.severity) ?? 0) + 1);
    }
  }
  const clusterRows = [...byCluster.entries()]
    .sort((a, b) => b[1] - a[1])
    .map(([cluster, n]) => `| ${cluster} | ${n} |`)
    .join('\n');
  const severityRows = (['blocker', 'high', 'medium', 'low'] as Severity[])
    .map(s => `| ${s} | ${bySeverity.get(s) ?? 0} |`)
    .join('\n');

  const reportLines = [
    `# QA walk-and-fix — ${data.iso}`,
    ``,
    `- **Started:** ${data.startedAt}`,
    `- **Finished:** ${data.finishedAt}`,
    `- **Routes walked:** ${data.routes.length}`,
    `- **Combinations:** ${data.matrixSize}`,
    `- **Findings:** ${totalFindings}`,
    ``,
    `## By severity`,
    ``,
    `| severity | count |`,
    `| --- | --- |`,
    severityRows,
    ``,
    `## By cluster`,
    ``,
    `| cluster | count |`,
    `| --- | --- |`,
    clusterRows || '| _none_ | 0 |',
    ``,
    `## Per-route sheets`,
    ``,
    ...data.routes.map(
      r =>
        `- [${r.routeId}](./routes/${r.routeId}.md) — ${r.findings.length} findings, ${r.screenshots.length} screenshots`,
    ),
    ``,
  ];
  await writeFile(reportPath, reportLines.join('\n'), 'utf8');

  process.stdout.write(`\nReport written to ${reportPath}\n`);
  process.stdout.write(`Findings: ${totalFindings}\n`);
}

// ---------------------------------------------------------------------------
// Auth setup — admin (Better Auth credential)
// ---------------------------------------------------------------------------

/** Log in once via Better Auth's credential endpoint and return a
 * BrowserContext whose cookies carry the resulting session. Skips gracefully
 * (returns a fresh anonymous context) when QA_ADMIN_* env vars are unset so
 * `--dry-run` and landing-only runs don't need a live DB. */
async function loginAdmin(browser: Browser): Promise<BrowserContext> {
  const email = process.env.QA_ADMIN_EMAIL;
  const password = process.env.QA_ADMIN_PASSWORD;
  if (!(email && password)) {
    process.stderr.write(
      '! QA_ADMIN_EMAIL / QA_ADMIN_PASSWORD not set — admin routes will appear as failed navigations.\n',
    );
    return browser.newContext();
  }
  const context = await browser.newContext();
  const page = await context.newPage();
  await page.goto(`${APP_BASE_URLS.web}/en/login`, {
    waitUntil: 'domcontentloaded',
    timeout: PAGE_LOAD_TIMEOUT_MS,
  });

  // Better Auth's standard credential form has [name=email] + [name=password]
  // plus a submit button. If the form has changed, the walk will surface the
  // login failure as a finding on the first authenticated route.
  try {
    await page.locator('input[name="email"], input[type="email"]').first().fill(email);
    await page.locator('input[name="password"], input[type="password"]').first().fill(password);
    await page.locator('button[type="submit"]').first().click();
    await page.waitForURL(/\/(dashboard|en|pl|de|ar)(\/|$)/, {
      timeout: PAGE_LOAD_TIMEOUT_MS,
    });
  } catch (err) {
    process.stderr.write(
      `! Admin login failed: ${(err as Error).message}. Admin routes will surface findings.\n`,
    );
  }
  await page.close();
  return context;
}

async function loginPortal(browser: Browser): Promise<BrowserContext> {
  const token = process.env.QA_CONTRACTOR_PORTAL_TOKEN;
  if (!token) {
    process.stderr.write(
      '! QA_CONTRACTOR_PORTAL_TOKEN not set — portal routes will redirect to /portal/login.\n',
    );
    return browser.newContext();
  }
  const context = await browser.newContext();
  const page = await context.newPage();
  try {
    await page.goto(
      `${APP_BASE_URLS.web}/en/portal/login/verify?token=${encodeURIComponent(token)}`,
      {
        waitUntil: 'domcontentloaded',
        timeout: PAGE_LOAD_TIMEOUT_MS,
      },
    );
    await page.waitForURL(/\/portal(?!\/login)/, { timeout: PAGE_LOAD_TIMEOUT_MS });
  } catch (err) {
    process.stderr.write(
      `! Portal magic-link trade failed: ${(err as Error).message}. Portal routes will surface findings.\n`,
    );
  }
  await page.close();
  return context;
}

async function loginCmsAdmin(browser: Browser): Promise<BrowserContext> {
  const email = process.env.CMS_ADMIN_EMAIL;
  const password = process.env.CMS_ADMIN_PASSWORD;
  if (!(email && password)) {
    process.stderr.write(
      '! CMS_ADMIN_EMAIL / CMS_ADMIN_PASSWORD not set — CMS admin routes will be blocked at /admin/login.\n',
    );
    return browser.newContext();
  }
  const context = await browser.newContext();
  const page = await context.newPage();
  try {
    await page.goto(`${APP_BASE_URLS.cms}/admin/login`, {
      waitUntil: 'domcontentloaded',
      timeout: PAGE_LOAD_TIMEOUT_MS,
    });
    await page.locator('input[name="email"], input[type="email"]').first().fill(email);
    await page.locator('input[name="password"], input[type="password"]').first().fill(password);
    await page.locator('button[type="submit"]').first().click();
    await page.waitForURL(/\/admin(?!\/login)/, { timeout: PAGE_LOAD_TIMEOUT_MS });
  } catch (err) {
    process.stderr.write(
      `! CMS admin login failed: ${(err as Error).message}. CMS admin routes will surface findings.\n`,
    );
  }
  await page.close();
  return context;
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main(): Promise<void> {
  const flags = parseFlags(process.argv.slice(2));
  const matrix = buildMatrix(flags);
  const startedAt = new Date().toISOString();

  process.stdout.write(
    `qa:walk · ISO=${ISO_DATE} · combinations=${matrix.length} · dry-run=${flags.dryRun}\n`,
  );

  if (flags.chaos) {
    process.stderr.write('! --chaos is reserved for Step 9 of the plan; ignored for now.\n');
  }
  if (flags.publicApi) {
    process.stderr.write('! --public-api is reserved for Step 10 of the plan; ignored for now.\n');
  }

  if (flags.dryRun) {
    for (const e of matrix) {
      const { url } = buildUrl(e.route, e.locale);
      process.stdout.write(
        `  ${e.route.id}  ${e.locale}/${e.theme}/${e.viewport.name}  -> ${url}\n`,
      );
    }
    process.stdout.write(`total combinations: ${matrix.length}\n`);
    return;
  }

  await mkdir(OUT_DIR, { recursive: true });

  const browser = await chromium.launch({ headless: true });
  const contexts: Partial<Record<RouteSpec['app'] | 'portal', BrowserContext>> = {};
  // apps/web has two distinct auth realms: dashboard (Better Auth) and
  // portal (PortalMagicToken). We track them separately.
  // landing is anonymous.
  // cms uses its own Payload admin auth.

  const ensureContext = async (
    routeApp: RouteSpec['app'],
    role: RouteSpec['role'],
  ): Promise<BrowserContext> => {
    if (routeApp === 'landing') {
      contexts.landing ??= await browser.newContext();
      return contexts.landing;
    }
    if (routeApp === 'cms') {
      if (role === 'cms-admin') {
        contexts.cms ??= await loginCmsAdmin(browser);
        return contexts.cms;
      }
      contexts.cms ??= await browser.newContext();
      return contexts.cms;
    }
    // web
    if (role === 'contractor-portal') {
      contexts.portal ??= await loginPortal(browser);
      return contexts.portal;
    }
    if (role === 'anonymous') {
      contexts.web ??= await browser.newContext();
      return contexts.web;
    }
    // admin / accountant share a Better Auth context. v1 logs in as admin
    // only; accountant flows are gated behind the admin context for now.
    contexts.web ??= await loginAdmin(browser);
    return contexts.web;
  };

  const resultsById = new Map<string, RouteResult>();

  try {
    for (const entry of matrix) {
      const ctx = await ensureContext(entry.route.app, entry.route.role);
      const outcome = await probeOne(ctx, entry, flags);
      const existing = resultsById.get(entry.route.id);
      const slot: RouteResult = existing ?? {
        routeId: entry.route.id,
        app: entry.route.app,
        pathTemplate: entry.route.pathTemplate,
        combinations: 0,
        findings: [],
        screenshots: [],
      };
      slot.combinations += 1;
      slot.findings.push(...outcome.findings);
      if (outcome.screenshotPath) slot.screenshots.push(outcome.screenshotPath);
      resultsById.set(entry.route.id, slot);
    }
  } finally {
    for (const ctx of Object.values(contexts)) {
      if (ctx) await ctx.close();
    }
    await browser.close();
  }

  const finishedAt = new Date().toISOString();
  await writeReports({
    iso: ISO_DATE,
    flags,
    matrixSize: matrix.length,
    routes: [...resultsById.values()].sort((a, b) => a.routeId.localeCompare(b.routeId)),
    startedAt,
    finishedAt,
  });
}

main().catch(err => {
  process.stderr.write(`walk failed: ${(err as Error).stack ?? err}\n`);
  process.exit(1);
});

// Surface DEFAULT_STATES so future code that needs the canonical state list
// (chaos pass + per-state forced loading/error) doesn't have to reach into
// routes.ts directly.
export { DEFAULT_STATES };
