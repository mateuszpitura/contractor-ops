// Phase 70 · Plan 04 · FOUND6-03 — message-key parity guard.
//
// Loads `<base>.json` and each peer locale, flattens nested keys to dotted
// paths, and reports an offence for every base-key missing from any peer.
// Direction is one-way (base ⊂ peers) — peer-only keys are not flagged
// (T-70-04-02).

import { readFile } from 'node:fs/promises';
import { join } from 'node:path';

export interface I18nParityOptions {
  messagesDir: string;
  base: string; // e.g. 'en'
  peers: readonly string[]; // e.g. ['de', 'pl', 'ar']
  /**
   * Sites whose `(locale, missingKey)` are present here are tolerated
   * (baseline diff mode). Same shape as the lint:logs baseline (Plan 70-03).
   */
  baseline?: readonly { locale: string; missingKey: string }[];
  /**
   * Fallback-aware peers (Phase 84-02, US-LOC-01). A thin-override locale such
   * as `en-US` only carries divergent keys; the rest are inherited at runtime
   * via i18next's `fallbackLng` chain (en-US → en → pl). For each entry, a base
   * key counts as covered if it is present in the peer's own JSON OR in the
   * supplied fallback key set — so a deliberately-thin override passes parity
   * without adding the locale to the strict `peers` array (which would demand
   * literal full key parity and red-CI every not-yet-overridden key). Strict
   * peers keep exact `peerKeys` semantics; this relaxation applies ONLY to the
   * fallback-aware locales listed here.
   */
  fallbackPeers?: Record<string, ReadonlySet<string>>;
}

export interface I18nParityOffence {
  kind: 'missing-translation-key';
  locale: string;
  missingKey: string;
  remediation: string;
}

const REMEDIATION_ANCHOR = 'docs/lint-remediation/i18n-parity.md#missing-translation-key';

function flattenKeys(obj: unknown, prefix = ''): string[] {
  if (obj === null || obj === undefined || typeof obj !== 'object' || Array.isArray(obj)) {
    return prefix ? [prefix] : [];
  }
  const result: string[] = [];
  for (const [key, value] of Object.entries(obj as Record<string, unknown>)) {
    const compound = prefix ? `${prefix}.${key}` : key;
    if (value && typeof value === 'object' && !Array.isArray(value)) {
      result.push(...flattenKeys(value, compound));
    } else {
      result.push(compound);
    }
  }
  return result;
}

/**
 * Read a locale JSON file and return its flattened dotted key paths as a Set.
 * Exposed so callers (e.g. `scripts/i18n-parity.mjs`) can build the fallback
 * key set for a fallback-aware peer without re-implementing the flatten logic.
 */
export async function flattenLocaleKeys(filePath: string): Promise<Set<string>> {
  const raw = await readFile(filePath, 'utf-8');
  return new Set(flattenKeys(JSON.parse(raw)));
}

export async function runI18nParity(opts: I18nParityOptions): Promise<I18nParityOffence[]> {
  const baseRaw = await readFile(join(opts.messagesDir, `${opts.base}.json`), 'utf-8');
  const baseJson = JSON.parse(baseRaw);
  const baseKeys = new Set(flattenKeys(baseJson));

  const baselineKey = (locale: string, key: string) => `${locale}::${key}`;
  const baseline = new Set((opts.baseline ?? []).map(b => baselineKey(b.locale, b.missingKey)));

  const offences: I18nParityOffence[] = [];

  const fallbackPeers = opts.fallbackPeers ?? {};
  // Strict peers + fallback-aware peers share the same base-key coverage check;
  // only the "covered" set differs (fallback peers add their inherited keys).
  const allPeers = [...opts.peers, ...Object.keys(fallbackPeers)];

  for (const peer of allPeers) {
    const peerRaw = await readFile(join(opts.messagesDir, `${peer}.json`), 'utf-8');
    const peerJson = JSON.parse(peerRaw);
    const peerKeys = new Set(flattenKeys(peerJson));
    const fallbackKeys = fallbackPeers[peer];

    const missing: string[] = [];
    for (const key of baseKeys) {
      const covered =
        peerKeys.has(key) ||
        (fallbackKeys?.has(key) ?? false) ||
        baseline.has(baselineKey(peer, key));
      if (!covered) {
        missing.push(key);
      }
    }
    missing.sort();

    for (const missingKey of missing) {
      offences.push({
        kind: 'missing-translation-key',
        locale: peer,
        missingKey,
        remediation: REMEDIATION_ANCHOR,
      });
    }
  }
  return offences;
}
