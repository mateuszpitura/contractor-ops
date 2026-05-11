#!/usr/bin/env tsx
/**
 * One-shot script: merges the curated German translation map below into
 * apps/web/messages/de.json at the correct nested paths, replacing the
 * English copy-pasted scaffolds and preserving the existing structure.
 *
 * Source of truth for the keys: .planning/translations/apps_web-de-untranslated.json
 * (2,120 keys whose value in de.json is still byte-identical to en.json).
 *
 * Style guidelines applied while translating:
 *   - Formal German B2B SaaS register (Sie-form throughout, never Du).
 *   - Mirrors the existing translated portion of de.json.
 *   - ICU placeholders ({count}, {date}, {percent}, plural slots) preserved verbatim.
 *   - Domain vocabulary anchored in DE B2B usage (Auftragnehmer, Rechnung, Vertrag,
 *     Freigabe, Freigabekette, Zahlungslauf, Schwellenwert, Skonto, Verzugszinsen,
 *     Audit-Protokoll, Workflow, Compliance — last two are established Anglizismen).
 *   - Proper nouns kept English (Slack, Jira, Linear, Google Drive, Microsoft Teams,
 *     Stripe, KSeF, ZATCA, Peppol, BACS, SEPA, DRV, IR35, HMRC, etc.).
 *   - DE-domestic tax terms in German (Steuerberater, Scheinselbständigkeit, Skonto,
 *     Statusfeststellungsverfahren, GoBD, XRechnung, Kleinunternehmerregelung).
 *   - UK statute names kept in English.
 *
 * Run once:
 *   pnpm tsx scripts/apply-de-translations.ts
 */

import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { TRANSLATIONS_PART1 } from './apply-de-translations.part1.js';
import { TRANSLATIONS_PART2 } from './apply-de-translations.part2.js';
import { TRANSLATIONS_PART3 } from './apply-de-translations.part3.js';
import { TRANSLATIONS_PART4 } from './apply-de-translations.part4.js';
import { TRANSLATIONS_PART5 } from './apply-de-translations.part5.js';
import { TRANSLATIONS_PART6 } from './apply-de-translations.part6.js';

const DE_PATH = resolve(process.cwd(), 'apps/web/messages/de.json');

const ALL_TRANSLATIONS: Record<string, string> = {
  ...TRANSLATIONS_PART1,
  ...TRANSLATIONS_PART2,
  ...TRANSLATIONS_PART3,
  ...TRANSLATIONS_PART4,
  ...TRANSLATIONS_PART5,
  ...TRANSLATIONS_PART6,
};

function setDeep(obj: Record<string, unknown>, dottedPath: string, value: string): void {
  const parts = dottedPath.split('.');
  let cur: Record<string, unknown> = obj;
  for (let i = 0; i < parts.length - 1; i++) {
    const key = parts[i]!;
    const next = cur[key];
    if (typeof next !== 'object' || next === null || Array.isArray(next)) {
      cur[key] = {};
    }
    cur = cur[key] as Record<string, unknown>;
  }
  cur[parts[parts.length - 1]!] = value;
}

const raw = readFileSync(DE_PATH, 'utf-8');
const data = JSON.parse(raw) as Record<string, unknown>;

let applied = 0;
for (const [key, value] of Object.entries(ALL_TRANSLATIONS)) {
  setDeep(data, key, value);
  applied++;
}

writeFileSync(DE_PATH, JSON.stringify(data, null, 2) + '\n', 'utf-8');

// eslint-disable-next-line no-console
console.log(`Applied ${applied} German translations to apps/web/messages/de.json`);
