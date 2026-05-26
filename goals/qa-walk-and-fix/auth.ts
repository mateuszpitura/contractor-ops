/**
 * Auth contexts + QA param resolution from seeded DB.
 */

import { createHash, randomBytes } from 'node:crypto';
import type { DataRegion } from '@contractor-ops/db';
import { getRegionalClient } from '@contractor-ops/db';
import type { Browser, BrowserContext } from 'playwright';
import type { RouteSpec } from './routes.js';
import { ROUTES } from './routes.js';

export const APP_BASE_URLS: Record<'web' | 'landing' | 'cms', string> = {
  web: process.env.QA_WALK_WEB_URL ?? 'http://localhost:3000',
  landing: process.env.QA_WALK_LANDING_URL ?? 'http://localhost:3001',
  cms: process.env.QA_WALK_CMS_URL ?? 'http://localhost:3002',
};

export const PAGE_LOAD_TIMEOUT_MS = 30_000;

function qaRegion(): DataRegion {
  return process.env.QA_DEFAULT_ORG_REGION === 'ME' ? 'ME' : 'EU';
}

function qaDb() {
  return getRegionalClient(qaRegion());
}

export async function createWalkContext(browser: Browser): Promise<BrowserContext> {
  const context = await browser.newContext();
  await context.addInitScript(() => {
    try {
      window.localStorage.setItem('cookie-consent-acknowledged', new Date().toISOString());
    } catch {
      /* ignore */
    }
  });
  return context;
}

export async function loginAdmin(browser: Browser): Promise<BrowserContext> {
  const email = process.env.QA_ADMIN_EMAIL;
  const password = process.env.QA_ADMIN_PASSWORD;
  if (!(email && password)) {
    process.stderr.write(
      '! QA_ADMIN_EMAIL / QA_ADMIN_PASSWORD not set — admin routes will appear as failed navigations.\n',
    );
    return createWalkContext(browser);
  }
  const context = await createWalkContext(browser);
  try {
    const res = await context.request.post(`${APP_BASE_URLS.web}/api/auth/sign-in/email`, {
      data: { email, password },
      headers: { 'content-type': 'application/json' },
      timeout: PAGE_LOAD_TIMEOUT_MS,
    });
    if (!res.ok()) {
      const body = await res.text();
      throw new Error(`sign-in/email returned ${res.status()}: ${body.slice(0, 200)}`);
    }
    const orgId = process.env.QA_DEFAULT_ORG_ID;
    if (orgId) {
      const activeRes = await context.request.post(
        `${APP_BASE_URLS.web}/api/auth/organization/set-active`,
        {
          data: { organizationId: orgId },
          headers: {
            'content-type': 'application/json',
            origin: APP_BASE_URLS.web,
          },
          timeout: PAGE_LOAD_TIMEOUT_MS,
        },
      );
      if (!activeRes.ok()) {
        const body = await activeRes.text();
        throw new Error(
          `organization/set-active returned ${activeRes.status()}: ${body.slice(0, 200)}`,
        );
      }
    }
    process.stdout.write(`· admin login OK\n`);
  } catch (err) {
    process.stderr.write(`! Admin login failed: ${(err as Error).message}\n`);
  }
  return context;
}

async function mintPortalRawToken(): Promise<string | null> {
  const orgId = process.env.QA_DEFAULT_ORG_ID;
  if (!orgId) return null;

  try {
    const db = qaDb();
    const contractor = await db.contractor.findFirst({
      where: { organizationId: orgId },
      select: { email: true },
    });
    if (!contractor?.email) return null;

    const raw = randomBytes(24).toString('base64url');
    const hashed = createHash('sha256').update(raw).digest('hex');
    await db.portalMagicToken.create({
      data: {
        email: contractor.email,
        token: hashed,
        expiresAt: new Date(Date.now() + 60 * 60 * 1000),
      },
    });
    return raw;
  } catch (err) {
    process.stderr.write(`! mintPortalRawToken failed: ${(err as Error).message}\n`);
    return null;
  }
}

