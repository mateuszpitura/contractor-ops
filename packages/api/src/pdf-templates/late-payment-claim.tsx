// packages/api/src/pdf-templates/late-payment-claim.tsx
//
// Phase 63 · Plan 05 · D-17 — React-PDF template for LPCDA claim letter.
// Follows the same pattern as ir35-sds.tsx — same design tokens, same structure.
//
// Contract:
// - All amounts in minor units (pence); formatted via formatGbp helper.
// - Locked statutory phrases from @contractor-ops/validators/legal/gb.
// - NEVER imports live calculation functions — receives snapshot data only.

import {
  LPCDA_CLAIM_FOOTER,
  LPCDA_COMPENSATION_LABEL,
  LPCDA_SECTION_REF,
  LPCDA_STATUTORY_RATE_LABEL,
} from '@contractor-ops/validators';
import { Document, Page, StyleSheet, Text, View } from '@react-pdf/renderer';

export const TEMPLATE_VERSION = 1 as const;
export const RENDERER_SLUG = 'late-payment-claim' as const;

// ---------------------------------------------------------------------------
// Colour tokens — mirror ir35-sds.tsx palette
// ---------------------------------------------------------------------------

const TEAL_ACCENT = '#0d7f72';
const GREY_BODY = '#1f2937';
const GREY_MUTED = '#6b7280';
const GREY_RULE = '#d1d5db';

const styles = StyleSheet.create({
  page: {
    fontFamily: 'Helvetica',
    fontSize: 10,
    lineHeight: 1.5,
    color: GREY_BODY,
    padding: 56,
    paddingBottom: 72,
  },
  header: {
    marginBottom: 24,
    borderBottom: `1px solid ${GREY_RULE}`,
    paddingBottom: 12,
  },
  title: {
    fontSize: 20,
    fontWeight: 'bold',
    color: TEAL_ACCENT,
    marginBottom: 4,
  },
  subtitle: {
    fontSize: 9,
    color: GREY_MUTED,
  },
  dateLine: {
    fontSize: 10,
    color: GREY_BODY,
    marginTop: 16,
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: 13,
    fontWeight: 'bold',
    color: GREY_BODY,
    marginTop: 20,
    marginBottom: 8,
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 4,
    borderBottom: `1px solid ${GREY_RULE}`,
  },
  rowLabel: {
    fontSize: 10,
    color: GREY_BODY,
    flex: 1,
  },
  rowValue: {
    fontSize: 10,
    color: GREY_BODY,
    fontWeight: 'bold',
    textAlign: 'right',
    width: 120,
  },
  totalRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 8,
    marginTop: 4,
    borderTop: `2px solid ${TEAL_ACCENT}`,
  },
  totalLabel: {
    fontSize: 12,
    fontWeight: 'bold',
    color: GREY_BODY,
    flex: 1,
  },
  totalValue: {
    fontSize: 12,
    fontWeight: 'bold',
    color: TEAL_ACCENT,
    textAlign: 'right',
    width: 120,
  },
  legalBlock: {
    marginTop: 32,
    padding: 16,
    border: `1px solid ${GREY_RULE}`,
    borderRadius: 4,
  },
  legalTitle: {
    fontSize: 10,
    fontWeight: 'bold',
    color: GREY_BODY,
    marginBottom: 6,
  },
  legalBody: {
    fontSize: 9,
    color: GREY_BODY,
    lineHeight: 1.55,
  },
  footer: {
    position: 'absolute',
    bottom: 36,
    left: 56,
    right: 56,
    fontSize: 8,
    color: GREY_MUTED,
    textAlign: 'center',
    borderTop: `1px solid ${GREY_RULE}`,
    paddingTop: 8,
  },
  pageNumber: {
    position: 'absolute',
    bottom: 36,
    right: 56,
    fontSize: 8,
    color: GREY_MUTED,
  },
});

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

