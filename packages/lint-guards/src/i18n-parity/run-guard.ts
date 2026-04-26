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

export async function runI18nParity(opts: I18nParityOptions): Promise<I18nParityOffence[]> {
  const baseRaw = await readFile(join(opts.messagesDir, `${opts.base}.json`), 'utf-8');
  const baseJson = JSON.parse(baseRaw);
  const baseKeys = new Set(flattenKeys(baseJson));

  const baselineKey = (locale: string, key: string) => `${locale}::${key}`;
  const baseline = new Set((opts.baseline ?? []).map(b => baselineKey(b.locale, b.missingKey)));

  const offences: I18nParityOffence[] = [];

  for (const peer of opts.peers) {
    const peerRaw = await readFile(join(opts.messagesDir, `${peer}.json`), 'utf-8');
    const peerJson = JSON.parse(peerRaw);
    const peerKeys = new Set(flattenKeys(peerJson));

    const missing: string[] = [];
    for (const key of baseKeys) {
      if (!(peerKeys.has(key) || baseline.has(baselineKey(peer, key)))) {
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
