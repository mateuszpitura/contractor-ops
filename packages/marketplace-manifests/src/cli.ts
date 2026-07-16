// Generator CLI. `generate` emits the committed marketplace + collection
// artifacts from the OpenAPI snapshot; `generate --check` regenerates to memory
// and diffs the committed files, failing on any drift (the CI gate, mirroring
// the snapshot diff-check). Snapshot-conditional: while the snapshot is absent
// (before the build-time snapshot exists) it is a no-op so CI never bricks.

import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createLogger } from '@contractor-ops/logger';
import { WEBHOOK_EVENT_TYPES } from '@contractor-ops/validators';

import { generateInsomnia } from './generate-insomnia.js';
import { generateMake } from './generate-make.js';
import { generatePostman } from './generate-postman.js';
import type { OpenApiSnapshot } from './load-spec.js';

const log = createLogger({ service: 'marketplace-manifests-cli' });

const REPO_ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..', '..');
const SNAPSHOT_PATH = join(REPO_ROOT, 'apps/public-api/openapi.snapshot.json');
const COLLECTIONS_DIR = join(REPO_ROOT, 'apps/public-api/collections');
const MAKE_DIR = join(REPO_ROOT, 'apps/public-api/marketplace/make');

const EVENTS = [...WEBHOOK_EVENT_TYPES];

interface Artifact {
  path: string;
  content: string;
}

function serialize(value: unknown): string {
  return `${JSON.stringify(value, null, 2)}\n`;
}

/** Build every committed marketplace + collection artifact from the snapshot. */
function buildArtifacts(spec: OpenApiSnapshot): Artifact[] {
  return [
    { path: join(COLLECTIONS_DIR, 'postman.json'), content: serialize(generatePostman(spec)) },
    { path: join(COLLECTIONS_DIR, 'insomnia.json'), content: serialize(generateInsomnia(spec)) },
    { path: join(MAKE_DIR, 'blueprint.json'), content: serialize(generateMake(spec, EVENTS)) },
  ];
}

function loadSnapshot(): OpenApiSnapshot | null {
  if (!existsSync(SNAPSHOT_PATH)) return null;
  return JSON.parse(readFileSync(SNAPSHOT_PATH, 'utf8')) as OpenApiSnapshot;
}

function runGenerate(check: boolean): void {
  const spec = loadSnapshot();
  if (!spec) {
    log.warn(
      { snapshot: SNAPSHOT_PATH },
      'openapi snapshot not found — nothing to generate (build the snapshot first)',
    );
    return;
  }

  const artifacts = buildArtifacts(spec);

  if (check) {
    const drifted = artifacts.filter(
      a => !existsSync(a.path) || readFileSync(a.path, 'utf8') !== a.content,
    );
    if (drifted.length > 0) {
      for (const a of drifted) {
        log.error({ path: a.path }, 'generated artifact drifted from the committed file');
      }
      process.exitCode = 1;
      return;
    }
    log.info({ count: artifacts.length }, 'all generated artifacts match the committed files');
    return;
  }

  for (const a of artifacts) {
    mkdirSync(dirname(a.path), { recursive: true });
    writeFileSync(a.path, a.content);
  }
  log.info({ count: artifacts.length }, 'generated artifacts written');
}

const args = process.argv.slice(2);
const command = args[0];
const check = args.includes('--check');

if (command === 'generate') {
  runGenerate(check);
} else {
  log.error({ command }, 'usage: marketplace-manifests generate [--check]');
  process.exitCode = 1;
}