export async function loginPortal(browser: Browser): Promise<BrowserContext> {
  const token = await mintPortalRawToken();
  if (!token) return createWalkContext(browser);
  const context = await createWalkContext(browser);
  const page = await context.newPage();
  try {
    await page.goto(
      `${APP_BASE_URLS.web}/en/portal/login/verify?token=${encodeURIComponent(token)}`,
      {
        waitUntil: 'domcontentloaded',
        timeout: PAGE_LOAD_TIMEOUT_MS,
      },
    );
    await page.waitForURL(/\/portal(?!\/login)/, {
      timeout: PAGE_LOAD_TIMEOUT_MS,
    });
  } catch (err) {
    process.stderr.write(`! Portal magic-link failed: ${(err as Error).message}\n`);
  }
  await page.close();
  return context;
}

export async function loginCmsAdmin(browser: Browser): Promise<BrowserContext> {
  const email = process.env.CMS_ADMIN_EMAIL;
  const password = process.env.CMS_ADMIN_PASSWORD;
  if (!(email && password)) return createWalkContext(browser);
  const context = await createWalkContext(browser);
  try {
    const res = await context.request.post(`${APP_BASE_URLS.cms}/api/users/login`, {
      data: { email, password },
      headers: { 'content-type': 'application/json' },
      timeout: PAGE_LOAD_TIMEOUT_MS,
    });
    if (!res.ok()) throw new Error(`/api/users/login returned ${res.status()}`);
    process.stdout.write(`· cms admin login OK\n`);
  } catch (err) {
    process.stderr.write(`! CMS admin login failed: ${(err as Error).message}\n`);
  }
  return context;
}

