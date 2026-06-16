// iris-ack-parser — Wave-0 RED scaffold (US-FORM-05).
//
// One ack parser feeds BOTH the manual-upload flow (admin uploads the IRS ack
// file) and the dark A2A poll result (D-04). It must map all six IRIS
// acknowledgement statuses to a normalized union, surface the Error Information
// Group for the failing/partial cases, and carry the OriginalReceiptId for
// replacements.
//
// The parser does not exist yet, so this suite fails at module resolution —
// terminal-RED accepted for Wave 0.

import { describe, expect, it } from 'vitest';
// The implementation does not exist yet — Wave-0 RED (resolution-fail).
import { parseIrisAck } from '../iris-ack-parser';

describe('iris-ack-parser — six IRIS statuses (US-FORM-05 / D-04)', () => {
  it('maps each of the six IRIS acknowledgement statuses', () => {
    const cases: Array<[string, string]> = [
      ['Accepted', 'ACCEPTED'],
      ['Rejected', 'REJECTED'],
      ['Processing', 'PROCESSING'],
      ['Partially Accepted', 'PARTIALLY_ACCEPTED'],
      ['Accepted with Errors', 'ACCEPTED_WITH_ERRORS'],
      ['Not Found', 'NOT_FOUND'],
    ];

    for (const [raw, normalized] of cases) {
      const ack = parseIrisAck(`<Acknowledgement><Status>${raw}</Status></Acknowledgement>`);
      expect(ack.status).toBe(normalized);
    }
  });

  it('surfaces the Error Information Group for a rejected ack', () => {
    const ack = parseIrisAck(
      '<Acknowledgement><Status>Rejected</Status>' +
        '<ErrorInformationGrp><Error><Code>F1099-001</Code><Message>Bad TIN</Message></Error></ErrorInformationGrp>' +
        '</Acknowledgement>',
    );

    expect(ack.status).toBe('REJECTED');
    expect(ack.errors.length).toBeGreaterThan(0);
    expect(ack.errors[0].code).toBe('F1099-001');
  });

  it('carries the OriginalReceiptId for a replacement acknowledgement', () => {
    const ack = parseIrisAck(
      '<Acknowledgement><Status>Accepted</Status><OriginalReceiptId>RCPT-12345</OriginalReceiptId></Acknowledgement>',
    );

    expect(ack.originalReceiptId).toBe('RCPT-12345');
  });
});
