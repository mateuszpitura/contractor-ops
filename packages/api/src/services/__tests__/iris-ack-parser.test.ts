// IRIS acknowledgement parser — one parser, both intake paths.
//
// Covers all six IRIS statuses, the Error Information Group on rejected /
// partial / accepted-with-errors acks, and the OriginalReceiptId a replacement
// transmission supersedes — asserted for BOTH the manual-uploaded ack XML and
// the dark A2A poll-result object. Also locks the XXE guard (a DOCTYPE-bearing
// ack is rejected).

import { describe, expect, it } from 'vitest';
import { IrisAckParseError, parseIrisAck } from '../iris-ack-parser';

function ackXml(statusTxt: string, extra = ''): string {
  return `<?xml version="1.0" encoding="UTF-8"?>
<Acknowledgement>
  <AcknowledgementStatusTxt>${statusTxt}</AcknowledgementStatusTxt>
  <ReceiptId>RCPT-2026-0001</ReceiptId>
  ${extra}
</Acknowledgement>`;
}

describe('parseIrisAck — six IRIS statuses (manual XML path)', () => {
  const cases: Array<[string, string]> = [
    ['Accepted', 'ACCEPTED'],
    ['Rejected', 'REJECTED'],
    ['Processing', 'PROCESSING'],
    ['Partially Accepted', 'PARTIALLY_ACCEPTED'],
    ['Accepted with Errors', 'ACCEPTED_WITH_ERRORS'],
    ['Not Found', 'NOT_FOUND'],
  ];

  for (const [statusTxt, expected] of cases) {
    it(`maps "${statusTxt}" to ${expected}`, () => {
      const ack = parseIrisAck(ackXml(statusTxt));
      expect(ack.status).toBe(expected);
      expect(ack.receiptId).toBe('RCPT-2026-0001');
    });
  }

  it('accepts underscore / hyphen status casing', () => {
    expect(parseIrisAck(ackXml('ACCEPTED_WITH_ERRORS')).status).toBe('ACCEPTED_WITH_ERRORS');
    expect(parseIrisAck(ackXml('partially-accepted')).status).toBe('PARTIALLY_ACCEPTED');
  });
});

describe('parseIrisAck — Error Information Group + OriginalReceiptId', () => {
  it('surfaces the Error Information Group for a rejected ack', () => {
    const xml = ackXml(
      'Rejected',
      `<ErrorInformationGrp>
         <ErrorDetail>
           <ErrorId>IRIS-1099NEC-0042</ErrorId>
           <ErrorMessageTxt>Box 1 amount must be a non-negative integer.</ErrorMessageTxt>
           <XpathContentTxt>/Form1099NECSubmission/PayeeRecordGrp[1]/Box1NonemployeeCompensationAmt</XpathContentTxt>
           <SubmissionId>SUB-9</SubmissionId>
         </ErrorDetail>
         <ErrorDetail>
           <ErrorId>IRIS-1099NEC-0051</ErrorId>
           <ErrorMessageTxt>Recipient TIN is required.</ErrorMessageTxt>
         </ErrorDetail>
       </ErrorInformationGrp>`,
    );

    const ack = parseIrisAck(xml);

    expect(ack.status).toBe('REJECTED');
    expect(ack.errorInformation).toHaveLength(2);
    expect(ack.errorInformation[0]).toMatchObject({
      errorId: 'IRIS-1099NEC-0042',
      message: 'Box 1 amount must be a non-negative integer.',
      recordId: 'SUB-9',
    });
    expect(ack.errorInformation[0].xpath).toContain('Box1NonemployeeCompensationAmt');
    expect(ack.errorInformation[1].errorId).toBe('IRIS-1099NEC-0051');
  });

  it('carries the OriginalReceiptId for a replacement acknowledgement', () => {
    const xml = ackXml('Accepted', '<OriginalReceiptId>RCPT-2025-9999</OriginalReceiptId>');

    const ack = parseIrisAck(xml);

    expect(ack.status).toBe('ACCEPTED');
    expect(ack.originalReceiptId).toBe('RCPT-2025-9999');
    expect(ack.errorInformation).toEqual([]);
  });
});

describe('parseIrisAck — dark A2A poll-result path (D-04, same parser)', () => {
  it('maps the A2A result object statuses + errors', () => {
    const ack = parseIrisAck({
      status: 'Accepted with Errors',
      receiptId: 'RCPT-A2A-77',
      originalReceiptId: 'RCPT-A2A-70',
      errors: [{ errorId: 'E1', message: 'Name/TIN mismatch', xpath: '/x', recordId: 'r1' }],
    });

    expect(ack.status).toBe('ACCEPTED_WITH_ERRORS');
    expect(ack.receiptId).toBe('RCPT-A2A-77');
    expect(ack.originalReceiptId).toBe('RCPT-A2A-70');
    expect(ack.errorInformation).toEqual([
      { errorId: 'E1', message: 'Name/TIN mismatch', xpath: '/x', recordId: 'r1' },
    ]);
  });

  it('handles a clean Accepted A2A result with no errors', () => {
    const ack = parseIrisAck({ status: 'Accepted', receiptId: 'RCPT-A2A-1' });
    expect(ack.status).toBe('ACCEPTED');
    expect(ack.errorInformation).toEqual([]);
  });
});

describe('parseIrisAck — untrusted-input safety', () => {
  it('rejects an unrecognized status', () => {
    expect(() => parseIrisAck(ackXml('Exploded'))).toThrow(IrisAckParseError);
  });

  it('rejects a DOCTYPE-bearing ack (XXE guard)', () => {
    const xxe = `<?xml version="1.0"?>
<!DOCTYPE Acknowledgement [<!ENTITY xxe SYSTEM "file:///etc/passwd">]>
<Acknowledgement><AcknowledgementStatusTxt>Accepted</AcknowledgementStatusTxt></Acknowledgement>`;
    expect(() => parseIrisAck(xxe)).toThrow(IrisAckParseError);
  });

  it('rejects an invalid A2A shape without an unsafe cast', () => {
    // @ts-expect-error — exercising the runtime guard on a malformed payload.
    expect(() => parseIrisAck({ notAStatus: true })).toThrow(IrisAckParseError);
  });
});
