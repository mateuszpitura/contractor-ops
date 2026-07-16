// @contractor-ops/marketplace-manifests — the single generation seam.
//
// Reads the committed OpenAPI 3.1 snapshot (write actions) + the 16-event
// webhook catalog (triggers) and emits every marketplace + collection artifact.
// A CLI `generate --check` diff-gate asserts the committed artifacts equal a
// fresh generation, so nothing drifts from the API.

export { generateInsomnia, type InsomniaExport } from './generate-insomnia.js';
export {
  generateMake,
  type MakeBlueprint,
  type MakeInstantTrigger,
  type MakeModule,
} from './generate-make.js';
export { generateN8n, type N8nDescriptor } from './generate-n8n.js';
export { generatePostman, type PostmanCollection } from './generate-postman.js';
export {
  generateZapier,
  type ZapierApp,
  type ZapierAuthentication,
  type ZapierCreate,
  type ZapierTrigger,
} from './generate-zapier.js';
export * from './load-spec.js';

import type { MakeBlueprint } from './generate-make.js';
import { generateMake } from './generate-make.js';
import type { N8nDescriptor } from './generate-n8n.js';
import { generateN8n } from './generate-n8n.js';
import type { ZapierApp } from './generate-zapier.js';
import { generateZapier } from './generate-zapier.js';
import type { OpenApiSnapshot } from './load-spec.js';

export interface Manifests {
  zapier: ZapierApp;
  n8n: N8nDescriptor;
  make: MakeBlueprint;
}

/**
 * Generate all three marketplace definitions from one OpenAPI snapshot + the
 * webhook event catalog. Triggers come from `events`, actions from the snapshot's
 * write operationIds (zero while the write routes are hidden).
 */
export function generateManifests(spec: OpenApiSnapshot, events: readonly string[]): Manifests {
  return {
    zapier: generateZapier(spec, events),
    n8n: generateN8n(spec, events),
    make: generateMake(spec, events),
  };
}
