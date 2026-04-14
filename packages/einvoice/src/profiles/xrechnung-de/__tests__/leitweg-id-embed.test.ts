// packages/einvoice/src/profiles/xrechnung-de/__tests__/leitweg-id-embed.test.ts
//
// Phase 61 · Plan 61-02 Task 1 — TDD tests for the BT-10 embed helper.
// Replaces the Plan-01 RED scaffold (describe.todo).
//
// The helper is the single place that writes a Leitweg-ID into a CII
// document tree at path
// /rsm:CrossIndustryInvoice/rsm:SupplyChainTradeTransaction/ram:ApplicableHeaderTradeAgreement/ram:BuyerReference
// (BT-10). Isolating the insertion keeps the generator's tree-building pure
// and lets higher layers (Plan 04 resolver) short-circuit when no ID resolves
// without worrying about XML structure.

import { describe, expect, it } from 'vitest';
import type { CiiDocShape } from '../generator.js';
import { embedLeitwegIdIntoCii } from '../leitweg-id-embed.js';

function makeBareCiiDoc(): CiiDocShape {
  return {
    'rsm:CrossIndustryInvoice': {
      '@_xmlns:rsm': 'urn:un:unece:uncefact:data:standard:CrossIndustryInvoice:100',
      '@_xmlns:ram':
        'urn:un:unece:uncefact:data:standard:ReusableAggregateBusinessInformationEntity:100',
      '@_xmlns:udt': 'urn:un:unece:uncefact:data:standard:UnqualifiedDataType:100',
      '@_xmlns:qdt': 'urn:un:unece:uncefact:data:standard:QualifiedDataType:100',
      'rsm:ExchangedDocumentContext': {
        'ram:GuidelineSpecifiedDocumentContextParameter': { 'ram:ID': 'CUST-ID' },
      },
      'rsm:ExchangedDocument': { 'ram:ID': 'INV-1', 'ram:TypeCode': '380' },
      'rsm:SupplyChainTradeTransaction': {
        'ram:IncludedSupplyChainTradeLineItem': [],
        'ram:ApplicableHeaderTradeAgreement': {
          'ram:SellerTradeParty': { 'ram:Name': 'Seller' },
          'ram:BuyerTradeParty': { 'ram:Name': 'Buyer' },
        },
        'ram:ApplicableHeaderTradeDelivery': {},
        'ram:ApplicableHeaderTradeSettlement': {
          'ram:InvoiceCurrencyCode': 'EUR',
          'ram:ApplicableTradeTax': [],
          'ram:SpecifiedTradeSettlementHeaderMonetarySummation': {},
        },
      },
    },
  };
}

describe('embedLeitwegIdIntoCii', () => {
  it('inserts ram:BuyerReference at the BT-10 path', () => {
    const doc = makeBareCiiDoc();
    const result = embedLeitwegIdIntoCii(doc, '991-33333TEST-33');

    const agreement =
      result['rsm:CrossIndustryInvoice']['rsm:SupplyChainTradeTransaction'][
        'ram:ApplicableHeaderTradeAgreement'
      ];
    expect(agreement['ram:BuyerReference']).toBe('991-33333TEST-33');
  });

  it('does not mutate the input document (structural clone)', () => {
    const doc = makeBareCiiDoc();
    const before = JSON.stringify(doc);
    embedLeitwegIdIntoCii(doc, '991-33333TEST-33');
    expect(JSON.stringify(doc)).toBe(before);

    const agreement =
      doc['rsm:CrossIndustryInvoice']['rsm:SupplyChainTradeTransaction'][
        'ram:ApplicableHeaderTradeAgreement'
      ];
    expect(agreement['ram:BuyerReference']).toBeUndefined();
  });

  it('preserves surrounding seller / buyer / settlement structure', () => {
    const doc = makeBareCiiDoc();
    const result = embedLeitwegIdIntoCii(doc, 'X-Y-Z');

    const txn = result['rsm:CrossIndustryInvoice']['rsm:SupplyChainTradeTransaction'];
    expect(txn['ram:ApplicableHeaderTradeAgreement']['ram:SellerTradeParty']).toEqual({
      'ram:Name': 'Seller',
    });
    expect(txn['ram:ApplicableHeaderTradeAgreement']['ram:BuyerTradeParty']).toEqual({
      'ram:Name': 'Buyer',
    });
    expect(txn['ram:ApplicableHeaderTradeSettlement']['ram:InvoiceCurrencyCode']).toBe('EUR');
    expect(result['rsm:CrossIndustryInvoice']['rsm:ExchangedDocument']['ram:ID']).toBe('INV-1');
  });

  it('passes through arbitrary Leitweg-ID values unchanged (no trim / case fold)', () => {
    const doc = makeBareCiiDoc();
    const raw = '  04011000-1234512345-06  ';
    const result = embedLeitwegIdIntoCii(doc, raw);
    const agreement =
      result['rsm:CrossIndustryInvoice']['rsm:SupplyChainTradeTransaction'][
        'ram:ApplicableHeaderTradeAgreement'
      ];
    // Helper is a pure structural insert — upstream (Plan 04 resolver) owns
    // normalisation. If it hands us whitespace we persist it verbatim so
    // downstream validation surfaces the bug rather than silently masking it.
    expect(agreement['ram:BuyerReference']).toBe(raw);
  });
});
