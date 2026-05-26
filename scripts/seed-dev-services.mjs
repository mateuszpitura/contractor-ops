#!/usr/bin/env node
/**
 * scripts/seed-dev-services.mjs — bootstrap local Unleash + check Infisical.
 *
 * Idempotent: re-running is safe; existing flags are skipped (not overwritten).
 * What it does:
 *   1. Auth against Unleash admin API (admin/unleash4all by default) → session token
 *   2. Create every flag from `packages/feature-flags/src/registry.ts` if missing
 *   3. Print copy-paste env block + Infisical setup guidance
 *
 * Usage:
 *   node scripts/seed-dev-services.mjs
 *   UNLEASH_URL=http://localhost:4242 UNLEASH_ADMIN_USERNAME=admin \
 *     UNLEASH_ADMIN_PASSWORD=unleash4all node scripts/seed-dev-services.mjs
 *
 * Env (with defaults):
 *   UNLEASH_URL            http://localhost:4242
 *   UNLEASH_ADMIN_USERNAME admin
 *   UNLEASH_ADMIN_PASSWORD unleash4all
 *   UNLEASH_PROJECT        default
 *   UNLEASH_ENVIRONMENT    development
 *   INFISICAL_URL          http://localhost:8090
 */

import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const _root = resolve(here, '..');

const UNLEASH_URL = (process.env.UNLEASH_URL ?? 'http://localhost:4242').replace(/\/$/, '');
const UNLEASH_USERNAME = process.env.UNLEASH_ADMIN_USERNAME ?? 'admin';
const UNLEASH_PASSWORD = process.env.UNLEASH_ADMIN_PASSWORD ?? 'unleash4all';
const UNLEASH_PROJECT = process.env.UNLEASH_PROJECT ?? 'default';
const UNLEASH_ENVIRONMENT = process.env.UNLEASH_ENVIRONMENT ?? 'development';
const INFISICAL_URL = (process.env.INFISICAL_URL ?? 'http://localhost:8090').replace(/\/$/, '');

const COLOR = process.stdout.isTTY
  ? {
      reset: '\x1b[0m',
      bold: '\x1b[1m',
      dim: '\x1b[2m',
      green: '\x1b[32m',
      yellow: '\x1b[33m',
      red: '\x1b[31m',
      cyan: '\x1b[36m',
    }
  : Object.fromEntries(
      ['reset', 'bold', 'dim', 'green', 'yellow', 'red', 'cyan'].map(k => [k, '']),
    );

const info = msg => console.log(`${COLOR.cyan}→${COLOR.reset} ${msg}`);
const ok = msg => console.log(`${COLOR.green}✓${COLOR.reset} ${msg}`);
const warn = msg => console.log(`${COLOR.yellow}⚠${COLOR.reset}  ${msg}`);
const err = msg => console.error(`${COLOR.red}✗${COLOR.reset} ${msg}`);
const header = msg => console.log(`\n${COLOR.bold}${msg}${COLOR.reset}`);

// ---------------------------------------------------------------------------
// Feature flag definitions — kept in sync manually with
// packages/feature-flags/src/registry.ts. The registry is TypeScript so we
// can't `import` it directly from a .mjs script without a build step; the
// list below mirrors FLAGS shape so we can POST to Unleash admin API.
// ---------------------------------------------------------------------------

const FLAGS = [
  {
    key: 'module.legal-approval',
    description: 'Legal approval workflow for contracts (in development — ship dark).',
    type: 'release',
    enabledByDefault: false,
  },
  {
    key: 'module.classification-engine',
    description: 'Employment-status classification engine (contractor vs employee).',
    type: 'release',
    enabledByDefault: false,
  },
  {
    key: 'integration.gulf-payments',
    description: 'Gulf-only payment rails (Mashreq, ENBD). Structurally invisible to EU orgs.',
    type: 'release',
    enabledByDefault: false,
  },
  {
    key: 'integration.sepa-instant',
    description: 'EU SEPA Instant Credit Transfer payment rail. Invisible to ME orgs.',
    type: 'release',
    enabledByDefault: false,
  },
  {
    key: 'killswitch.ai-invoice-parser',
    description: 'Emergency disable for AI invoice parsing (Claude Vision). killWhenUnknown=true.',
    type: 'kill-switch',
    enabledByDefault: true,
  },
  {
    key: 'payments.bacs-enabled',
    description: 'BACS Standard 18 Direct Credit export for UK GBP payments',
    type: 'release',
    enabledByDefault: false,
  },
  {
    key: 'payments.late-interest-enabled',
    description: 'UK Late Payment of Commercial Debts (Interest) Act 1998 enforcement',
    type: 'release',
    enabledByDefault: false,
  },
  {
    key: 'payments.skonto-enabled',
    description: 'DE Skonto (early-payment discount) calculation + applicaiton',
    type: 'release',
    enabledByDefault: false,
  },
  {
    key: 'einvoice.import-enabled',
    description: 'E-invoice (PEPPOL / KSeF) inbound import',
    type: 'release',
    enabledByDefault: false,
  },
];

