/**
 * Surface capture — open modals/tabs/sheets and screenshot each.
 */

import { mkdir } from 'node:fs/promises';
import { dirname } from 'node:path';
import { AxeBuilder } from '@axe-core/playwright';
import type { Page } from 'playwright';
import type { ShotIndexRegistry } from './paths.js';
import { buildScreenshotPath } from './paths.js';
import type { Locale, RouteSpec, SurfaceSpec, Theme } from './routes.js';
import { expandSurfaces } from './routes.js';
import {
  inspectLoadingState,
  inspectRenderQuality,
  maskSecrets,
  waitForDataReady,
} from './ui-probe.js';

export interface CaptureContext {
  outDir: string;
  locale: Locale;
  theme: Theme;
  viewport: string;
  index: number;
  route: RouteSpec;
  registry: ShotIndexRegistry;
  walkState: string;
  dataReadyTimeoutMs: number;
  surfacesOnly?: readonly string[];
  strictCapture: boolean;
}

export interface CaptureShotResult {
  variant: string;
  surfaceId?: string;
  kind?: SurfaceSpec['kind'];
  status: 'success' | 'broken' | 'loading' | 'capture-missing';
  file: string | null;
  findingsCount: number;
}

export interface CapturePlanResult {
  shots: CaptureShotResult[];
  findings: CaptureFinding[];
}

export interface CaptureFinding {
  severity: 'blocker' | 'high' | 'medium' | 'low';
  cluster: string;
  message: string;
  detail?: string;
  variant?: string;
}

function variantSlug(surface: SurfaceSpec): string {
  if (surface.trigger.startsWith('tab:')) {
    return `tab-${surface.trigger.slice('tab:'.length)}`;
  }
  return `${surface.kind}-${surface.id}`;
}

function screenshotFile(ctx: CaptureContext, variant: string | undefined): string {
  return buildScreenshotPath(ctx.outDir, ctx.locale, ctx.index, {
    routeId: ctx.route.id,
    viewport: ctx.viewport,
    theme: ctx.theme,
    variant: variant && variant !== 'default' ? variant : undefined,
  });
}

async function writeScreenshot(page: Page, file: string): Promise<void> {
  await mkdir(dirname(file), { recursive: true });
  await page.screenshot({ path: file, fullPage: true });
}

