import { Document, Image, Page, StyleSheet, Text, View } from '@react-pdf/renderer';

interface WhtCertificateData {
  certificateNumber: string;
  organizationName: string;
  organizationTaxId: string | null;
  organizationCountry: string;
  contractorName: string;
  contractorTaxId: string | null;
  contractorResidency: string;
  paymentDate: Date;
  grossAmountMinor: number;
  whtRate: number;
  whtAmountMinor: number;
  netAmountMinor: number;
  currency: string;
  treatyApplied: boolean;
  treatyReference: string | null;
}

interface WhtCertificateTemplateProps {
  data: WhtCertificateData;
  branding?: { logoUrl?: string; primaryColor?: string };
}

const styles = StyleSheet.create({
  page: { padding: 40, fontFamily: 'Helvetica', fontSize: 10, lineHeight: 1.5 },
  header: { marginBottom: 24, borderBottom: '2px solid #1a1a1a', paddingBottom: 16 },
  logo: { width: 120, height: 40, objectFit: 'contain', marginBottom: 12 },
  title: {
    fontSize: 18,
    fontWeight: 'bold',
    textTransform: 'uppercase',
    letterSpacing: 1.5,
    marginBottom: 4,
  },
  certNumber: { fontSize: 11, color: '#666' },
  section: { marginBottom: 16 },
  sectionTitle: {
    fontSize: 11,
    fontWeight: 'bold',
    marginBottom: 8,
    textTransform: 'uppercase',
    color: '#444',
  },
  row: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 4 },
  label: { color: '#666', width: '40%' },
  value: { fontWeight: 'bold', width: '60%', textAlign: 'right' },
  amountRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 6,
    paddingVertical: 4,
  },
  totalRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    borderTop: '1px solid #ccc',
    paddingTop: 8,
    marginTop: 4,
  },
  treaty: { marginTop: 12, padding: 8, backgroundColor: '#f5f5f5', borderRadius: 4 },
  treatyText: { fontSize: 9, color: '#555' },
  footer: {
    position: 'absolute',
    bottom: 40,
    left: 40,
    right: 40,
    fontSize: 8,
    color: '#999',
    textAlign: 'center',
    borderTop: '1px solid #eee',
    paddingTop: 8,
  },
});

function formatAmount(minor: number, currency: string): string {
  const major = minor / 100;
  return `${currency} ${major.toFixed(2)}`;
}

export function WhtCertificateTemplate({ data, branding }: WhtCertificateTemplateProps) {
  return (
    <Document>
      <Page size="A4" style={styles.page}>
        <View style={styles.header}>
          {branding?.logoUrl && <Image src={branding.logoUrl} style={styles.logo} />}
          <Text style={styles.title}>Withholding Tax Certificate</Text>
          <Text style={styles.certNumber}>Certificate No: {data.certificateNumber}</Text>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Organization</Text>
          <View style={styles.row}>
            <Text style={styles.label}>Name</Text>
            <Text style={styles.value}>{data.organizationName}</Text>
          </View>
          {data.organizationTaxId && (
            <View style={styles.row}>
              <Text style={styles.label}>Tax ID</Text>
              <Text style={styles.value}>{data.organizationTaxId}</Text>
            </View>
          )}
          <View style={styles.row}>
            <Text style={styles.label}>Country</Text>
            <Text style={styles.value}>{data.organizationCountry}</Text>
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Contractor</Text>
          <View style={styles.row}>
            <Text style={styles.label}>Name</Text>
            <Text style={styles.value}>{data.contractorName}</Text>
          </View>
          {data.contractorTaxId && (
            <View style={styles.row}>
              <Text style={styles.label}>Tax ID</Text>
              <Text style={styles.value}>{data.contractorTaxId}</Text>
            </View>
          )}
          <View style={styles.row}>
            <Text style={styles.label}>Residency</Text>
            <Text style={styles.value}>{data.contractorResidency}</Text>
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Payment Details</Text>
          <View style={styles.row}>
            <Text style={styles.label}>Payment Date</Text>
            <Text style={styles.value}>{data.paymentDate.toISOString().split('T')[0]}</Text>
          </View>
          <View style={styles.amountRow}>
            <Text style={styles.label}>Gross Amount</Text>
            <Text style={styles.value}>{formatAmount(data.grossAmountMinor, data.currency)}</Text>
          </View>
          <View style={styles.amountRow}>
            <Text style={styles.label}>
              WHT Rate ({data.treatyApplied ? 'Treaty' : 'Standard'})
            </Text>
            <Text style={styles.value}>{data.whtRate}%</Text>
          </View>
          <View style={styles.amountRow}>
            <Text style={styles.label}>WHT Amount</Text>
            <Text style={styles.value}>{formatAmount(data.whtAmountMinor, data.currency)}</Text>
          </View>
          <View style={styles.totalRow}>
            <Text style={styles.label}>Net Amount Paid</Text>
            <Text style={styles.value}>{formatAmount(data.netAmountMinor, data.currency)}</Text>
          </View>
        </View>

        {data.treatyApplied && data.treatyReference && (
          <View style={styles.treaty}>
            <Text style={styles.treatyText}>Treaty Applied: {data.treatyReference}</Text>
          </View>
        )}

        <Text style={styles.footer}>
          This certificate confirms that withholding tax has been deducted at source in accordance
          with applicable tax regulations.
        </Text>
      </Page>
    </Document>
  );
}