// ---------------------------------------------------------------------------
// Unleash admin API helpers
// ---------------------------------------------------------------------------

async function unleashLogin() {
  // Unleash 5+ exposes /auth/simple/login for username/password sessions. The
  // response sets a session cookie we can re-use for subsequent admin calls.
  const res = await fetch(`${UNLEASH_URL}/auth/simple/login`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ username: UNLEASH_USERNAME, password: UNLEASH_PASSWORD }),
  });
  if (!res.ok) {
    throw new Error(`Unleash login failed: ${res.status} ${await res.text().catch(() => '')}`);
  }
  const setCookie = res.headers.get('set-cookie');
  if (!setCookie) throw new Error('Unleash login: no session cookie in response');
  const cookie = setCookie.split(';')[0]; // "unleash-session=...; Path=/; ..."
  return cookie;
}

async function unleashListFlags(cookie) {
  const res = await fetch(`${UNLEASH_URL}/api/admin/projects/${UNLEASH_PROJECT}/features`, {
    headers: { cookie },
  });
  if (!res.ok) {
    throw new Error(`Unleash listFlags failed: ${res.status} ${await res.text().catch(() => '')}`);
  }
  const body = await res.json();
  return new Set((body.features ?? []).map(f => f.name));
}

async function unleashCreateFlag(cookie, flag) {
  const res = await fetch(`${UNLEASH_URL}/api/admin/projects/${UNLEASH_PROJECT}/features`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', cookie },
    body: JSON.stringify({
      name: flag.key,
      description: flag.description,
      type: flag.type === 'kill-switch' ? 'kill-switch' : 'release',
      impressionData: false,
    }),
  });
  if (!res.ok) {
    throw new Error(
      `Unleash createFlag(${flag.key}) failed: ${res.status} ${await res.text().catch(() => '')}`,
    );
  }
}

async function unleashEnableFlag(cookie, flagKey) {
  const res = await fetch(
    `${UNLEASH_URL}/api/admin/projects/${UNLEASH_PROJECT}/features/${flagKey}/environments/${UNLEASH_ENVIRONMENT}/on`,
    { method: 'POST', headers: { cookie } },
  );
  if (!res.ok) {
    // Non-fatal: a flag without strategies will simply remain disabled in this env.
    warn(
      `couldn't enable ${flagKey} in env "${UNLEASH_ENVIRONMENT}" — likely needs a strategy first (${res.status})`,
    );
  }
}

async function unleashCreateServerToken(cookie) {
  // Idempotent-ish: API rejects duplicate names with 409. We catch and re-use.
  const tokenName = `seed-dev-${UNLEASH_ENVIRONMENT}`;
  const res = await fetch(`${UNLEASH_URL}/api/admin/api-tokens`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', cookie },
    body: JSON.stringify({
      tokenName,
      type: 'client', // server-side SDK token
      project: UNLEASH_PROJECT,
      environment: UNLEASH_ENVIRONMENT,
    }),
  });
  if (res.status === 409) {
    // Token already exists; look it up.
    const listRes = await fetch(`${UNLEASH_URL}/api/admin/api-tokens`, { headers: { cookie } });
    const body = await listRes.json();
    const existing = (body.tokens ?? []).find(t => t.tokenName === tokenName);
    return existing?.secret ?? null;
  }
  if (!res.ok) {
    warn(
      `couldn't create API token: ${res.status} — create one manually in UI: ${UNLEASH_URL}/admin/api/create-token`,
    );
    return null;
  }
  const body = await res.json();
  return body.secret;
}

