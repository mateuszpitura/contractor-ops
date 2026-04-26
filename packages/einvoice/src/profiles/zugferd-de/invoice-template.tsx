// Phase 62 · Plan 62-03 Task 4 — React-PDF visual invoice template.
//
// Renders the human-readable portion of a ZUGFeRD hybrid PDF. The machine-
// readable CII XML is attached separately by `pdf-wrapper.ts`. This
// template embeds Noto Sans Regular + Bold via `Font.register` so the
// resulting PDF is fully font-embedded (required for PDF/A-3 conformance)
// without relying on @react-pdf/renderer's default Helvetica-std, which
// is Type1 and not embedded.
//
// Typography pinned to 62-UI-SPEC.md:
//   * Body: 13–14pt Noto Sans Regular
//   * Heading: 18pt Noto Sans Bold
//   * Meta / totals: tabular-nums via explicit monospace-align table layout
//
// Statutory copy (Kleinunternehmer §19 UStG, reverse charge §13b UStG)
// comes from `@contractor-ops/validators` locked-phrase constants — any
// drift there is a locked-phrases guard violation + Phase-56 break.

import { fileURLToPath } from 'node:url';

import { Document, Font, Page, renderToBuffer, StyleSheet, Text, View } from '@react-pdf/renderer';

import type { EInvoice, EInvoiceLine, EInvoiceTaxSubtotal } from '../../types/invoice.js';

// ---------------------------------------------------------------------------
// Font registration — module-scope one-shot.
//
// @react-pdf/font 4.x accepts a filesystem path string (routed through
// `fontkit.open`) or a data URL. A raw Buffer / Uint8Array is NOT accepted
// (silent crash in FontSource._load:isDataUrl). Pass filesystem paths so
// fontkit reads + parses the TTF lazily — also avoids holding ~1.1MB of
// font bytes in module scope.
// ---------------------------------------------------------------------------

const FONT_REG_PATH = fileURLToPath(new URL('./assets/NotoSans-Regular.ttf', import.meta.url));
const FONT_BOLD_PATH = fileURLToPath(new URL('./assets/NotoSans-Bold.ttf', import.meta.url));

Font.register({
  family: 'Noto Sans',
  fonts: [
    { src: FONT_REG_PATH, fontWeight: 'normal' },
    { src: FONT_BOLD_PATH, fontWeight: 'bold' },
  ],
});

// ---------------------------------------------------------------------------
// Locked statutory phrases — mirror of @contractor-ops/validators/legal/de.
// A reverse workspace dep would create a cycle (validators depends on
// einvoice zatca re-exports), so we pin copies here. Locked-phrases guard
// test (packages/validators/src/__tests__/locked-phrases-guard.test.ts)
// enforces byte-equality.
// ---------------------------------------------------------------------------

const LOCKED_KLEINUNTERNEHMER_NOTICE =
  'Gemäß § 19 UStG wird keine Umsatzsteuer ausgewiesen' as const;
const LOCKED_REVERSE_CHARGE_NOTICE = 'Steuerschuldnerschaft des Leistungsempfängers' as const;

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------

const COLOR_BODY = '#1f2937';
const COLOR_MUTED = '#6b7280';
const COLOR_RULE = '#d1d5db';
const COLOR_ACCENT = '#0d7f72';

const styles = StyleSheet.create({
  page: {
    fontFamily: 'Noto Sans',
    fontSize: 11,
    lineHeight: 1.4,
    color: COLOR_BODY,
    paddingTop: 56,
    paddingBottom: 72,
    paddingHorizontal: 56,
  },
  header: {
    borderBottomWidth: 1,
    borderBottomColor: COLOR_RULE,
    paddingBottom: 12,
    marginBottom: 18,
  },
  title: {
    fontSize: 18,
    fontWeight: 'bold',
    color: COLOR_ACCENT,
    marginBottom: 4,
  },
  subtitle: { fontSize: 9, color: COLOR_MUTED },
  parties: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 18,
  },
  partyBlock: { width: '48%' },
  partyLabel: {
    fontSize: 9,
    color: COLOR_MUTED,
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginBottom: 4,
  },
  partyName: { fontSize: 13, fontWeight: 'bold', marginBottom: 2 },
  partyLine: { fontSize: 10, color: COLOR_BODY },
  metaGrid: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 18,
    paddingVertical: 8,
    borderTopWidth: 1,
    borderBottomWidth: 1,
    borderColor: COLOR_RULE,
  },
  metaCell: { flexDirection: 'column' },
  metaLabel: {
    fontSize: 8,
    color: COLOR_MUTED,
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  metaValue: { fontSize: 11, fontWeight: 'bold' },
  // Line items table
  table: { marginBottom: 18 },
  row: {
    flexDirection: 'row',
    paddingVertical: 6,
    borderBottomWidth: 0.5,
    borderBottomColor: COLOR_RULE,
  },
  headerRow: { backgroundColor: '#f3f4f6', fontWeight: 'bold' },
  cellDesc: { width: '48%', paddingRight: 8 },
  cellQty: { width: '10%', textAlign: 'right' },
  cellUnit: { width: '14%', textAlign: 'right' },
  cellVat: { width: '10%', textAlign: 'right' },
  cellNet: { width: '18%', textAlign: 'right' },
  totals: {
    alignSelf: 'flex-end',
    width: '45%',
    marginBottom: 18,
  },
  totalRow: { flexDirection: 'row', justifyContent: 'space-between' },
  totalLabel: { color: COLOR_MUTED },
  totalValue: { fontWeight: 'normal' },
  grossRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingTop: 6,
    borderTopWidth: 1,
    borderTopColor: COLOR_BODY,
  },
  grossLabel: { fontWeight: 'bold' },
  grossValue: { fontWeight: 'bold' },
  footer: { marginTop: 24 },
  footerLabel: {
    fontSize: 9,
    color: COLOR_MUTED,
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginBottom: 4,
  },
  footerNote: { fontSize: 10, marginBottom: 4 },
  statutoryNote: {
    marginTop: 12,
    paddingTop: 8,
    borderTopWidth: 0.5,
    borderTopColor: COLOR_RULE,
    fontSize: 9,
    color: COLOR_MUTED,
  },
});

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Convert integer minor-units to a 2-decimal currency string. */
function fmtMinor(minor: number | undefined, currency: string): string {
  if (minor === undefined || !Number.isFinite(minor)) return '—';
  const negative = minor < 0;
  const abs = Math.abs(minor).toString().padStart(3, '0');
  const whole = abs.slice(0, -2);
  const frac = abs.slice(-2);
  const sign = negative ? '-' : '';
  return `${sign}${whole}.${frac} ${currency}`;
}

