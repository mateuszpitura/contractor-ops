#!/usr/bin/env tsx
// Phase 70 D-04 — i18n:parity CLI entrypoint.
//
// Walks apps/web-vite/messages/{en,de,pl,ar}.json and asserts every key in
// en.json exists in each peer locale. Pre-existing drift is tolerated via
// .i18n-parity-baseline.json (committed); only NEW drift fails CI.
// --update-baseline regenerates the baseline (manual local action).

import { existsSync } from 'node:fs';
import { readFile, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const Dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(Dirname, '..');
const MESSAGES_DIR = resolve(ROOT, 'apps/web-vite/messages');
const BASELINE_PATH = resolve(ROOT, '.i18n-parity-baseline.json');

const { runI18nParity, flattenLocaleKeys } = await import(
  '../packages/lint-guards/src/i18n-parity/run-guard.ts'
);
const { formatI18nParityOffences } = await import(
  '../packages/lint-guards/src/i18n-parity/format-offence.ts'
);

// Phase 84-02 (US-LOC-01): en-US is a thin-override locale that inherits every
// unchanged key from en at runtime (fallbackLng en-US → en → pl). It runs as a
// fallback-aware peer — a base key counts as covered for en-US if present in
// en-US.json OR in en.json — so the deliberately-thin override passes parity
// without joining the strict peers array. en's flattened keys are the fallback
// set. Run en-US in BOTH branches so it never seeds spurious baseline offences.
const EN_FALLBACK_KEYS = await flattenLocaleKeys(resolve(MESSAGES_DIR, 'en.json'));
const FALLBACK_PEERS = { 'en-US': EN_FALLBACK_KEYS };

const args = new Set(process.argv.slice(2));
const updateBaseline = args.has('--update-baseline');

const baseline = existsSync(BASELINE_PATH)
  ? JSON.parse(await readFile(BASELINE_PATH, 'utf-8'))
  : { offences: [] };

const baselineKeyed = (baseline.offences ?? []).map(b => ({
  locale: b.locale,
  missingKey: b.missingKey,
}));

if (updateBaseline) {
  const fresh = await runI18nParity({
    messagesDir: MESSAGES_DIR,
    base: 'en',
    peers: ['de', 'pl', 'ar'],
    fallbackPeers: FALLBACK_PEERS,
  });
  await writeFile(
    BASELINE_PATH,
    `${JSON.stringify(
      {
        note: 'Phase 70 i18n parity baseline — pre-existing missing-translation drift tolerated. Regenerate with: pnpm i18n:parity --update-baseline. NEW drift always fails.',
        offences: fresh,
      },
      null,
      2,
    )}\n`,
  );
  console.log(
    `[i18n:parity] baseline updated: ${fresh.length} pre-existing offence(s) written to .i18n-parity-baseline.json`,
  );
  process.exit(0);
}

const offences = await runI18nParity({
  messagesDir: MESSAGES_DIR,
  base: 'en',
  peers: ['de', 'pl', 'ar'],
  fallbackPeers: FALLBACK_PEERS,
  baseline: baselineKeyed,
});

if (offences.length === 0) {
  console.log(
    `[i18n:parity] OK: en.json keys covered in de.json, pl.json, ar.json (baseline: ${baselineKeyed.length} pre-existing site(s) tolerated)`,
  );
  process.exit(0);
}
console.error(formatI18nParityOffences(offences));
process.exit(1);