function escapeRegex(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function labelPattern(label: string): RegExp {
  return new RegExp(escapeRegex(label.trim()).slice(0, 48), 'i');
}

/** Strip ?tab= so the next surface starts from the base contractor profile page. */
async function resetToBasePage(page: Page): Promise<void> {
  const url = new URL(page.url());
  if (!url.searchParams.has('tab')) return;
  url.searchParams.delete('tab');
  await page.goto(url.toString(), { waitUntil: 'domcontentloaded', timeout: 15_000 }).catch(() => {
    /* noop */
  });
}

async function openSurface(page: Page, surface: SurfaceSpec): Promise<boolean> {
  const trigger = surface.trigger.trim();

  if (trigger.startsWith('keyboard:')) {
    const key = trigger.slice('keyboard:'.length);
    const mod =
      key.toLowerCase().includes('meta') && process.platform === 'darwin' ? 'Meta' : 'Control';
    await page.keyboard.press(`${mod}+KeyK`);
    await page.waitForTimeout(500);
    return true;
  }

  if (trigger.startsWith('after-tab:')) {
    const rest = trigger.slice('after-tab:'.length);
    const sep = rest.indexOf(':');
    if (sep < 0) return false;
    const tab = rest.slice(0, sep);
    const label = rest.slice(sep + 1).trim();
    if (!(tab && label)) return false;
    try {
      const url = new URL(page.url());
      url.searchParams.set('tab', tab);
      await page.goto(url.toString(), { waitUntil: 'domcontentloaded', timeout: 15_000 });
      await waitForDataReady(page, 15_000);
      await page
        .locator('[role="tabpanel"]')
        .getByRole('button', { name: labelPattern(label) })
        .filter({ visible: true })
        .first()
        .click({ timeout: 4000 });
      await page.waitForTimeout(300);
      return true;
    } catch {
      return false;
    }
  }

  if (trigger.startsWith('tab:')) {
    const tab = trigger.slice('tab:'.length);
    const url = new URL(page.url());
    url.searchParams.set('tab', tab);
    await page.goto(url.toString(), { waitUntil: 'domcontentloaded', timeout: 15_000 });
    await waitForDataReady(page, 15_000);
    return true;
  }

  if (trigger.startsWith('menu:')) {
    const item = trigger.slice('menu:'.length).trim();
    try {
      await page
        .getByRole('button', { name: /more actions/i })
        .first()
        .click({ timeout: 3000 });
      if (item === 'open' || item === '') {
        await page.waitForTimeout(300);
        return true;
      }
      await page
        .getByRole('menuitem', { name: labelPattern(item) })
        .first()
        .click({ timeout: 3000 });
      await page.waitForTimeout(300);
      return true;
    } catch {
      return false;
    }
  }

  if (trigger.startsWith('row:')) {
    const [, indexStr, action] = trigger.split(':');
    const rowIndex = Number.parseInt(indexStr ?? '0', 10);
    const actionLabel = (action ?? '').trim();
    if (!actionLabel) return false;
    try {
      const row = page.locator('tbody tr').nth(rowIndex);
      await row
        .getByRole('button', { name: labelPattern(actionLabel) })
        .first()
        .click({ timeout: 4000 });
      await page.waitForTimeout(300);
      return true;
    } catch {
      return false;
    }
  }

  if (trigger.startsWith('icon:')) {
    const icon = trigger.slice('icon:'.length);
    try {
      if (icon === 'column-toggle') {
        await page
          .locator('button:has(.lucide-sliders-horizontal)')
          .first()
          .click({ timeout: 3000 });
      } else {
        return false;
      }
      await page.waitForTimeout(300);
      return true;
    } catch {
      return false;
    }
  }

  if (trigger.startsWith('profile:')) {
    const label = trigger.slice('profile:'.length).trim();
    if (!label) return false;
    const pattern = labelPattern(label);
    try {
      const inHeader = page
        .locator('h1')
        .first()
        .locator('xpath=ancestor::*[contains(@class,"justify-between")]');
      const scoped = inHeader.getByRole('button', { name: pattern }).filter({ visible: true });
      if ((await scoped.count()) > 0) {
        await scoped.first().click({ timeout: 4000 });
      } else {
        await page
          .getByRole('button', { name: pattern })
          .filter({ visible: true })
          .filter({ has: page.locator('.lucide-play') })
          .first()
          .click({ timeout: 4000 });
      }
      await page.waitForTimeout(300);
      return true;
    } catch {
      return false;
    }
  }

  if (trigger.startsWith('popover:')) {
    const label = trigger.slice('popover:'.length).trim();
    try {
      await page
        .getByRole('button', { name: labelPattern(label) })
        .first()
        .click({ timeout: 3000 });
      await page.waitForTimeout(300);
      return true;
    } catch {
      return false;
    }
  }

  const roleMap: Record<SurfaceSpec['kind'], 'button' | 'tab' | 'link'> = {
    modal: 'button',
    tab: 'tab',
    sheet: 'button',
    dropdown: 'button',
    popover: 'button',
    panel: 'button',
  };
  const role = roleMap[surface.kind];
  const label = trigger.replace(/^["']|["']$/g, '').trim();
  if (!label) return false;
  const pattern = labelPattern(label);
  try {
    await page
      .getByRole(role, { name: pattern })
      .filter({ visible: true })
      .first()
      .click({ timeout: 4000 });
    await page.waitForTimeout(300);
    return true;
  } catch {
    try {
      await page.getByText(pattern).filter({ visible: true }).first().click({ timeout: 2500 });
      return true;
    } catch {
      return false;
    }
  }
}

async function waitForSurfaceOpen(page: Page, surface: SurfaceSpec): Promise<void> {
  if (surface.trigger.startsWith('tab:') || surface.kind === 'tab') {
    const _tabId = surface.trigger.startsWith('tab:')
      ? surface.trigger.slice('tab:'.length)
      : surface.id;
    await page
      .locator(`[role="tabpanel"][data-state="active"], [role="tab"][data-state="active"]`)
      .first()
      .waitFor({ state: 'visible', timeout: 8000 })
      .catch(() => {
        /* noop */
      });
    await waitForDataReady(page, 12_000);
    return;
  }
  if (surface.kind === 'popover' || surface.trigger.startsWith('popover:')) {
    await page
      .locator('[data-state="open"]')
      .first()
      .waitFor({ state: 'visible', timeout: 5000 })
      .catch(() => {
        /* noop */
      });
    return;
  }
  await page
    .locator('[role="dialog"], [role="alertdialog"], [data-state="open"]')
    .first()
    .waitFor({ state: 'visible', timeout: 6000 })
    .catch(() => {
      /* noop */
    });
}

async function closeSurface(page: Page, surface: SurfaceSpec): Promise<void> {
  if (surface.trigger.startsWith('after-tab:')) {
    await page.keyboard.press('Escape');
    await page.waitForTimeout(250);
    await resetToBasePage(page);
    await waitForDataReady(page, 10_000);
    return;
  }
  if (surface.trigger.startsWith('tab:') || surface.kind === 'tab') {
    await resetToBasePage(page);
    await waitForDataReady(page, 10_000);
    return;
  }
  await page.keyboard.press('Escape');
  await page.waitForTimeout(250);
  if (surface.trigger.startsWith('popover:') || surface.kind === 'popover') {
    await page.keyboard.press('Escape');
  }
}

async function axeOnDialog(page: Page): Promise<CaptureFinding[]> {
  const findings: CaptureFinding[] = [];
  try {
    const result = await new AxeBuilder({ page })
      .include('[role="dialog"]')
      .withTags(['wcag2a', 'wcag2aa'])
      .analyze();
    for (const v of result.violations.slice(0, 5)) {
      findings.push({
        cluster: 'a11y',
        severity: v.impact === 'critical' ? 'blocker' : 'high',
        message: `${v.id} (dialog): ${v.help}`,
      });
    }
  } catch {
    /* best-effort */
  }
  return findings;
}

export async function capturePageScreenshot(
  page: Page,
  ctx: CaptureContext,
  opts: { forcedWalkState?: string },
): Promise<{ file: string | null; findings: CaptureFinding[]; renderOk: boolean }> {
  const findings: CaptureFinding[] = [];
  const timeout = ctx.route.dataReadyTimeoutMs ?? ctx.dataReadyTimeoutMs;
  await waitForDataReady(page, timeout);

  if (opts.forcedWalkState !== 'loading') {
    const loading = await inspectLoadingState(page);
    if (!loading.ok) {
      findings.push({
        cluster: 'loading',
        severity: 'blocker',
        message: `Skeleton/loading UI still visible (${loading.selectors.join(', ')})`,
      });
      await maskSecrets(page);
      const file = screenshotFile(ctx, 'loading');
      await writeScreenshot(page, file);
      return { file, findings, renderOk: false };
    }
  }

  await maskSecrets(page);
  const quality = await inspectRenderQuality(page);
  if (!quality.ok) {
    findings.push({
      cluster: 'render',
      severity: 'blocker',
      message: `Render quality failed: ${quality.reason ?? 'unknown'}`,
    });
    const file = screenshotFile(ctx, 'broken');
    await writeScreenshot(page, file);
    return { file, findings, renderOk: false };
  }

  const file = screenshotFile(ctx, 'default');
  await writeScreenshot(page, file);
  return { file, findings, renderOk: true };
}

export async function runCapturePlan(page: Page, ctx: CaptureContext): Promise<CapturePlanResult> {
  const shots: CaptureShotResult[] = [];
  const findings: CaptureFinding[] = [];
  const surfaces = expandSurfaces(ctx.route).filter(s => {
    if (!ctx.surfacesOnly?.length) return true;
    return ctx.surfacesOnly.includes(s.kind);
  });

  for (const surface of surfaces) {
    const opened = await openSurface(page, surface);
    if (!opened) {
      findings.push({
        cluster: 'capture',
        severity: ctx.strictCapture ? 'high' : 'medium',
        message: `capture-missing: could not open surface ${surface.kind}/${surface.id}`,
        detail: `trigger="${surface.trigger}"`,
        variant: variantSlug(surface),
      });
      shots.push({
        variant: variantSlug(surface),
        surfaceId: surface.id,
        kind: surface.kind,
        status: 'capture-missing',
        file: null,
        findingsCount: 1,
      });
      continue;
    }
    await waitForSurfaceOpen(page, surface);
    if (surface.id === 'add-contract-wizard') {
      await waitForDataReady(page, 15_000);
    }
    const subFindings = await axeOnDialog(page);
    findings.push(...subFindings);
    const loading = await inspectLoadingState(page);
    const quality = await inspectRenderQuality(page);
    let status: CaptureShotResult['status'] = 'success';
    if (!loading.ok) status = 'loading';
    else if (!quality.ok) status = 'broken';
    await maskSecrets(page);
    const variant = variantSlug(surface);
    const fileVariant = status === 'success' ? variant : status;
    const file = screenshotFile(ctx, fileVariant);
    await writeScreenshot(page, file);
    shots.push({
      variant,
      surfaceId: surface.id,
      kind: surface.kind,
      status,
      file: status === 'success' ? file : null,
      findingsCount: subFindings.length,
    });
    await closeSurface(page, surface);
    await page.waitForTimeout(200);
  }

  return { shots, findings };
}