function fmtQty(q: number | undefined): string {
  if (q === undefined) return '1';
  if (Number.isInteger(q)) return q.toString();
  return q.toFixed(2);
}

function fmtVatRate(rate: string | undefined): string {
  if (!rate) return '—';
  return `${rate}%`;
}

function isKleinunternehmer(invoice: EInvoice): boolean {
  // Either extensions.kleinunternehmer OR any tax row with category 'E' + rate 0.
  const ext = (invoice.extensions ?? {}) as Record<string, unknown>;
  if (ext.kleinunternehmer === true) return true;
  return invoice.taxBreakdown.some(
    t => t.taxCategory === 'E' && (t.percent === 0 || t.taxAmountMinor === 0),
  );
}

function isReverseCharge(invoice: EInvoice): boolean {
  const ext = (invoice.extensions ?? {}) as Record<string, unknown>;
  if (ext.isReverseCharge === true) return true;
  return invoice.taxBreakdown.some(t => t.taxCategory === 'AE');
}

function supplierLeitwegId(invoice: EInvoice): string | null {
  const ext = (invoice.extensions ?? {}) as Record<string, unknown>;
  if (typeof ext.supplierLeitwegId === 'string') return ext.supplierLeitwegId;
  return null;
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

interface PartyProps {
  label: string;
  party: EInvoice['supplier'];
  leitwegId?: string | null;
}

function PartyBlock({ label, party, leitwegId }: PartyProps) {
  return (
    <View style={styles.partyBlock}>
      <Text style={styles.partyLabel}>{label}</Text>
      <Text style={styles.partyName}>{party.name}</Text>
      {party.address ? <Text style={styles.partyLine}>{party.address}</Text> : null}
      {party.country ? <Text style={styles.partyLine}>{party.country}</Text> : null}
      <Text style={styles.partyLine}>VAT ID: {party.id}</Text>
      {leitwegId ? <Text style={styles.partyLine}>Leitweg-ID: {leitwegId}</Text> : null}
    </View>
  );
}

function LineItemsTable({ lines, currency }: { lines: EInvoiceLine[]; currency: string }) {
  return (
    <View style={styles.table}>
      <View style={[styles.row, styles.headerRow]}>
        <Text style={styles.cellDesc}>Description</Text>
        <Text style={styles.cellQty}>Qty</Text>
        <Text style={styles.cellUnit}>Unit</Text>
        <Text style={styles.cellVat}>VAT</Text>
        <Text style={styles.cellNet}>Net</Text>
      </View>
      {lines.map(line => (
        <View key={line.lineNumber} style={styles.row}>
          <Text style={styles.cellDesc}>{line.description}</Text>
          <Text style={styles.cellQty}>{fmtQty(line.quantity)}</Text>
          <Text style={styles.cellUnit}>{fmtMinor(line.unitPriceMinor, currency)}</Text>
          <Text style={styles.cellVat}>{fmtVatRate(line.vatRate)}</Text>
          <Text style={styles.cellNet}>{fmtMinor(line.netAmountMinor, currency)}</Text>
        </View>
      ))}
    </View>
  );
}

function TotalsBlock({ invoice }: { invoice: EInvoice }) {
  const { currencyCode, taxExclusiveAmount, taxInclusiveAmount } = invoice;
  return (
    <View style={styles.totals}>
      <View style={styles.totalRow}>
        <Text style={styles.totalLabel}>Net subtotal</Text>
        <Text style={styles.totalValue}>{fmtMinor(taxExclusiveAmount, currencyCode)}</Text>
      </View>
      {invoice.taxBreakdown.map((t: EInvoiceTaxSubtotal) => (
        <View key={t.taxCategory + '-' + (t.percent ?? 'x')} style={styles.totalRow}>
          <Text style={styles.totalLabel}>
            VAT {t.taxCategory}
            {t.percent === undefined ? '' : ` (${t.percent}%)`}
          </Text>
          <Text style={styles.totalValue}>{fmtMinor(t.taxAmountMinor, currencyCode)}</Text>
        </View>
      ))}
      <View style={styles.grossRow}>
        <Text style={styles.grossLabel}>Gross total</Text>
        <Text style={styles.grossValue}>{fmtMinor(taxInclusiveAmount, currencyCode)}</Text>
      </View>
    </View>
  );
}

// ---------------------------------------------------------------------------
// Document root
// ---------------------------------------------------------------------------

export interface InvoiceTemplateProps {
  invoice: EInvoice;
}

export function InvoiceDocument({ invoice }: InvoiceTemplateProps) {
  const leitwegId = supplierLeitwegId(invoice);
  const klein = isKleinunternehmer(invoice);
  const reverseCharge = isReverseCharge(invoice);
  return (
    <Document
      title={`Invoice ${invoice.id}`}
      producer="@contractor-ops/einvoice 5.0"
      creator="@contractor-ops/einvoice 5.0"
      language="de">
      <Page size="A4" style={styles.page}>
        <View style={styles.header}>
          <Text style={styles.title}>Invoice {invoice.id}</Text>
          <Text style={styles.subtitle}>
            Issued {invoice.issueDate}
            {invoice.dueDate ? `  ·  Due ${invoice.dueDate}` : ''}
            {`  ·  ${invoice.currencyCode}`}
          </Text>
        </View>

        <View style={styles.parties}>
          <PartyBlock label="From" party={invoice.supplier} leitwegId={leitwegId} />
          <PartyBlock label="To" party={invoice.customer} />
        </View>

        <View style={styles.metaGrid}>
          <View style={styles.metaCell}>
            <Text style={styles.metaLabel}>Invoice number</Text>
            <Text style={styles.metaValue}>{invoice.id}</Text>
          </View>
          <View style={styles.metaCell}>
            <Text style={styles.metaLabel}>Issue date</Text>
            <Text style={styles.metaValue}>{invoice.issueDate}</Text>
          </View>
          {invoice.dueDate ? (
            <View style={styles.metaCell}>
              <Text style={styles.metaLabel}>Due date</Text>
              <Text style={styles.metaValue}>{invoice.dueDate}</Text>
            </View>
          ) : null}
          <View style={styles.metaCell}>
            <Text style={styles.metaLabel}>Currency</Text>
            <Text style={styles.metaValue}>{invoice.currencyCode}</Text>
          </View>
        </View>

        <LineItemsTable lines={invoice.lines} currency={invoice.currencyCode} />
        <TotalsBlock invoice={invoice} />

        {invoice.paymentMeans ? (
          <View style={styles.footer}>
            <Text style={styles.footerLabel}>Payment</Text>
            {invoice.paymentMeans.dueDate ? (
              <Text style={styles.footerNote}>Due by {invoice.paymentMeans.dueDate}</Text>
            ) : null}
            {invoice.paymentMeans.bankAccount ? (
              <Text style={styles.footerNote}>
                Bank: {invoice.paymentMeans.bankName ?? ''} · {invoice.paymentMeans.bankAccount}
              </Text>
            ) : null}
            {invoice.paymentMeans.paymentReference ? (
              <Text style={styles.footerNote}>
                Reference: {invoice.paymentMeans.paymentReference}
              </Text>
            ) : null}
          </View>
        ) : null}

        {klein ? <Text style={styles.statutoryNote}>{LOCKED_KLEINUNTERNEHMER_NOTICE}.</Text> : null}
        {reverseCharge ? (
          <Text style={styles.statutoryNote}>{LOCKED_REVERSE_CHARGE_NOTICE}.</Text>
        ) : null}
      </Page>
    </Document>
  );
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Render an EInvoice to a visual-only PDF (no CII XML attached yet) as a
 * `Uint8Array`. The caller is expected to run the result through
 * `wrapToPdfA3` to produce the final ZUGFeRD-compliant PDF/A-3 document.
 */
export async function renderInvoiceToPdfBuffer(invoice: EInvoice): Promise<Uint8Array> {
  const buffer = await renderToBuffer(<InvoiceDocument invoice={invoice} />);
  // renderToBuffer returns a Buffer (Node) or Uint8Array depending on env;
  // normalise to a plain Uint8Array to keep downstream consumers simple.
  return buffer instanceof Uint8Array
    ? new Uint8Array(buffer.buffer, buffer.byteOffset, buffer.byteLength)
    : new Uint8Array(buffer);
}