export interface LatePaymentClaimProps {
  organizationName: string;
  invoiceNumber: string;
  invoiceDueDate: Date;
  daysOverdue: number;
  principalOutstandingMinor: number;
  rateUsed: number;
  dailyInterestMinor: number;
  accruedInterestMinor: number;
  compensationTierMinor: number;
  totalClaimMinor: number;
  claimedAt: Date;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function formatGbp(minor: number): string {
  const pounds = (minor / 100).toFixed(2);
  return `£${pounds}`;
}

function formatDate(d: Date): string {
  return d.toISOString().slice(0, 10);
}

function renderPageNumber({ pageNumber, totalPages }: { pageNumber: number; totalPages: number }) {
  return `${pageNumber} / ${totalPages}`;
}

// ---------------------------------------------------------------------------
// Template
// ---------------------------------------------------------------------------

export function LatePaymentClaimTemplate(props: LatePaymentClaimProps) {
  const {
    organizationName,
    invoiceNumber,
    invoiceDueDate,
    daysOverdue,
    principalOutstandingMinor,
    rateUsed,
    dailyInterestMinor,
    accruedInterestMinor,
    compensationTierMinor,
    totalClaimMinor,
    claimedAt,
  } = props;

  const claimedAtLabel = formatDate(claimedAt);

  return (
    <Document title={`Statutory Late Payment Interest Claim — ${invoiceNumber}`}>
      <Page size="A4" style={styles.page} wrap>
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.title}>Statutory Late Payment Interest Claim</Text>
          <Text style={styles.subtitle}>
            Issued by {organizationName} under {LPCDA_SECTION_REF}
          </Text>
        </View>

        {/* Date */}
        <Text style={styles.dateLine}>Date: {claimedAtLabel}</Text>

        {/* Invoice details */}
        <Text style={styles.sectionTitle}>Original Invoice</Text>
        <View style={styles.row}>
          <Text style={styles.rowLabel}>Invoice reference</Text>
          <Text style={styles.rowValue}>{invoiceNumber}</Text>
        </View>
        <View style={styles.row}>
          <Text style={styles.rowLabel}>Due date</Text>
          <Text style={styles.rowValue}>{formatDate(invoiceDueDate)}</Text>
        </View>
        <View style={styles.row}>
          <Text style={styles.rowLabel}>Days overdue</Text>
          <Text style={styles.rowValue}>{daysOverdue}</Text>
        </View>
        <View style={styles.row}>
          <Text style={styles.rowLabel}>Principal outstanding</Text>
          <Text style={styles.rowValue}>{formatGbp(principalOutstandingMinor)}</Text>
        </View>

        {/* Interest calculation */}
        <Text style={styles.sectionTitle}>Interest Calculation</Text>
        <View style={styles.row}>
          <Text style={styles.rowLabel}>Rate applied ({LPCDA_STATUTORY_RATE_LABEL})</Text>
          <Text style={styles.rowValue}>{rateUsed.toFixed(2)}%</Text>
        </View>
        <View style={styles.row}>
          <Text style={styles.rowLabel}>Daily accrual</Text>
          <Text style={styles.rowValue}>{formatGbp(dailyInterestMinor)}</Text>
        </View>
        <View style={styles.row}>
          <Text style={styles.rowLabel}>Total interest accrued</Text>
          <Text style={styles.rowValue}>{formatGbp(accruedInterestMinor)}</Text>
        </View>

        {/* Compensation */}
        <Text style={styles.sectionTitle}>Fixed Compensation</Text>
        <View style={styles.row}>
          <Text style={styles.rowLabel}>{LPCDA_COMPENSATION_LABEL}</Text>
          <Text style={styles.rowValue}>{formatGbp(compensationTierMinor)}</Text>
        </View>

        {/* Total claim */}
        <View style={styles.totalRow}>
          <Text style={styles.totalLabel}>Total statutory claim</Text>
          <Text style={styles.totalValue}>{formatGbp(totalClaimMinor)}</Text>
        </View>

        {/* Legal references */}
        <View style={styles.legalBlock}>
          <Text style={styles.legalTitle}>Statutory basis</Text>
          <Text style={styles.legalBody}>{LPCDA_CLAIM_FOOTER}</Text>
        </View>

        {/* Footer */}
        <Text style={styles.footer} fixed>
          Late Payment Interest Claim · {organizationName} · {claimedAtLabel}
        </Text>
        <Text style={styles.pageNumber} fixed render={renderPageNumber} />
      </Page>
    </Document>
  );
}
