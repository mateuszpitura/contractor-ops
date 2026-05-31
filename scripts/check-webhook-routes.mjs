#!/usr/bin/env node
/**
 * CI gate — webhook / external-callback route contract guard (RISK-ROUTE-001).
 *
 * The post-migration service split (Next.js monolith → Fastify `apps/api` +
 * Hono `apps/public-api`) dropped the `/api/*` prefix on most mounts. Every
 * externally-published callback URL (Stripe, Storecove, InPost, Payload CMS,
 * QStash, OAuth IdPs) is registered with a literal path in source. If any of
 * those paths silently changes, the external publisher keeps POSTing the old
 * URL and deliveries fail — the failure surfaces only in production, as a
 * regulatory / billing / shipment gap.
 *
 * This guard freezes the set of route paths declared across the two HTTP
 * apps. Any added / removed / renamed path fails CI until the maintainer:
 *   1. updates EXPECTED_ROUTES below (with provider + publisher + signature),
 *   2. AND, for an EXTERNALLY-published route, re-registers the new URL with
 *      the provider (or adds a reverse-proxy alias) before cutover.
 *
 * It also asserts every `external` route file references a signature /
 * authn mechanism, so a new webhook can't ship unauthenticated.
 *
 * Bootstrap / re-snapshot: run `node scripts/check-webhook-routes.mjs --print`
 * to dump the discovered routes as a paste-ready block.
 *
 * Mirrors the static-scan style of the other `check:*` guards (no app boot,
 * no DB, deterministic) so it runs inside `pnpm lint:ci`.
 */

import { readdirSync, readFileSync } from 'node:fs';
import { join, relative } from 'node:path';

const REPO_ROOT = new URL('..', import.meta.url).pathname;
const SCAN_ROOTS = [
  'apps/api/src/routes',
  'apps/api/src/server.ts',
  'apps/public-api/src/routes',
];

// ---------------------------------------------------------------------------
// publisher = who calls this URL:
//   external — a third party we do NOT control (Stripe/Storecove/InPost/IdP/
//              Payload CMS). URL drift breaks live delivery → cutover-blocking.
//   qstash   — our own QStash schedules/callbacks. We control the publisher,
//              so drift is self-correcting on redeploy, but still snapshotted.
//   internal — same-origin SPA/server callers.
//
// signature = the authn mechanism the route file must reference (asserted for
//             `external` + `qstash`; informational for `internal`).
// ---------------------------------------------------------------------------

/**
 * @typedef {{ provider: string, publisher: 'external'|'qstash'|'internal',
 *             signature: string, note?: string }} RouteMeta
 */

