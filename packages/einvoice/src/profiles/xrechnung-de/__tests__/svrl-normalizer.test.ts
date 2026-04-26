// packages/einvoice/src/profiles/xrechnung-de/__tests__/svrl-normalizer.test.ts
//
// Phase 61 · Plan 61-03 Task 2 — SVRL normaliser unit tests.
//
// The normaliser flattens raw SVRL (Schematron Validation Report Language)
// output emitted by saxon-js's `SaxonJS.transform` into the typed
// `ValidationIssue` shape consumed by `validator.ts` (per-layer aggregation)
// and downstream by the EInvoice tab UI (Plan 61-08 / 61-07 display layer).

import { describe, expect, it } from 'vitest';
import { normaliseSvrl } from '../svrl-normalizer.js';

const SVRL_HEAD = `<?xml version="1.0" encoding="UTF-8"?>
<svrl:schematron-output xmlns:svrl="http://purl.oclc.org/dsdl/svrl">`;
const SVRL_TAIL = `</svrl:schematron-output>`;

describe('normaliseSvrl', () => {
  it('extracts ruleId, xpath, severity, and message from failed-assert + successful-report elements', () => {
    const svrl = `${SVRL_HEAD}
      <svrl:failed-assert location="/Invoice[1]/Currency[1]" flag="fatal" id="BR-DE-15" test="ram:BuyerReference">
        <svrl:text>[BR-DE-15] BuyerReference must be provided.</svrl:text>
      </svrl:failed-assert>
      <svrl:failed-assert location="/Invoice[1]/TypeCode[1]" flag="warning" id="BR-DE-17">
        <svrl:text>[BR-DE-17] Invoice type code is out of whitelist.</svrl:text>
      </svrl:failed-assert>
      <svrl:successful-report location="/Invoice[1]" flag="information" id="BR-DE-TMP-32">
        <svrl:text>[BR-DE-TMP-32] Informational only.</svrl:text>
      </svrl:successful-report>
    ${SVRL_TAIL}`;

    const result = normaliseSvrl(svrl);

    expect(result.errors).toHaveLength(1);
    expect(result.errors[0]).toMatchObject({
      ruleId: 'BR-DE-15',
      xpath: '/Invoice[1]/Currency[1]',
      severity: 'fatal',
      message: '[BR-DE-15] BuyerReference must be provided.',
    });

    expect(result.warnings).toHaveLength(1);
    expect(result.warnings[0]).toMatchObject({
      ruleId: 'BR-DE-17',
      severity: 'warning',
      message: expect.stringContaining('BR-DE-17'),
    });

    expect(result.infos).toHaveLength(1);
    expect(result.infos[0]).toMatchObject({
      ruleId: 'BR-DE-TMP-32',
      severity: 'info',
    });
  });

  it('defaults unknown @flag to severity="error" and places in errors array', () => {
    const svrl = `${SVRL_HEAD}
      <svrl:failed-assert location="/root" flag="weird" id="RULE-UNKNOWN">
        <svrl:text>unknown flag</svrl:text>
      </svrl:failed-assert>
    ${SVRL_TAIL}`;

    const result = normaliseSvrl(svrl);

    expect(result.errors).toHaveLength(1);
    expect(result.errors[0].severity).toBe('error');
    expect(result.errors[0].ruleId).toBe('RULE-UNKNOWN');
  });

  it('defaults missing @flag to severity="error" (no flag attribute)', () => {
    const svrl = `${SVRL_HEAD}
      <svrl:failed-assert location="/root" id="NO-FLAG">
        <svrl:text>no flag present</svrl:text>
      </svrl:failed-assert>
    ${SVRL_TAIL}`;

    const result = normaliseSvrl(svrl);

    expect(result.errors).toHaveLength(1);
    expect(result.errors[0].severity).toBe('error');
    expect(result.errors[0].ruleId).toBe('NO-FLAG');
  });

  it('returns empty arrays when SVRL contains no issues', () => {
    const svrl = `${SVRL_HEAD}${SVRL_TAIL}`;

    const result = normaliseSvrl(svrl);

    expect(result.errors).toEqual([]);
    expect(result.warnings).toEqual([]);
    expect(result.infos).toEqual([]);
  });

  it('is XXE-safe: refuses to parse SVRL with a DTD ENTITY declaration', () => {
    // With `processEntities: false`, fast-xml-parser rejects any DOCTYPE that
    // declares an ENTITY (resolution would require entity expansion). The
    // normaliser swallows the parse failure and returns empty buckets — no
    // attacker-controlled XXE payload can surface in the typed report.
    // Mitigates T-61-03-01 (XXE) and T-61-03-05 (billion-laughs).
    const svrl = `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE svrl [<!ENTITY xxe SYSTEM "file:///etc/passwd">]>
<svrl:schematron-output xmlns:svrl="http://purl.oclc.org/dsdl/svrl">
  <svrl:failed-assert location="/root" flag="fatal" id="XXE-TEST">
    <svrl:text>&xxe;</svrl:text>
  </svrl:failed-assert>
</svrl:schematron-output>`;

    const result = normaliseSvrl(svrl);

    expect(result.errors).toEqual([]);
    expect(result.warnings).toEqual([]);
    expect(result.infos).toEqual([]);
  });

  it('is XXE-safe: leaves entity-like text in element bodies as literal (no expansion)', () => {
    // Without a DOCTYPE, the literal &amp;xxe; is parsed as the safe text
    // "&xxe;". The string MUST NOT be replaced with file-system data.
    const svrl = `${SVRL_HEAD}
      <svrl:failed-assert location="/root" flag="fatal" id="ENTITY-LITERAL">
        <svrl:text>&amp;xxe;</svrl:text>
      </svrl:failed-assert>
    ${SVRL_TAIL}`;

    const result = normaliseSvrl(svrl);

    expect(result.errors).toHaveLength(1);
    expect(result.errors[0].message).not.toContain('root:');
    expect(result.errors[0].message).not.toContain('/bin/');
    expect(result.errors[0].message.length).toBeLessThan(50);
  });
});
