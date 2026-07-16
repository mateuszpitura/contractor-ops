// The node surface is GENERATED, never hand-authored: the regular node's write
// actions and the trigger node's events both come from `generateN8n` in
// @contractor-ops/marketplace-manifests, applied to the committed OpenAPI
// snapshot (write actions) + the compiled-in webhook event catalog (triggers).
// A hand-edited operation list would drift from the API the day an endpoint
// changes; deriving it here keeps the node byte-consistent with the spec.

import { existsSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import type { N8nDescriptor, OpenApiSnapshot } from '@contractor-ops/marketplace-manifests';
import { generateN8n } from '@contractor-ops/marketplace-manifests';
import { WEBHOOK_EVENT_TYPES } from '@contractor-ops/validators';

export type { N8nDescriptor };

/** A single generated write operation (derived from the descriptor's node shape). */
export type N8nOperation = N8nDescriptor['node']['operations'][number];

// The committed snapshot lives at the monorepo root. In a published install
// (outside the repo) it is absent, so the write-action set is empty until a
// snapshot is bundled — the trigger events always come from the compiled-in
// catalog. This mirrors the generator's pre-flip posture (zero write actions
// while the public write routes are still hidden in the snapshot).
const SNAPSHOT_RELATIVE = 'apps/public-api/openapi.snapshot.json';

const EMPTY_SPEC: OpenApiSnapshot = {
  openapi: '3.1.0',
  info: { title: 'Contractor Ops Enterprise API', version: '1.0.0' },
  paths: {},
};

function repoRoot(): string {
  // dist/generated.js -> packages/n8n-nodes/dist -> repo root three levels up.
  return join(dirname(fileURLToPath(import.meta.url)), '..', '..', '..');
}

/** The committed OpenAPI snapshot, or null when it has not been generated yet. */
export function loadSnapshot(): OpenApiSnapshot | null {
  const path = join(repoRoot(), SNAPSHOT_RELATIVE);
  if (!existsSync(path)) return null;
  return JSON.parse(readFileSync(path, 'utf8')) as OpenApiSnapshot;
}

/** Build the n8n descriptor from the snapshot (or the empty pre-flip spec) + the event catalog. */
export function buildDescriptor(): N8nDescriptor {
  return generateN8n(loadSnapshot() ?? EMPTY_SPEC, WEBHOOK_EVENT_TYPES);
}

/** The descriptor the node classes render — resolved once at module load. */
export const CONTRACTOR_OPS_DESCRIPTOR: N8nDescriptor = buildDescriptor();

/** Resolve a generated write operation by its selected value (the operationId). */
export function operationByValue(
  descriptor: N8nDescriptor,
  value: string,
): N8nOperation | undefined {
  return descriptor.node.operations.find(op => op.value === value);
}
