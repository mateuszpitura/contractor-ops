import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import type { IpClausePhraseId } from '../legal/ip-clauses-index.js';
import {
  ALL_IP_CLAUSES,
  getPhraseJurisdiction,
  IP_CLAUSES_BY_JURISDICTION,
} from '../legal/ip-clauses-index.js';
import signoffRegistry from '../legal/signoff-registry.json' with { type: 'json' };

const SIGNOFF_PREFIX = 'legal-signoff.ip_clauses.';

const signoffPhraseIds = Object.keys(signoffRegistry as Record<string, unknown>)
  .filter(k => k.startsWith(SIGNOFF_PREFIX))
  .map(k => k.slice(SIGNOFF_PREFIX.length));

describe('IP-clauses ↔ signoff-registry parity (Phase 75 D-14 + D-16)', () => {
  it('every signoff entry under legal-signoff.ip_clauses.* maps to an IP_CLAUSES const entry', () => {
    const constKeys = new Set(Object.keys(ALL_IP_CLAUSES));
    for (const phraseId of signoffPhraseIds) {
      expect(constKeys.has(phraseId), `Missing const entry for phraseId: ${phraseId}`).toBe(true);
    }
  });

  it('every IP_CLAUSES const entry has a corresponding signoff-registry entry', () => {
    const signoffSet = new Set(signoffPhraseIds);
    for (const phraseId of Object.keys(ALL_IP_CLAUSES)) {
      expect(signoffSet.has(phraseId), `Missing signoff entry for phraseId: ${phraseId}`).toBe(
        true,
      );
    }
  });

  it('every IP_CLAUSES entry has a non-empty regex', () => {
    for (const [phraseId, entry] of Object.entries(ALL_IP_CLAUSES)) {
      expect(entry.regex, `${phraseId} has no regex`).toBeInstanceOf(RegExp);
      expect(entry.regex.source.length, `${phraseId} regex is empty`).toBeGreaterThan(0);
    }
  });

  it('every IP_CLAUSES entry has a non-empty legalBasisRef', () => {
    for (const [phraseId, entry] of Object.entries(ALL_IP_CLAUSES)) {
      expect(entry.legalBasisRef.length, `${phraseId} has empty legalBasisRef`).toBeGreaterThan(0);
    }
  });

  it('every phraseId jurisdiction prefix matches its assigned const file', () => {
    for (const phraseId of Object.keys(ALL_IP_CLAUSES) as IpClausePhraseId[]) {
      const j = getPhraseJurisdiction(phraseId);
      expect(IP_CLAUSES_BY_JURISDICTION[j]).toHaveProperty(phraseId);
    }
  });

  it('total phrase count matches Phase 75 RESEARCH §5 enumeration (17 phrases)', () => {
    expect(Object.keys(ALL_IP_CLAUSES)).toHaveLength(17);
    expect(Object.keys(IP_CLAUSES_BY_JURISDICTION.UK)).toHaveLength(3);
    expect(Object.keys(IP_CLAUSES_BY_JURISDICTION.DE)).toHaveLength(4);
    expect(Object.keys(IP_CLAUSES_BY_JURISDICTION.PL)).toHaveLength(3);
    expect(Object.keys(IP_CLAUSES_BY_JURISDICTION.US)).toHaveLength(3);
    expect(Object.keys(IP_CLAUSES_BY_JURISDICTION.KSA)).toHaveLength(2);
    expect(Object.keys(IP_CLAUSES_BY_JURISDICTION.UAE)).toHaveLength(2);
  });

  it('every phraseId is registered exactly once across all jurisdiction modules (no cross-module duplicates)', () => {
    const seen = new Map<string, string>();
    for (const [j, mod] of Object.entries(IP_CLAUSES_BY_JURISDICTION)) {
      for (const phraseId of Object.keys(mod)) {
        const previous = seen.get(phraseId);
        if (previous) {
          throw new Error(`Duplicate phraseId ${phraseId} in ${j} (also in ${previous})`);
        }
        seen.set(phraseId, j);
      }
    }
  });

  it('DE module carries §31 + §7 UrhG comment block', async () => {
    const deModulePath = fileURLToPath(new URL('../legal/ip-clauses-de.ts', import.meta.url));
    const file = await readFile(deModulePath, 'utf8');
    expect(file).toMatch(/§7 UrhG.*Sch[öo]pferprinzip/s);
    expect(file).toMatch(/§31 UrhG/);
    expect(file).toMatch(/INSUFFICIENT/);
  });
});