export async function resolveQaParams(): Promise<void> {
  const orgId = process.env.QA_DEFAULT_ORG_ID;
  if (!orgId) {
    process.stderr.write(
      '! QA_DEFAULT_ORG_ID not set — detail routes will hit NOT_FOUND placeholders.\n',
    );
    return;
  }

  let db: ReturnType<typeof qaDb>;
  try {
    db = qaDb();
  } catch (err) {
    process.stderr.write(`! Prisma unavailable: ${(err as Error).message}\n`);
    return;
  }

  const orgWhere = { organizationId: orgId };
  const idSelect = { select: { id: true } } as const;

  const contractorRes = await Promise.allSettled([
    db.contractor.findFirst({
      where: { ...orgWhere, lifecycleStage: 'ACTIVE', deletedAt: null },
      orderBy: { createdAt: 'asc' },
      ...idSelect,
    }),
    db.contractor.findFirst({ where: orgWhere, orderBy: { createdAt: 'asc' }, ...idSelect }),
  ]).then(([active, fallback]) =>
    active.status === 'fulfilled' && active.value ? active : fallback,
  );

  const [contractRes, invoiceRes, equipmentRes, workflowRunRes, workflowTemplateRes, intakeRes] =
    await Promise.allSettled([
      db.contract.findFirst({ where: orgWhere, ...idSelect }),
      db.invoice.findFirst({ where: orgWhere, ...idSelect }),
      db.equipment.findFirst({ where: orgWhere, ...idSelect }),
      db.workflowRun.findFirst({ where: orgWhere, ...idSelect }),
      db.workflowTemplate.findFirst({ where: orgWhere, ...idSelect }),
      db.invoiceIntakeRequest.findFirst({ where: orgWhere, ...idSelect }),
    ]);

  const pick = (r: PromiseSettledResult<{ id: string } | null>): string | undefined =>
    r.status === 'fulfilled' && r.value ? r.value.id : undefined;

  const contractorId = pick(contractorRes);
  let engagementId: string | undefined;
  let assessmentId: string | undefined;

  if (contractorId) {
    const engagement = await db.contractorAssignment.findFirst({
      where: { organizationId: orgId, contractorId },
      select: { id: true },
    });
    engagementId = engagement?.id;
    if (engagementId) {
      const assessment = await db.classificationAssessment.findFirst({
        where: { organizationId: orgId, contractorAssignmentId: engagementId },
        select: { id: true },
      });
      assessmentId = assessment?.id;
    }
  }

  let portalContractId: string | undefined;
  let portalInvoiceId: string | undefined;
  if (contractorId) {
    const portalContract = await db.contract.findFirst({
      where: { organizationId: orgId, contractorId },
      select: { id: true },
    });
    portalContractId = portalContract?.id;
    const portalInvoice = await db.invoice.findFirst({
      where: {
        organizationId: orgId,
        contract: { contractorId },
      },
      select: { id: true },
    });
    portalInvoiceId = portalInvoice?.id;
  }

  const ids = {
    contractor: contractorId,
    contract: pick(contractRes),
    invoice: pick(invoiceRes),
    engagement: engagementId,
    assessment: assessmentId,
    equipment: pick(equipmentRes),
    workflowRun: pick(workflowRunRes),
    workflowTemplate: pick(workflowTemplateRes),
    intake: pick(intakeRes),
    portalContract: portalContractId,
    portalInvoice: portalInvoiceId,
  };
  process.stdout.write(`qa:walk · resolved ids ${JSON.stringify(ids)}\n`);

  const routeOverrides: Record<string, Record<string, keyof typeof ids>> = {
    'web-contractor-detail': { id: 'contractor' },
    'web-contractor-classification': { id: 'contractor' },
    'web-contractor-engagement': {
      id: 'contractor',
      engagementId: 'engagement',
    },
    'web-contractor-engagement-classification': {
      id: 'contractor',
      engagementId: 'engagement',
    },
    'web-contractor-engagement-classification-detail': {
      id: 'contractor',
      engagementId: 'engagement',
      assessmentId: 'assessment',
    },
    'web-contract-detail': { id: 'contract' },
    'web-invoice-detail': { id: 'invoice' },
    'web-invoice-intake-detail': { id: 'intake' },
    'web-equipment-detail': { id: 'equipment' },
    'web-workflow-detail': { id: 'workflowRun' },
    'web-workflow-template-detail': { id: 'workflowTemplate' },
    'web-classification-expert-help': { contractorId: 'contractor' },
    'web-time-contractor': { contractorId: 'contractor' },
    'portal-contract-detail': { id: 'portalContract' },
    'portal-invoice-detail': { id: 'portalInvoice' },
  };

  for (const route of ROUTES) {
    const map = routeOverrides[route.id];
    if (!map) continue;
    const samples = { ...(route.paramSamples ?? {}) };
    for (const [paramName, idKey] of Object.entries(map)) {
      const real = ids[idKey];
      if (real) samples[paramName] = real;
    }
    (route as { paramSamples?: Record<string, string> }).paramSamples = samples;
  }
}

export async function ensureContext(
  browser: Browser,
  contexts: Partial<Record<RouteSpec['app'] | 'portal' | 'cmsAdmin', BrowserContext>>,
  routeApp: RouteSpec['app'],
  role: RouteSpec['role'],
): Promise<BrowserContext> {
  if (routeApp === 'landing') {
    contexts.landing ??= await createWalkContext(browser);
    return contexts.landing;
  }
  if (routeApp === 'cms') {
    if (role === 'cms-admin') {
      contexts.cmsAdmin ??= await loginCmsAdmin(browser);
      return contexts.cmsAdmin;
    }
    contexts.cms ??= await createWalkContext(browser);
    return contexts.cms;
  }
  if (role === 'contractor-portal') {
    contexts.portal ??= await loginPortal(browser);
    return contexts.portal;
  }
  if (role === 'anonymous') {
    contexts.web ??= await createWalkContext(browser);
    return contexts.web;
  }
  contexts.web ??= await loginAdmin(browser);
  return contexts.web;
}