// ---------------------------------------------------------------------------
// Infisical reachability probe (just connectivity check + guidance)
// ---------------------------------------------------------------------------

async function probeInfisical() {
  try {
    const res = await fetch(`${INFISICAL_URL}/api/status`, {
      signal: AbortSignal.timeout(3000),
    });
    return res.ok;
  } catch {
    return false;
  }
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main() {
  header('1. Seeding Unleash feature flags');
  info(`URL: ${UNLEASH_URL}`);
  info(`Project: ${UNLEASH_PROJECT} · Environment: ${UNLEASH_ENVIRONMENT}`);

  let cookie;
  try {
    cookie = await unleashLogin();
    ok('logged in as admin');
  } catch (e) {
    err(
      `Unleash login failed — is the container running? (docker compose --profile unleash up -d)`,
    );
    err(String(e.message ?? e));
    process.exit(1);
  }

  let existing;
  try {
    existing = await unleashListFlags(cookie);
  } catch (e) {
    err(String(e.message ?? e));
    process.exit(1);
  }

  let created = 0;
  let skipped = 0;
  for (const flag of FLAGS) {
    if (existing.has(flag.key)) {
      skipped += 1;
      continue;
    }
    try {
      await unleashCreateFlag(cookie, flag);
      if (flag.enabledByDefault) {
        await unleashEnableFlag(cookie, flag.key);
      }
      ok(`created ${flag.key}${flag.enabledByDefault ? ' (enabled)' : ''}`);
      created += 1;
    } catch (e) {
      err(`failed to create ${flag.key}: ${String(e.message ?? e)}`);
    }
  }
  info(`${created} created, ${skipped} already present`);

  header('2. Generating server-side API token');
  const token = await unleashCreateServerToken(cookie);
  if (token) {
    ok('API token ready');
    console.log(`\n${COLOR.bold}Add to .env:${COLOR.reset}`);
    console.log(`${COLOR.dim}UNLEASH_URL_EU=${UNLEASH_URL}/api/`);
    console.log(`UNLEASH_API_TOKEN_EU=${token}`);
    console.log(`UNLEASH_URL_ME=${UNLEASH_URL}/api/`);
    console.log(`UNLEASH_API_TOKEN_ME=${token}${COLOR.reset}`);
  }

  header('3. Infisical');
  const infisicalUp = await probeInfisical();
  if (infisicalUp) {
    ok(`Infisical reachable at ${INFISICAL_URL}`);
    console.log(`
Infisical needs manual setup (machine-identity-based; no admin password API):

  1. Open ${COLOR.cyan}${INFISICAL_URL}${COLOR.reset} → create account / log in
  2. Create a Project (e.g. "contractor-ops-dev") — copy its Project ID
  3. ${COLOR.bold}Organization Settings → Access Control → Identities → Create${COLOR.reset}
     Name: "seed-dev"; auth method: ${COLOR.bold}Universal Auth${COLOR.reset}
     Save the Client ID + Client Secret (the secret is shown ONCE)
  4. ${COLOR.bold}Project → Access Control → Identities → Add${COLOR.reset}
     Pick "seed-dev", role: admin (or scoped — at least secrets:read/write)
  5. Add these to .env:
       INFISICAL_SITE_URL=${INFISICAL_URL}
       INFISICAL_CLIENT_ID=<client id from step 3>
       INFISICAL_CLIENT_SECRET=<client secret from step 3>
       INFISICAL_PROJECT_ID=<project id from step 2>
       INFISICAL_ENVIRONMENT=development

What to store in Infisical (only if you test these flows):

  ${COLOR.dim}# ZATCA (Saudi e-invoicing) — per organization${COLOR.reset}
  /org/<orgId>/zatca/X509_CERTIFICATE
  /org/<orgId>/zatca/PRIVATE_KEY
  /org/<orgId>/zatca/API_SECRET
  /org/<orgId>/zatca/COMPLIANCE_REQUEST_ID

  ${COLOR.dim}# HMRC (UK VAT) — global${COLOR.reset}
  hmrc/client_id
  hmrc/client_secret
`);
  } else {
    warn(
      `Infisical not reachable at ${INFISICAL_URL} — start with: docker compose --profile infisical up -d`,
    );
  }

  header('Done. Restart pnpm dev to pick up the new env values.');
}

main().catch(e => {
  err(`fatal: ${e.message ?? e}`);
  process.exit(1);
});
