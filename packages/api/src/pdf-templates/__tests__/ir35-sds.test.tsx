// Phase 59 Plan 59-02 Task 1 — IR35SDSDocument template contract tests (CLASS-03, D-01..D-04).
//
// Text content assertions are done by rendering the React tree through
// react-test-renderer and walking for string children — the PDF binary itself
// encodes glyphs in ways that defeat plain substring scans. Byte stability is
// verified on the raw PDF buffer after stripping wall-clock metadata
// (Pitfall 2 in 59-RESEARCH).

import { createHash } from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';

import { IR35_DISPUTE_PROCESS_EN, SDS_DISCLAIMER_EN } from '@contractor-ops/validators';
import { renderToBuffer } from '@react-pdf/renderer';
import type { ReactElement, ReactNode } from 'react';
import { describe, expect, it } from 'vitest';

import {
  fixtureIr35Indeterminate,
  fixtureIr35Inside,
  fixtureIr35Outside,
  SDS_FIXTURE_CONTRACTOR,
  SDS_FIXTURE_ENGAGEMENT,
  SDS_FIXTURE_ORGANIZATION,
  SDS_FIXTURE_RENDERED_AT,
} from '../__fixtures__/sds-fixtures';
import { IR35SDSDocument, RENDERER_SLUG, TEMPLATE_VERSION } from '../ir35-sds';

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
      const el = n as ReactElement<{ children?: ReactNode; render?: unknown }>;
      // Skip `render` callbacks (page-number footer relies on render state we don't have)
      walk(el.props.children);
    }
  }
  walk(node);
  return out;
}

function renderTree(fixture: typeof fixtureIr35Outside): string {
  // Call the component function directly and walk the returned React tree.
  // This extracts human-readable text without rendering to PDF binary.
  const element = IR35SDSDocument({
    assessment: fixture,
    engagement: SDS_FIXTURE_ENGAGEMENT,
    contractor: SDS_FIXTURE_CONTRACTOR,
    organization: SDS_FIXTURE_ORGANIZATION,
    renderedAt: SDS_FIXTURE_RENDERED_AT,
  });
  return collectText(element).join(' ');
}

async function renderPdf(fixture: typeof fixtureIr35Outside): Promise<Buffer> {
  return renderToBuffer(
    <IR35SDSDocument
      assessment={fixture}
      engagement={SDS_FIXTURE_ENGAGEMENT}
      contractor={SDS_FIXTURE_CONTRACTOR}
      organization={SDS_FIXTURE_ORGANIZATION}
      renderedAt={SDS_FIXTURE_RENDERED_AT}
    />,
  );
}

function stripNonDeterministicPdfMetadata(buf: Buffer): Buffer {
  const txt = buf.toString('binary');
  const scrubbed = txt
    .replace(/\/CreationDate\s*\([^)]*\)/g, '/CreationDate(ZERO)')
    .replace(/\/ModDate\s*\([^)]*\)/g, '/ModDate(ZERO)')
    .replace(/\/ID\s*\[[^\]]*\]/g, '/ID[ZERO]')
    .replace(/\/Producer\s*\([^)]*\)/g, '/Producer(ZERO)')
    // Strip xref table (byte offsets vary between renders)
    .replace(/xref[\s\S]*?startxref\s*\d+/g, 'xref ZERO startxref 0')
    // Strip stream lengths which may vary due to compression non-determinism
    .replace(/\/Length\s+\d+/g, '/Length 0');
  return Buffer.from(scrubbed, 'binary');
}

describe('IR35SDSDocument (Phase 59 · CLASS-03, D-01/D-02/D-03/D-04)', () => {
  it('exports TEMPLATE_VERSION and RENDERER_SLUG constants', () => {
    expect(TEMPLATE_VERSION).toBe(1);
    expect(RENDERER_SLUG).toBe('ir35-sds');
  });

  it('renders an "Outside IR35" verdict pill for outcome.verdict = outside (D-02)', () => {
    const text = renderTree(fixtureIr35Outside);
    expect(text).toContain('Outside IR35');
  });

  it('renders an "Inside IR35" verdict pill for outcome.verdict = inside (D-02)', () => {
    const text = renderTree(fixtureIr35Inside);
    expect(text).toContain('Inside IR35');
  });

  it('renders an "Indeterminate" verdict pill for outcome.verdict = indeterminate (D-02)', () => {
    const text = renderTree(fixtureIr35Indeterminate);
    expect(text).toContain('Indeterminate');
  });

  it('renders a section for each of the 5 IR35 areas (D-01)', () => {
    const text = renderTree(fixtureIr35Outside);
    for (const title of [
      'Right of substitution',
      'Control',
      'Financial risk',
      'Part and parcel',
      'Mutuality of obligation',
    ]) {
      expect(text, `missing area title "${title}" in rendered tree`).toContain(title);
    }
  });

  it('renders per-question prompts + caseLawCitation entries from questionsSnapshot', () => {
    const text = renderTree(fixtureIr35Outside);
    expect(text).toContain('unfettered right of substitution');
    expect(text).toContain('Ready Mixed Concrete');
  });

  it('final page includes IR35_DISPUTE_PROCESS_EN verbatim (D-03)', () => {
    const text = renderTree(fixtureIr35Outside);
    expect(text).toContain(IR35_DISPUTE_PROCESS_EN);
  });

  it('final page includes SDS_DISCLAIMER_EN verbatim', () => {
    const text = renderTree(fixtureIr35Outside);
    expect(text).toContain(SDS_DISCLAIMER_EN);
  });

  it('template source does NOT import from @contractor-ops/classification/profiles/*', () => {
    const templatePath = path.join(__dirname, '..', 'ir35-sds.tsx');
    const src = fs.readFileSync(templatePath, 'utf8');
    expect(src).not.toMatch(/from ['"]@contractor-ops\/classification\/profiles/);
    expect(src).not.toMatch(/IR35_QUESTIONS|IR35_RULE_SET|SCHEIN_QUESTIONS/);
  });

  it('renderToBuffer produces a non-empty PDF', async () => {
    const buf = await renderPdf(fixtureIr35Outside);
    expect(buf.byteLength).toBeGreaterThan(1000);
    expect(buf.slice(0, 4).toString('binary')).toBe('%PDF');
  });

  it('produces byte-stable content across two renders with identical props (D-05)', async () => {
    const bufA = await renderPdf(fixtureIr35Outside);
    const bufB = await renderPdf(fixtureIr35Outside);
    const shaA = createHash('sha256').update(stripNonDeterministicPdfMetadata(bufA)).digest('hex');
    const shaB = createHash('sha256').update(stripNonDeterministicPdfMetadata(bufB)).digest('hex');
    expect(shaA).toBe(shaB);
  });
});
