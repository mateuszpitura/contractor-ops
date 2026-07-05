// Shared react-pdf layout for the v7.0 statutory termination-certificate subset.
//
// Every cert is a DRAFT: a prominent status band + a fixed adviser-verify
// disclaimer footer render on each page so the document can never read as
// adviser-approved. Templates read ONLY from the immutable snapshot (never live
// constants) and pass a STABLE `renderedAt` so the rendered bytes are stable.

import { Document, Page, StyleSheet, Text, View } from '@react-pdf/renderer';

/** Immutable snapshot a cert renders from — values as of generation. National
 * identifiers are reduced to `*Last4` only; a full pesel/ssn/nino never appears. */
export interface CertRenderSnapshot {
  certType: string;
  jurisdiction: string;
  employerName: string;
  employeeName: string;
  peselLast4?: string;
  ssnLast4?: string;
  ninoLast4?: string;
  employmentFrom?: string;
  employmentTo?: string;
  /** Stable render instant for byte stability (never Date.now()). */
  renderedAt: string;
  [key: string]: unknown;
}

export interface CertFieldRow {
  label: string;
  value: string;
}

const INK = '#1f2937';
const MUTED = '#6b7280';
const RULE = '#d1d5db';
const DRAFT_BG = '#b45309';

const styles = StyleSheet.create({
  page: {
    fontFamily: 'Helvetica',
    fontSize: 10,
    lineHeight: 1.5,
    color: INK,
    padding: 48,
    paddingBottom: 96,
  },
  draftBand: {
    backgroundColor: DRAFT_BG,
    color: '#ffffff',
    fontSize: 9,
    fontWeight: 'bold',
    textAlign: 'center',
    paddingVertical: 5,
    paddingHorizontal: 8,
    marginBottom: 20,
    borderRadius: 3,
  },
  title: { fontSize: 18, fontWeight: 'bold', color: INK, marginBottom: 2 },
  subtitle: { fontSize: 9, color: MUTED, marginBottom: 16 },
  row: {
    flexDirection: 'row',
    borderBottom: `1px solid ${RULE}`,
    paddingVertical: 5,
  },
  label: { width: '42%', color: MUTED },
  value: { width: '58%', color: INK },
  footer: {
    position: 'absolute',
    bottom: 32,
    left: 48,
    right: 48,
    borderTop: `1px solid ${RULE}`,
    paddingTop: 8,
  },
  disclaimer: { fontSize: 7.5, color: DRAFT_BG, lineHeight: 1.4 },
  meta: { fontSize: 7, color: MUTED, marginTop: 4 },
});

export interface StatutoryCertShellProps {
  title: string;
  subtitle: string;
  disclaimer: string;
  rows: CertFieldRow[];
  renderedAt: string;
  rendererSlug: string;
  templateVersion: number;
}

export function StatutoryCertShell(props: StatutoryCertShellProps) {
  const { title, subtitle, disclaimer, rows, renderedAt, rendererSlug, templateVersion } = props;
  return (
    <Document>
      <Page size="A4" style={styles.page}>
        <View style={styles.draftBand} fixed>
          <Text>DRAFT — NOT ADVISER-VERIFIED</Text>
        </View>
        <Text style={styles.title}>{title}</Text>
        <Text style={styles.subtitle}>{subtitle}</Text>
        {rows.map(row => (
          <View style={styles.row} key={row.label}>
            <Text style={styles.label}>{row.label}</Text>
            <Text style={styles.value}>{row.value}</Text>
          </View>
        ))}
        <View style={styles.footer} fixed>
          <Text style={styles.disclaimer}>{disclaimer}</Text>
          <Text style={styles.meta}>
            {`${rendererSlug} v${templateVersion} · generated ${renderedAt}`}
          </Text>
        </View>
      </Page>
    </Document>
  );
}
