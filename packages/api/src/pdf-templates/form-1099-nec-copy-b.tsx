// Recipient Copy B for Form 1099-NEC — a substitute (black-ink) form per
// IRS Publication 1179 §4.6. This is the recipient's copy ONLY; the IRS Copy A
// goes via the IRIS XML e-file, never a rendered PDF (a scannable red-ink Copy A
// is irrelevant when e-filing).
//
// Rendered from the stored immutable Form1099Nec snapshot ("values as filed"),
// never a live recompute. The recipient TIN is shown last-4 only (Pub 1179
// masking) — a full SSN/TIN never reaches this document. Figures ship with an
// adviser-verify footnote (jurisdiction tax-adviser sign-off before production
// filing). Structure mirrors the in-tree react-pdf templates (ir35-sds,
// late-payment-claim).

import { Document, Page, StyleSheet, Text, View } from '@react-pdf/renderer';

export const TEMPLATE_VERSION = 1 as const;
export const RENDERER_SLUG = 'form-1099-nec-copy-b' as const;

const ADVISER_VERIFY_FOOTNOTE =
  'This substitute form is generated for recordkeeping and requires jurisdiction-specific tax-adviser verification before production filing. Not legal or tax advice.';

const INK_BLACK = '#000000';
const GREY_RULE = '#000000';
const GREY_MUTED = '#333333';

const styles = StyleSheet.create({
  page: {
    fontFamily: 'Helvetica',
    fontSize: 9,
    lineHeight: 1.4,
    color: INK_BLACK,
    padding: 48,
  },
  header: {
    marginBottom: 16,
    borderBottom: `2px solid ${GREY_RULE}`,
    paddingBottom: 8,
  },
  formTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: INK_BLACK,
  },
  formSubtitle: {
    fontSize: 9,
    color: GREY_MUTED,
    marginTop: 2,
  },
  copyLabel: {
    fontSize: 11,
    fontWeight: 'bold',
    marginTop: 4,
  },
  party: {
    marginTop: 12,
  },
  partyLabel: {
    fontSize: 8,
    color: GREY_MUTED,
  },
  partyValue: {
    fontSize: 11,
    fontWeight: 'bold',
  },
  box: {
    marginTop: 12,
    border: `1px solid ${GREY_RULE}`,
    padding: 8,
  },
  boxLabel: {
    fontSize: 8,
    color: GREY_MUTED,
  },
  boxValue: {
    fontSize: 13,
    fontWeight: 'bold',
  },
  footnote: {
    marginTop: 24,
    fontSize: 7,
    color: GREY_MUTED,
    borderTop: `1px solid ${GREY_RULE}`,
    paddingTop: 6,
  },
});

export interface Form1099NecCopyBProps {
  taxYear: number;
  payerName: string;
  recipientName: string;
  /** Recipient TIN last-4 ONLY — a full SSN/TIN must never be passed here. */
  recipientTinLast4: string;
  box1AmountMinor: number;
  box4BackupWithholdingMinor: number;
  currency: string;
}

/** Format a USD-minor-unit amount as a grouped decimal string ($x,xxx.xx). */
function formatAmount(minor: number, currency: string): string {
  const major = minor / 100;
  const grouped = major.toLocaleString('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
  return `${currency} ${grouped}`;
}

/** IRS-style masked TIN: only the last four digits are ever shown. */
function maskedTin(last4: string): string {
  return `XXX-XX-${last4}`;
}

/**
 * Recipient Copy B for Form 1099-NEC (substitute, Pub 1179 §4.6). Pass the
 * figures from the stored immutable snapshot. Returns a react-pdf Document
 * element; render via `renderToBuffer`.
 */
export function Form1099NecCopyBDocument(props: Form1099NecCopyBProps) {
  const {
    taxYear,
    payerName,
    recipientName,
    recipientTinLast4,
    box1AmountMinor,
    box4BackupWithholdingMinor,
    currency,
  } = props;

  return (
    <Document title={`Form 1099-NEC Copy B — ${taxYear}`}>
      <Page size="A4" style={styles.page} wrap>
        <View style={styles.header}>
          <Text style={styles.formTitle}>Form 1099-NEC</Text>
          <Text style={styles.formSubtitle}>Nonemployee Compensation — Tax Year {taxYear}</Text>
          <Text style={styles.copyLabel}>Copy B — For Recipient</Text>
        </View>

        <View style={styles.party}>
          <Text style={styles.partyLabel}>PAYER</Text>
          <Text style={styles.partyValue}>{payerName}</Text>
        </View>

        <View style={styles.party}>
          <Text style={styles.partyLabel}>RECIPIENT</Text>
          <Text style={styles.partyValue}>{recipientName}</Text>
          <Text style={styles.partyLabel}>Recipient TIN</Text>
          <Text style={styles.partyValue}>{maskedTin(recipientTinLast4)}</Text>
        </View>

        <View style={styles.box}>
          <Text style={styles.boxLabel}>Box 1 — Nonemployee compensation</Text>
          <Text style={styles.boxValue}>{formatAmount(box1AmountMinor, currency)}</Text>
        </View>

        <View style={styles.box}>
          <Text style={styles.boxLabel}>
            Box 4 — Federal income tax withheld (backup withholding)
          </Text>
          <Text style={styles.boxValue}>{formatAmount(box4BackupWithholdingMinor, currency)}</Text>
        </View>

        <Text style={styles.footnote}>{ADVISER_VERIFY_FOOTNOTE}</Text>
      </Page>
    </Document>
  );
}
