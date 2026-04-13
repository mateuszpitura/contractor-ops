// Phase 59 Plan 59-04 Task 1 — DRVDefenseBundleDocument template contract tests.
import fs from 'node:fs';
import path from 'node:path';

import {
  DRV_DEFENSE_COVER_HEADER_DE,
  DRV_DEFENSE_CROSS_REFERENCE_FOOTER_DE,
  DRV_DEFENSE_DISCLAIMER_DE,
  DRV_DEFENSE_SECTION_TITLES_DE,
} from '@contractor-ops/validators';
import { renderToBuffer } from '@react-pdf/renderer';
import type { ReactElement, ReactNode } from 'react';
import { describe, expect, it } from 'vitest';

import {
  DRV_FIXTURE_CONTRACTOR,
  DRV_FIXTURE_ENGAGEMENT,
  DRV_FIXTURE_ORGANIZATION,
  DRV_FIXTURE_RENDERED_AT,
  fixtureAttestation,
  fixtureCrossReference,
  fixturePriorHistory,
  fixtureScheinRed,
} from '../__fixtures__/drv-fixtures.js';
import { DRVDefenseBundleDocument, RENDERER_SLUG, TEMPLATE_VERSION } from '../drv-defense-bundle.js';

function collectText(node: ReactNode): string[] {
  const out: string[] = [];
  function walk(n: ReactNode): void {
    if (n == null || typeof n === 'boolean') return;
    if (typeof n === 'string') {
      out.push(n);
      return;
    }
    if (typeof n === 'number') {
      out.push(String(n));
      return;
    }
    if (Array.isArray(n)) {
      for (const c of n) walk(c);
      return;
    }
    if (typeof n === 'object' && 'props' in (n as object)) {
      const el = n as ReactElement<{ children?: ReactNode }>;
      walk(el.props.children);
    }
  }
  walk(node);
  return out;
}

function renderTree(): string {
  const element = DRVDefenseBundleDocument({
    assessment: fixtureScheinRed,
    priorAssessments: fixturePriorHistory,
    engagement: DRV_FIXTURE_ENGAGEMENT,
    contractor: DRV_FIXTURE_CONTRACTOR,
    organization: DRV_FIXTURE_ORGANIZATION,
    attestation: fixtureAttestation,
    crossReference: fixtureCrossReference,
    renderedAt: DRV_FIXTURE_RENDERED_AT,
  });
  return collectText(element).join(' ');
}

describe('DRVDefenseBundleDocument (Phase 59 · CLASS-06, D-14/D-15/D-16/D-17/D-18)', () => {
  it('exports TEMPLATE_VERSION and RENDERER_SLUG', () => {
    expect(TEMPLATE_VERSION).toBe(1);
    expect(RENDERER_SLUG).toBe('drv-defense-bundle');
  });

  it('cover renders DRV_DEFENSE_COVER_HEADER_DE verbatim', () => {
    const text = renderTree();
    expect(text).toContain(DRV_DEFENSE_COVER_HEADER_DE);
  });

  it('table of contents lists the 4 sections with DRV_DEFENSE_SECTION_TITLES_DE', () => {
    const text = renderTree();
    expect(text).toContain(DRV_DEFENSE_SECTION_TITLES_DE.engagementStructure);
    expect(text).toContain(DRV_DEFENSE_SECTION_TITLES_DE.independenceIndicators);
    expect(text).toContain(DRV_DEFENSE_SECTION_TITLES_DE.riskAssessmentHistory);
    expect(text).toContain(DRV_DEFENSE_SECTION_TITLES_DE.otherClientAttestation);
  });

  it('Section 2 renders all 4 DRV category titles with pill labels', () => {
    const text = renderTree();
    for (const label of [
      'Eingliederung in die Arbeitsorganisation',
      'Unternehmerische Selbstständigkeit',
      'Persönliche Abhängigkeit',
      'Wirtschaftliche Abhängigkeit',
    ]) {
      expect(text, `missing category label "${label}"`).toContain(label);
    }
  });

  it('Section 3 renders each prior assessment + delta narrative', () => {
    const text = renderTree();
    // The fixtures differ on totalScore, so we expect a Δ entry.
    expect(text).toMatch(/Δ\s*[+−±]/u);
    // First row (earliest in history) has the placeholder.
    expect(text).toContain('Erste Bewertung — kein Vergleichswert');
  });

  it('Section 4 cross-reference table renders DRV_DEFENSE_CROSS_REFERENCE_FOOTER_DE', () => {
    const text = renderTree();
    expect(text).toContain(DRV_DEFENSE_CROSS_REFERENCE_FOOTER_DE);
  });

  it('Section 4 renders the attestation statement + signer', () => {
    const text = renderTree();
    expect(text).toContain(fixtureAttestation.statementText);
    expect(text).toContain(fixtureAttestation.signedName);
  });

  it('final page renders DRV_DEFENSE_DISCLAIMER_DE verbatim', () => {
    const text = renderTree();
    expect(text).toContain(DRV_DEFENSE_DISCLAIMER_DE);
  });

  it('template source does NOT import from @contractor-ops/classification/profiles/*', () => {
    const src = fs.readFileSync(path.join(__dirname, '..', 'drv-defense-bundle.tsx'), 'utf8');
    expect(src).not.toMatch(/from ['"]@contractor-ops\/classification\/profiles/);
    expect(src).not.toMatch(/SCHEIN_QUESTIONS|SCHEIN_RULE_SET|IR35_QUESTIONS/);
  });

  it('renderToBuffer produces a non-empty PDF starting with %PDF magic bytes', async () => {
    const buf = await renderToBuffer(
      DRVDefenseBundleDocument({
        assessment: fixtureScheinRed,
        priorAssessments: fixturePriorHistory,
        engagement: DRV_FIXTURE_ENGAGEMENT,
        contractor: DRV_FIXTURE_CONTRACTOR,
        organization: DRV_FIXTURE_ORGANIZATION,
        attestation: fixtureAttestation,
        crossReference: fixtureCrossReference,
        renderedAt: DRV_FIXTURE_RENDERED_AT,
      }),
    );
    expect(buf.byteLength).toBeGreaterThan(1000);
    expect(buf.slice(0, 4).toString('binary')).toBe('%PDF');
  });
});
