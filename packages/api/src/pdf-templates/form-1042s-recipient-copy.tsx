// Recipient copy for Form 1042-S — a substitute (black-ink) form per IRS
// Publication 1179. This is the recipient's copy ONLY; the IRS copy goes via the
// IRIS XML e-file (Pub 1187), never a rendered PDF.
//
// Rendered from the stored immutable Form1042S snapshot ("values as filed"),
// never a live recompute. The recipient foreign TIN (FTIN) is shown last-4 only
// — a full FTIN never reaches this document. Figures ship with an adviser-verify
// footnote (jurisdiction tax-adviser sign-off before production filing).
// Structure mirrors the in-tree react-pdf templates (form-1099-nec-copy-b).

import { Document, Page, StyleSheet, Text, View } from '@react-pdf/renderer';

export const TEMPLATE_VERSION = 1 as const;
export const RENDERER_SLUG = 'form-1042s-recipient-copy' as const;

const ADVISER_VERIFY_FOOTNOTE =
  'This substitute Form 1042-S is generated for recordkeeping and requires jurisdiction-specific tax-adviser verification before production filing. Not legal or tax advice.';

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
  row: {
    flexDirection: 'row',
    marginTop: 12,
    gap: 8,
  },
  box: {
    flex: 1,
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
  boxValueSmall: {
    fontSize: 10,
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

export interface Form1042SRecipientCopyProps {
  taxYear: number;
  payerName: string;
  recipientName: string;
  /** Recipient FTIN last-4 ONLY — a full foreign TIN must never be passed here. */
  recipientFtinLast4: string;
  /** i1042-S income code (box 1a). */
  box1IncomeCode: string;
  /** Box 2 gross income, USD minor units. */
  box2GrossIncomeMinor: number;
  /** Box 3b chapter-3 withholding rate in basis points (1500 = 15.00%). */
  box3bChap3RateBp: number;
  /** Box 7 federal tax withheld, USD minor units. */
  box7FederalTaxWithheldMinor: number;
  /** Box 3a chapter-3 exemption code. */
  box3aChap3ExemptionCode?: string | null;
  /** Box 13j recipient chapter-3 status code. */
  recipientChap3StatusCode?: string | null;
  /** Box 13k recipient chapter-4 status code. */
  recipientChap4StatusCode?: string | null;
  /** Box 13n limitation-on-benefits code. */
  recipientLobCode?: string | null;
  /** Treaty article claimed (box 3b basis); null when statutory. */
  treatyArticle?: string | null;
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

/** Format a basis-point rate as a percent string (1500 -> "15.00%"). */
function formatRateBp(rateBp: number): string {
  return `${(rateBp / 100).toFixed(2)}%`;
}

/** Masked foreign TIN: only the last four characters are ever shown. */
function maskedFtin(last4: string): string {
  return `••••${last4}`;
}

function dashIfEmpty(value: string | null | undefined): string {
  return value && value.length > 0 ? value : '—';
}

/**
 * Recipient copy for Form 1042-S (substitute, Pub 1179). Pass the figures from
 * the stored immutable snapshot. Returns a react-pdf Document element; render via
 * `renderToBuffer`.
 */
export function Form1042SRecipientCopyDocument(props: Form1042SRecipientCopyProps) {
  const {
    taxYear,
    payerName,
    recipientName,
    recipientFtinLast4,
    box1IncomeCode,
    box2GrossIncomeMinor,
    box3bChap3RateBp,
    box7FederalTaxWithheldMinor,
    box3aChap3ExemptionCode,
    recipientChap3StatusCode,
    recipientChap4StatusCode,
    recipientLobCode,
    treatyArticle,
    currency,
  } = props;

  return (
    <Document title={`Form 1042-S Recipient Copy — ${taxYear}`}>
      <Page size="A4" style={styles.page} wrap>
        <View style={styles.header}>
          <Text style={styles.formTitle}>Form 1042-S</Text>
          <Text style={styles.formSubtitle}>
            Foreign Person's U.S. Source Income Subject to Withholding — Tax Year {taxYear}
          </Text>
          <Text style={styles.copyLabel}>Copy for Recipient</Text>
        </View>

        <View style={styles.party}>
          <Text style={styles.partyLabel}>WITHHOLDING AGENT / PAYER</Text>
          <Text style={styles.partyValue}>{payerName}</Text>
        </View>

        <View style={styles.party}>
          <Text style={styles.partyLabel}>RECIPIENT</Text>
          <Text style={styles.partyValue}>{recipientName}</Text>
          <Text style={styles.partyLabel}>Recipient FTIN</Text>
          <Text style={styles.partyValue}>{maskedFtin(recipientFtinLast4)}</Text>
        </View>

        <View style={styles.row}>
          <View style={styles.box}>
            <Text style={styles.boxLabel}>Box 1a — Income code</Text>
            <Text style={styles.boxValue}>{dashIfEmpty(box1IncomeCode)}</Text>
          </View>
          <View style={styles.box}>
            <Text style={styles.boxLabel}>Box 2 — Gross income</Text>
            <Text style={styles.boxValue}>{formatAmount(box2GrossIncomeMinor, currency)}</Text>
          </View>
        </View>

        <View style={styles.row}>
          <View style={styles.box}>
            <Text style={styles.boxLabel}>Box 3a — Ch.3 exemption code</Text>
            <Text style={styles.boxValueSmall}>{dashIfEmpty(box3aChap3ExemptionCode)}</Text>
          </View>
          <View style={styles.box}>
            <Text style={styles.boxLabel}>Box 3b — Ch.3 withholding rate</Text>
            <Text style={styles.boxValue}>{formatRateBp(box3bChap3RateBp)}</Text>
          </View>
          <View style={styles.box}>
            <Text style={styles.boxLabel}>Box 7 — Federal tax withheld</Text>
            <Text style={styles.boxValue}>
              {formatAmount(box7FederalTaxWithheldMinor, currency)}
            </Text>
          </View>
        </View>

        <View style={styles.row}>
          <View style={styles.box}>
            <Text style={styles.boxLabel}>Box 13j — Recipient ch.3 status</Text>
            <Text style={styles.boxValueSmall}>{dashIfEmpty(recipientChap3StatusCode)}</Text>
          </View>
          <View style={styles.box}>
            <Text style={styles.boxLabel}>Box 13k — Recipient ch.4 status</Text>
            <Text style={styles.boxValueSmall}>{dashIfEmpty(recipientChap4StatusCode)}</Text>
          </View>
          <View style={styles.box}>
            <Text style={styles.boxLabel}>Box 13n — Limitation on benefits</Text>
            <Text style={styles.boxValueSmall}>{dashIfEmpty(recipientLobCode)}</Text>
          </View>
        </View>

        <View style={styles.box}>
          <Text style={styles.boxLabel}>Treaty article claimed (Box 3b basis)</Text>
          <Text style={styles.boxValueSmall}>{dashIfEmpty(treatyArticle)}</Text>
        </View>

        <Text style={styles.footnote}>{ADVISER_VERIFY_FOOTNOTE}</Text>
      </Page>
    </Document>
  );
}