/** @type {Record<string, RouteMeta>} */
const EXPECTED_ROUTES = {
  // --- External publishers (third parties we do NOT control) -------------
  // URL drift here breaks live delivery → cutover-blocking. Re-register the
  // new URL with the provider before changing any of these paths.
  'POST /webhooks/stripe': { provider: 'stripe', publisher: 'external', signature: 'constructEvent' },
  'POST /webhooks/storecove': {
    provider: 'storecove',
    publisher: 'external',
    signature: 'parseWebhookPayload',
  },
  'POST /webhooks/inpost': {
    provider: 'inpost',
    publisher: 'external',
    signature: 'verifyInPostSignature',
  },
  'POST /webhooks/:provider': {
    provider: 'slack/resend/linear/jira/notion/docusign/autenti',
    publisher: 'external',
    signature: 'verifyWebhookSignature',
  },
  'POST /revalidate-legal': {
    provider: 'payload-cms',
    publisher: 'external',
    signature: 'CMS_WEBHOOK_SECRET',
  },
  'POST /teams/messages': { provider: 'teams', publisher: 'external', signature: 'bot-framework-jwt' },
  'GET /api/oauth/:provider/start': {
    provider: 'idp-oauth',
    publisher: 'external',
    signature: 'verifyOAuthState',
  },
  'GET /api/oauth/:provider/callback': {
    provider: 'idp-oauth',
    publisher: 'external',
    signature: 'verifyOAuthState',
  },

  // --- QStash callbacks (we control the publisher) -----------------------
  // Drift is self-correcting on redeploy, but snapshotted so an accidental
  // rename is still surfaced.
  'POST /webhooks/_process': { provider: 'qstash', publisher: 'qstash', signature: 'guardQStashRequest' },
  'POST /zatca/_submit': { provider: 'qstash', publisher: 'qstash', signature: 'guardQStashRequest' },
  'POST /peppol/poll': { provider: 'qstash', publisher: 'qstash', signature: 'guardQStashRequest' },
  'POST /peppol/inbound': { provider: 'qstash', publisher: 'qstash', signature: 'guardQStashRequest' },
  'POST /peppol/outbound': { provider: 'qstash', publisher: 'qstash', signature: 'guardQStashRequest' },
  'POST /ksef/_sync': { provider: 'qstash', publisher: 'qstash', signature: 'guardQStashRequest' },
  'POST /outbox/_drain': { provider: 'qstash', publisher: 'qstash', signature: 'guardQStashRequest' },
  'POST /ocr/_process': { provider: 'qstash', publisher: 'qstash', signature: 'guardQStashRequest' },
  'POST /exports/_process': { provider: 'qstash', publisher: 'qstash', signature: 'guardQStashRequest' },
  'POST /google-workspace/_sync': {
    provider: 'qstash',
    publisher: 'qstash',
    signature: 'guardQStashRequest',
  },
  'POST /late-interest/_render-claim-pdf': {
    provider: 'qstash',
    publisher: 'qstash',
    signature: 'guardQStashRequest',
  },
  // Phase 75 D-01 — contract health-check QStash callback.
  'POST /contract-health/_run': {
    provider: 'qstash',
    publisher: 'qstash',
    signature: 'guardQStashRequest',
  },

  // --- Internal (same-origin SPA / browser beacons) ----------------------
  // Authn is session/CSRF or none-by-design (public report sinks). No
  // upstream signature requirement.
  'GET /health': { provider: 'self', publisher: 'internal', signature: 'none', note: 'liveness probe' },
  'GET /ready': { provider: 'self', publisher: 'internal', signature: 'none', note: 'readiness probe' },
  'POST /csp-report': {
    provider: 'browser',
    publisher: 'internal',
    signature: 'none',
    note: 'public CSP violation sink',
  },
  'POST /web-vitals': {
    provider: 'browser',
    publisher: 'internal',
    signature: 'none',
    note: 'RUM beacon',
  },
  'GET /exports/:exportId/download': {
    provider: 'spa',
    publisher: 'internal',
    signature: 'none',
    note: 'session-authenticated download',
  },
  'POST /portal/set-session': {
    provider: 'spa',
    publisher: 'internal',
    signature: 'none',
    note: 'CSRF-guarded session bridge',
  },
  'POST /portal/clear-session': {
    provider: 'spa',
    publisher: 'internal',
    signature: 'none',
    note: 'CSRF-guarded session bridge',
  },
};

// Tokens that count as a signature / authn reference inside a route file.
const SIGNATURE_TOKENS = [
  'constructEvent', // Stripe SDK HMAC
  'verifyInPostSignature',
  'verifyOAuthState',
  'consumeOAuthChallenge',
  'guardQStashRequest', // QStash Receiver HMAC
  'verifyWebhookSignature',
  'parseWebhookPayload', // adapter-level signature parse (storecove/multi-provider)
  'verifySignature',
  'timingSafeEqual',
  'createHmac',
  'CMS_WEBHOOK_SECRET', // Payload CMS revalidate HMAC
  'STORECOVE_WEBHOOK_SECRET',
  'authorizeJWT', // Teams Bot Framework JWT
  'CloudAdapter', // Teams Bot Framework adapter (owns JWT validation)
  'BotFrameworkAuthentication',
  'svix',
  'X-Hub-Signature',
  'x-hub-signature',
];

