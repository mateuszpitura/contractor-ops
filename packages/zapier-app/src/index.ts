// The Contractor Ops Zapier app definition.
//
// Everything the app exposes is derived from the OpenAPI snapshot (write
// actions) and the webhook event catalog (triggers) via
// `@contractor-ops/marketplace-manifests`. Nothing here is hand-authored per
// platform, so the app cannot drift from the API surface. While the snapshot's
// write routes are hidden (pre-flip) the app ships its triggers with zero
// actions; the actions appear automatically once the snapshot exposes writes.

import { existsSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import type { OpenApiSnapshot } from '@contractor-ops/marketplace-manifests';
import { generateZapier, serverUrl } from '@contractor-ops/marketplace-manifests';
import { WEBHOOK_EVENT_TYPES } from '@contractor-ops/validators';
import { defineApp, version as platformVersion } from 'zapier-platform-core';

import { addApiKeyHeader, buildAuthentication } from './authentication.js';
import { buildCreates } from './creates/index.js';
import { buildTriggers } from './triggers/index.js';

const REPO_ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..', '..');
const SNAPSHOT_PATH = join(REPO_ROOT, 'apps/public-api/openapi.snapshot.json');

/** An empty spec yields triggers-only (zero actions) — the pre-snapshot posture. */
export const EMPTY_SPEC: OpenApiSnapshot = {
  openapi: '3.1.0',
  info: { title: 'Contractor Ops Enterprise API', version: '0.0.0' },
  paths: {},
};

/** Read the committed OpenAPI snapshot; fall back to the empty spec when absent. */
export function loadSnapshot(): OpenApiSnapshot {
  if (!existsSync(SNAPSHOT_PATH)) return EMPTY_SPEC;
  return JSON.parse(readFileSync(SNAPSHOT_PATH, 'utf8')) as OpenApiSnapshot;
}

/** Assemble the full app definition from a snapshot + the event catalog. */
export function buildZapierApp(spec: OpenApiSnapshot) {
  const generated = generateZapier(spec, [...WEBHOOK_EVENT_TYPES]);
  const baseUrl = serverUrl(spec);

  return defineApp({
    version: '1.0.0',
    platformVersion,
    authentication: buildAuthentication(generated.authentication),
    beforeRequest: [addApiKeyHeader],
    triggers: buildTriggers(generated.triggers, baseUrl),
    creates: buildCreates(generated.creates),
  });
}

export { addApiKeyHeader, oauth2Authentication } from './authentication.js';

const App = buildZapierApp(loadSnapshot());

export default App;
