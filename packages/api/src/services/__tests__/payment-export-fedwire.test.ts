// Terminal-RED Wave-0 scaffold for the Fedwire pacs.008 generator.
//
// RED until `generateFedwirePacs008` is exported from `../payment-export`. The
// symbol does not exist yet, so the import resolves to `undefined` and the first
// call throws `generateFedwirePacs008 is not a function` — the suite fails for
// the right reason (the production symbol is absent), not from a typo or an
// import-path error.
//
// Fedwire's legacy FAIM flat file was retired 2025-07-14 in favor of ISO 20022
// pacs.008 (customer credit transfer). This pins the pacs.008 envelope a
// downstream wave must satisfy, mirroring the existing `generateSwiftXml`
// pain.001.001.09 builder:
//   - a `pacs.008.001.xx` Document with a GrpHdr carrying MsgId / CreDtTm /
//     NbOfTxs / CtrlSum
//   - one CdtTrfTxInf per item
//   - the control sum equals the sum of every item amount

import { describe, expect, it } from 'vitest';
import type { ExportItem, OrgBankInfo } from '../payment-export';
// generateFedwirePacs008 does not exist yet — that absence IS the RED.
import { generateFedwirePacs008 } from '../payment-export';

const org: OrgBankInfo = {
  name: 'Acme Contractor Inc',
  iban: 'US64SVBKUS6S3300958879',
  bic: 'SVBKUS6S',
};

const items: ExportItem[] = [
  {
    contractorName: 'Jan Kowalski',
    iban: 'US12345678901234567890',
    amountMinor: 250_000_00,
    currency: 'USD',
    invoiceNumber: 'INV-2026-101',
    taxId: '123456789',
    bankName: 'Bank of America',
    swiftBic: 'BOFAUS3N',
    dueDate: new Date('2026-04-15'),
    transferTitle: 'Payment for INV-2026-101',
    serviceCategory: 'CONSULTING',
    creditorCountry: 'US',
  },
  {
    contractorName: 'Maria Nowak',
    iban: 'US09876543210987654321',
    amountMinor: 175_000_00,
    currency: 'USD',
    invoiceNumber: 'INV-2026-102',
    taxId: '987654321',
    bankName: 'Wells Fargo',
    swiftBic: 'WFBIUS6S',
    dueDate: new Date('2026-04-15'),
    transferTitle: 'Payment for INV-2026-102',
    serviceCategory: 'SOFTWARE_DEVELOPMENT',
    creditorCountry: 'US',
  },
];

describe('generateFedwirePacs008', () => {
  const xml = generateFedwirePacs008(items, org, 'PR-2026-200').toString('utf-8');

  it('produces a pacs.008.001.xx Document envelope', () => {
    expect(xml).toMatch(/urn:iso:std:iso:20022:tech:xsd:pacs\.008\.001\.\d+/);
    expect(xml).toContain('<Document');
  });

  it('includes a GrpHdr with MsgId, CreDtTm and NbOfTxs', () => {
    expect(xml).toContain('<GrpHdr>');
    expect(xml).toContain('<MsgId>');
    expect(xml).toContain('<CreDtTm>');
    expect(xml).toContain('<NbOfTxs>2</NbOfTxs>');
  });

  it('sets the group control sum to the total of every item amount', () => {
    // 25000000 + 17500000 = 42500000 USD minor = 425000.00
    expect(xml).toContain('<CtrlSum>425000.00</CtrlSum>');
  });

  it('emits one CdtTrfTxInf per item', () => {
    const occurrences = xml.match(/<CdtTrfTxInf>/g) ?? [];
    expect(occurrences).toHaveLength(items.length);
  });

  it('escapes XML special characters in creditor names', () => {
    const special: ExportItem[] = [{ ...items[0]!, contractorName: 'M&M <Wire> "Co"' }];
    const specialXml = generateFedwirePacs008(special, org, 'PR-TEST').toString('utf-8');
    expect(specialXml).toContain('M&amp;M &lt;Wire&gt; &quot;Co&quot;');
  });
});