const METHOD_PATH_RE =
  /\bapp\.(get|post|put|patch|delete)\b[\s\S]{0,800}?(['"`])(\/[^'"`]*)\2/g;

/** @returns {string[]} list of .ts files under a root (file or dir) */
function collectFiles(rootRel) {
  const abs = join(REPO_ROOT, rootRel);
  /** @type {string[]} */
  const out = [];
  /** @param {string} p */
  const walk = p => {
    let entries;
    try {
      entries = readdirSync(p, { withFileTypes: true });
    } catch {
      // `p` is a file, not a dir.
      out.push(p);
      return;
    }
    for (const e of entries) {
      const full = join(p, e.name);
      if (e.isDirectory()) {
        walk(full);
        continue;
      }
      if (!e.name.endsWith('.ts')) continue;
      if (full.includes('/__tests__/') || full.endsWith('.test.ts')) continue;
      out.push(full);
    }
  };
  walk(abs);
  return out;
}

/** @returns {{ key: string, method: string, path: string, file: string }[]} */
function discoverRoutes() {
  /** @type {{ key: string, method: string, path: string, file: string }[]} */
  const routes = [];
  const seen = new Set();
  for (const root of SCAN_ROOTS) {
    for (const file of collectFiles(root)) {
      const rel = relative(REPO_ROOT, file).replaceAll('\\', '/');
      const text = readFileSync(file, 'utf8');
      for (const m of text.matchAll(METHOD_PATH_RE)) {
        const method = m[1].toUpperCase();
        const path = m[3];
        const key = `${method} ${path}`;
        if (seen.has(key)) continue;
        seen.add(key);
        routes.push({ key, method, path, file: rel });
      }
    }
  }
  routes.sort((a, b) => a.key.localeCompare(b.key));
  return routes;
}

function fileReferencesSignature(fileRel) {
  const text = readFileSync(join(REPO_ROOT, fileRel), 'utf8');
  return SIGNATURE_TOKENS.some(tok => text.includes(tok));
}

// ---------------------------------------------------------------------------
// Run
// ---------------------------------------------------------------------------

const actual = discoverRoutes();
const printMode = process.argv.includes('--print');

if (printMode) {
  console.log('// Paste into EXPECTED_ROUTES (set provider/publisher/signature):');
  console.log('const EXPECTED_ROUTES = {');
  for (const r of actual) {
    console.log(
      `  '${r.key}': { provider: 'TODO', publisher: 'TODO', signature: 'TODO' }, // ${r.file}`,
    );
  }
  console.log('};');
  process.exit(0);
}

const expectedKeys = new Set(Object.keys(EXPECTED_ROUTES));

if (expectedKeys.size === 0) {
  console.error(
    'check:webhook-routes — BOOTSTRAP: EXPECTED_ROUTES is empty.\n' +
      `Discovered ${actual.length} route(s). Run:\n` +
      '  node scripts/check-webhook-routes.mjs --print\n' +
      'and paste the output into EXPECTED_ROUTES, classifying each route.',
  );
  process.exit(1);
}

const actualKeys = new Set(actual.map(r => r.key));
const actualByKey = new Map(actual.map(r => [r.key, r]));

/** @type {string[]} */
const added = [...actualKeys].filter(k => !expectedKeys.has(k)).sort();
/** @type {string[]} */
const removed = [...expectedKeys].filter(k => !actualKeys.has(k)).sort();

/** @type {string[]} */
const unsigned = [];
for (const [key, meta] of Object.entries(EXPECTED_ROUTES)) {
  if (meta.publisher === 'internal') continue;
  const r = actualByKey.get(key);
  if (!r) continue; // reported as removed
  if (!fileReferencesSignature(r.file)) {
    unsigned.push(`${key}  (${meta.provider}, ${r.file})`);
  }
}

const problems = added.length + removed.length + unsigned.length;
if (problems === 0) {
  console.log(`check:webhook-routes — OK (${actual.length} routes match contract)`);
  process.exit(0);
}

console.error(`check:webhook-routes — ${problems} contract violation(s):\n`);
if (added.length > 0) {
  console.error('NEW route(s) not in the contract — add to EXPECTED_ROUTES and,');
  console.error('if externally published, register the URL with the provider:');
  for (const k of added) console.error(`  + ${k}   (${actualByKey.get(k)?.file})`);
  console.error('');
}
if (removed.length > 0) {
  console.error('REMOVED/RENAMED route(s) in the contract — an external publisher may');
  console.error('still POST the old URL. Confirm intentional, then update EXPECTED_ROUTES:');
  for (const k of removed) console.error(`  - ${k}   (was: ${EXPECTED_ROUTES[k].provider})`);
  console.error('');
}
if (unsigned.length > 0) {
  console.error('Route(s) with NO signature/authn reference in their file:');
  for (const u of unsigned) console.error(`  ! ${u}`);
  console.error(`  (expected one of: ${SIGNATURE_TOKENS.join(', ')})`);
  console.error('');
}
process.exit(1);
