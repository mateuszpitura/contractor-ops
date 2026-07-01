// US Determination-Letter template contract tests.
//
// The assertions pin the deterministic no-LLM render contract plus the locked
// advisory-footer contract, mirroring the shipped ir35-sds template:
//   - a byte-stable render for a stable renderedAt (deterministic, no wall-clock
//     bleed);
//   - TEMPLATE_VERSION + RENDERER_SLUG = 'us-determination-letter' exports;
//   - the verdict, per-factor evidence, the AB5 (amber) and §530 (info) flags and
//     the rule citations are rendered;
//   - the footer disclaimer is SOFTWARE_NOT_LEGAL_ADVICE_EN imported from
//     @contractor-ops/validators (a CI-locked phrase — NOT a messages/*.json key);
//   - there is NO LLM path anywhere in the template (deterministic render only).
//
// Text content is asserted by walking the React tree (the PDF binary encodes
// glyphs in ways that defeat substring scans); byte stability is verified on the
// raw PDF buffer after stripping wall-clock metadata.

import { createHash } from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';

import { SOFTWARE_NOT_LEGAL_ADVICE_EN } from '@contractor-ops/validators';
import { renderToBuffer } from '@react-pdf/renderer';
import type { ReactElement, ReactNode } from 'react';
import { describe, expect, it } from 'vitest';

import {
  RENDERER_SLUG,
  TEMPLATE_VERSION,
  UsDeterminationLetterDocument,
} from '../us-determination-letter';

const FIXTURE_RENDERED_AT = new Date('2026-06-01T00:00:00.000Z');

const FIXTURE = {
  assessment: {
    ruleSetVersion: 'US-2026-COMMONLAW-AB5',
    completedAt: FIXTURE_RENDERED_AT,
    questionsSnapshot: {
      questions: [
        {
          id: 'Q-USFED-BEH-01',
          prompt: { en: 'Does the payer control how the work is done day to day?' },
          citation: 'IRS common-law control test (SS-8)',
        },
      ],
    },
    answers: { 'Q-USFED-BEH-01': { value: 'yes' } },
    outcome: {
      kind: 'US_CLASSIFICATION',
      ruleSetVersion: 'US-2026-COMMONLAW-AB5',
      verdict: 'employee',
      ab5Flag: true,
      section530ReliefEligible: true,
      factors: [
        {
          category: 'behavioral',
          citations: ['IRS common-law control test (SS-8)'],
          drivingQuestionIds: ['Q-USFED-BEH-01'],
        },
      ],
      computedAt: FIXTURE_RENDERED_AT.toISOString(),
    },
  },
  engagement: {
    id: 'eng_1',
    displayName: 'Backend build',
    activeFrom: FIXTURE_RENDERED_AT,
    activeTo: null,
  },
  contractor: { id: 'rec_1', displayName: 'Jean Contractor' },
  organization: { id: 'org_1', name: 'Acme Org', countryCode: 'US' },
  renderedAt: FIXTURE_RENDERED_AT,
};

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
  return collectText(UsDeterminationLetterDocument(FIXTURE as never)).join(' ');
}

async function renderPdf(): Promise<Buffer> {
  return renderToBuffer(<UsDeterminationLetterDocument {...(FIXTURE as never)} />);
}

function stripNonDeterministicPdfMetadata(buf: Buffer): Buffer {
  const txt = buf.toString('binary');
  const scrubbed = txt
    .replace(/\/CreationDate\s*\([^)]*\)/g, '/CreationDate(ZERO)')
    .replace(/\/ModDate\s*\([^)]*\)/g, '/ModDate(ZERO)')
    .replace(/\/ID\s*\[[^\]]*\]/g, '/ID[ZERO]')
    .replace(/\/Producer\s*\([^)]*\)/g, '/Producer(ZERO)')
    .replace(/xref[\s\S]*?startxref\s*\d+/g, 'xref ZERO startxref 0')
    .replace(/\/Length\s+\d+/g, '/Length 0');
  return Buffer.from(scrubbed, 'binary');
}

describe('UsDeterminationLetterDocument', () => {
  it('exports TEMPLATE_VERSION and RENDERER_SLUG = "us-determination-letter"', () => {
    expect(TEMPLATE_VERSION).toBe(1);
    expect(RENDERER_SLUG).toBe('us-determination-letter');
  });

  it('renders the verdict, the AB5 flag, the §530 flag, and the rule citation', () => {
    const text = renderTree();
    expect(text).toMatch(/employee/i);
    expect(text).toMatch(/AB5|ABC/i);
    expect(text).toMatch(/530/);
    expect(text).toContain('IRS common-law control test (SS-8)');
  });

  it('includes the SOFTWARE_NOT_LEGAL_ADVICE_EN footer verbatim', () => {
    const text = renderTree();
    expect(text).toContain(SOFTWARE_NOT_LEGAL_ADVICE_EN);
  });

  it('imports the locked disclaimer from @contractor-ops/validators, not a translation file', () => {
    const templatePath = path.join(__dirname, '..', 'us-determination-letter.tsx');
    const src = fs.readFileSync(templatePath, 'utf8');
    expect(src).toMatch(/from ['"]@contractor-ops\/validators['"]/);
    expect(src).not.toMatch(
      /SOFTWARE_NOT_LEGAL_ADVICE_EN.*messages|messages.*SOFTWARE_NOT_LEGAL_ADVICE_EN/,
    );
  });

  it('has no LLM call path — the render is fully deterministic', () => {
    const templatePath = path.join(__dirname, '..', 'us-determination-letter.tsx');
    const src = fs.readFileSync(templatePath, 'utf8');
    expect(src).not.toMatch(/openai|anthropic|\.chat\.completions|generateText|callLlm/i);
  });

  it('renderToBuffer produces a non-empty PDF', async () => {
    const buf = await renderPdf();
    expect(buf.byteLength).toBeGreaterThan(1000);
    expect(buf.slice(0, 4).toString('binary')).toBe('%PDF');
  });

  it('produces byte-stable content across two renders with identical props', async () => {
    const bufA = await renderPdf();
    const bufB = await renderPdf();
    const shaA = createHash('sha256').update(stripNonDeterministicPdfMetadata(bufA)).digest('hex');
    const shaB = createHash('sha256').update(stripNonDeterministicPdfMetadata(bufB)).digest('hex');
    expect(shaA).toBe(shaB);
  });
});
