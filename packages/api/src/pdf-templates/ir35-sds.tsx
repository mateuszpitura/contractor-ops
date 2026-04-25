// Phase 59 · Plan 02 — CLASS-03, D-01/D-02/D-03/D-04.
// Status Determination Statement (SDS) React-PDF template — verdict-first, per-area evidence trailing.
//
// Contract:
// - Reads ONLY from assessment.outcome (Ir35Outcome) + assessment.questionsSnapshot + engagement context.
// - NEVER imports live rule-set constants from @contractor-ops/classification/profiles (only TYPES).
// - Locked phrases (IR35_DISPUTE_PROCESS_EN, SDS_DISCLAIMER_EN) come from @contractor-ops/validators.
// - Byte stability: caller provides a stable `renderedAt` (typically assessment.completedAt).

import type {
  Assessment,
  Ir35AreaResult,
  Ir35AreaVerdict,
  Ir35Verdict,
} from '@contractor-ops/classification';
import {
  IR35_DISPUTE_PROCESS_EN,
  SDS_APPROVAL_STATEMENT_EN,
  SDS_DISCLAIMER_EN,
} from '@contractor-ops/validators';
import { Document, Page, StyleSheet, Text, View } from '@react-pdf/renderer';

export const TEMPLATE_VERSION = 1 as const;
export const RENDERER_SLUG = 'ir35-sds' as const;

// ---------------------------------------------------------------------------
// Colour tokens — mirror gdpr-privacy-notice.tsx palette + verdict palette
// ---------------------------------------------------------------------------

const TEAL_ACCENT = '#0d7f72';
const GREY_BODY = '#1f2937';
const GREY_MUTED = '#6b7280';
const GREY_RULE = '#d1d5db';

const VERDICT_GREEN = '#047857';
const VERDICT_RED = '#b91c1c';
const VERDICT_AMBER = '#b45309';
const VERDICT_GREY = '#4b5563';
const AREA_GREEN_LIGHT = '#059669';
const AREA_RED_LIGHT = '#dc2626';

interface PillConfig {
  background: string;
  color: string;
  label: string;
}

const VERDICT_PILLS: Record<Ir35Verdict, PillConfig> = {
  outside: { background: VERDICT_GREEN, color: '#ffffff', label: 'Outside IR35' },
  inside: { background: VERDICT_RED, color: '#ffffff', label: 'Inside IR35' },
  indeterminate: { background: VERDICT_AMBER, color: '#ffffff', label: 'Indeterminate' },
};

const AREA_PILLS: Record<Ir35AreaVerdict, PillConfig> = {
  'strong-outside': { background: VERDICT_GREEN, color: '#ffffff', label: 'Strongly outside' },
  'leaning-outside': { background: AREA_GREEN_LIGHT, color: '#ffffff', label: 'Leaning outside' },
  neutral: { background: VERDICT_GREY, color: '#ffffff', label: 'Neutral' },
  'leaning-inside': { background: AREA_RED_LIGHT, color: '#ffffff', label: 'Leaning inside' },
  'strong-inside': { background: VERDICT_RED, color: '#ffffff', label: 'Strongly inside' },
};

const AREA_TITLES: Record<Ir35AreaResult['area'], string> = {
  substitution: 'Right of substitution',
  control: 'Control',
  'financial-risk': 'Financial risk',
  'part-and-parcel': 'Part and parcel',
  moo: 'Mutuality of obligation (MOO)',
};

const styles = StyleSheet.create({
  page: {
    fontFamily: 'Helvetica',
    fontSize: 10,
    lineHeight: 1.5,
    color: GREY_BODY,
    padding: 56,
    paddingBottom: 72,
  },
  header: { marginBottom: 24, borderBottom: `1px solid ${GREY_RULE}`, paddingBottom: 12 },
  title: { fontSize: 20, fontWeight: 'bold', color: TEAL_ACCENT, marginBottom: 4 },
  subtitle: { fontSize: 9, color: GREY_MUTED },
  versionLine: { fontSize: 9, color: GREY_MUTED, marginTop: 4 },
  verdictBanner: { marginVertical: 16, padding: 16, borderRadius: 6 },
  verdictLabel: { fontSize: 18, fontWeight: 'bold' },
  verdictSummary: { fontSize: 11, marginTop: 8 },
  pill: {
    alignSelf: 'flex-start',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999,
    fontSize: 9,
    fontWeight: 'bold',
  },
  engagementGrid: { marginTop: 16, flexDirection: 'row', flexWrap: 'wrap' },
  engagementKV: { width: '50%', marginBottom: 8 },
  engagementKey: { fontSize: 8, color: GREY_MUTED, textTransform: 'uppercase' },
  engagementValue: { fontSize: 10, color: GREY_BODY },
  areaSection: { marginTop: 20 },
  areaTitleRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 6 },
  areaTitle: { fontSize: 13, fontWeight: 'bold', color: GREY_BODY, marginLeft: 8 },
  evidenceList: { marginLeft: 12 },
  evidenceItem: { marginBottom: 8 },
  evidenceQuestion: { fontSize: 10, color: GREY_BODY },
  evidenceAnswer: { fontSize: 10, color: TEAL_ACCENT, marginTop: 2 },
  evidenceCitation: { fontSize: 8, color: GREY_MUTED, marginTop: 2 },
  disputeBlock: {
    marginTop: 24,
    padding: 16,
    border: `1px solid ${GREY_RULE}`,
    borderRadius: 4,
  },
  disputeTitle: { fontSize: 13, fontWeight: 'bold', color: GREY_BODY, marginBottom: 8 },
  disputeBody: { fontSize: 10, color: GREY_BODY, lineHeight: 1.55 },
  disclaimer: { marginTop: 16, fontSize: 9, color: GREY_MUTED, lineHeight: 1.55 },
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
// Public props
// ---------------------------------------------------------------------------

export interface SdsEngagement {
  id: string;
  displayName: string;
  activeFrom: Date;
  activeTo: Date | null;
}

export interface SdsContractor {
  id: string;
  displayName: string;
}

export interface SdsOrganization {
  id: string;
  name: string;
  countryCode: string | null;
}

// Phase 64 · D-21 — SDS approval data for cover page
interface SdsApprovalData {
  clientName: string;
  approvedAt: Date;
  approvedByName: string;
  approvalStatementSnapshot: string;
}

const coverStyles = StyleSheet.create({
  coverPage: {
    fontFamily: 'Helvetica',
    fontSize: 10,
    lineHeight: 1.5,
    color: GREY_BODY,
    padding: 56,
    paddingBottom: 72,
  },
  coverHeader: {
    fontSize: 20,
    fontWeight: 'bold',
    color: TEAL_ACCENT,
    marginBottom: 4,
  },
  coverSubtitle: {
    fontSize: 9,
    color: GREY_MUTED,
    marginBottom: 32,
  },
  coverSection: {
    marginBottom: 20,
  },
  coverLabel: {
    fontSize: 8,
    fontWeight: 'bold',
    color: GREY_MUTED,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 4,
  },
  coverValue: {
    fontSize: 11,
    color: GREY_BODY,
  },
  coverStatement: {
    fontSize: 9,
    color: GREY_BODY,
    lineHeight: 1.6,
    padding: 12,
    backgroundColor: '#f9fafb',
    borderRadius: 4,
    marginTop: 8,
  },
  coverFooter: {
    position: 'absolute',
    bottom: 40,
    left: 56,
    right: 56,
    fontSize: 8,
    color: GREY_MUTED,
    borderTop: `1px solid ${GREY_RULE}`,
    paddingTop: 8,
  },
});

function CoverPage({ approvalData }: { approvalData: SdsApprovalData }) {
  return (
    <Page style={coverStyles.coverPage}>
      <View style={coverStyles.coverSection}>
        <Text style={coverStyles.coverHeader}>Status Determination Statement</Text>
        <Text style={coverStyles.coverSubtitle}>Approval Record — Chapter 10 ITEPA 2003</Text>
      </View>

      <View style={coverStyles.coverSection}>
        <Text style={coverStyles.coverLabel}>Client / End-Hirer</Text>
        <Text style={coverStyles.coverValue}>{approvalData.clientName}</Text>
      </View>

      <View style={coverStyles.coverSection}>
        <Text style={coverStyles.coverLabel}>Approved By</Text>
        <Text style={coverStyles.coverValue}>{approvalData.approvedByName}</Text>
      </View>

      <View style={coverStyles.coverSection}>
        <Text style={coverStyles.coverLabel}>Approved At</Text>
        <Text style={coverStyles.coverValue}>
          {approvalData.approvedAt.toLocaleDateString('en-GB', {
            day: '2-digit',
            month: 'long',
            year: 'numeric',
          })}
        </Text>
      </View>

      <View style={coverStyles.coverSection}>
        <Text style={coverStyles.coverLabel}>Approval Statement</Text>
        <Text style={coverStyles.coverStatement}>{approvalData.approvalStatementSnapshot}</Text>
      </View>

      <View style={coverStyles.coverFooter} fixed>
        <Text>
          Approval recorded in-app on {approvalData.approvedAt.toLocaleDateString('en-GB')} • This
          cover page is generated from the approval record stored by Contractor Ops
        </Text>
      </View>
    </Page>
  );
}

export interface IR35SDSDocumentProps {
  assessment: Assessment;
  engagement: SdsEngagement;
  contractor: SdsContractor;
  organization: SdsOrganization;
  /** Stable timestamp for byte-equal re-renders — typically assessment.completedAt. */
  renderedAt: Date;
  /** Phase 64 D-21 — optional SDS approval data for cover page */
  approvalData?: SdsApprovalData | null;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function formatIsoDate(d: Date | null | undefined): string {
  if (!d) return '—';
  return d.toISOString().slice(0, 10);
}

function renderPageNumber({ pageNumber, totalPages }: { pageNumber: number; totalPages: number }) {
  return `${pageNumber} / ${totalPages}`;
}

function formatAnswer(
  answer:
    | {
        value?: unknown;
        rawScore?: number;
        isNotApplicable?: boolean;
      }
    | undefined,
): string {
  if (!answer) return 'No answer';
  if (answer.isNotApplicable) return 'Not applicable';
  if (typeof answer.value === 'string') return answer.value;
  if (typeof answer.value === 'number') return String(answer.value);
  if (typeof answer.value === 'boolean') return answer.value ? 'Yes' : 'No';
  if (typeof answer.rawScore === 'number') return `Score: ${answer.rawScore}`;
  if (answer.value !== undefined && answer.value !== null) {
    return JSON.stringify(answer.value);
  }
  return '—';
}

// ---------------------------------------------------------------------------
// Main template
// ---------------------------------------------------------------------------

export function IR35SDSDocument({
  assessment,
  engagement,
  contractor,
  organization,
  renderedAt,
  approvalData,
}: IR35SDSDocumentProps) {
  if (assessment.outcome?.kind !== 'IR35') {
    throw new Error('IR35SDSDocument: assessment.outcome must be of kind IR35');
  }
  if (!assessment.questionsSnapshot) {
    throw new Error('IR35SDSDocument: questionsSnapshot is null — assessment must be completed');
  }

  const outcome = assessment.outcome;
  const verdictPill = VERDICT_PILLS[outcome.verdict];
  const questionsById = new Map(assessment.questionsSnapshot.questions.map(q => [q.id, q]));
  const renderedAtLabel = formatIsoDate(renderedAt);

  return (
    <Document title={`SDS — ${contractor.displayName} — ${engagement.displayName}`}>
      {/* Phase 64 D-21 — cover page when approval data is present */}
      {approvalData != null && <CoverPage approvalData={approvalData} />}
      {/* Page 1 — verdict + engagement details */}
      <Page size="A4" style={styles.page} wrap>
        <View style={styles.header}>
          <Text style={styles.title}>Status Determination Statement</Text>
          <Text style={styles.subtitle}>
            Issued by {organization.name} under Chapter 10 ITEPA 2003
          </Text>
          <Text style={styles.versionLine}>
            Rule set: {assessment.ruleSetVersion} · Completed:{' '}
            {formatIsoDate(assessment.completedAt)}
          </Text>
        </View>

        <View style={[styles.verdictBanner, { backgroundColor: verdictPill.background }]}>
          <Text style={[styles.verdictLabel, { color: verdictPill.color }]}>
            {verdictPill.label}
          </Text>
          <Text style={[styles.verdictSummary, { color: verdictPill.color }]}>
            This Status Determination Statement reflects the {verdictPill.label} verdict produced by
            the {assessment.ruleSetVersion} rule set on {formatIsoDate(assessment.completedAt)}.
          </Text>
        </View>

        <View style={styles.engagementGrid}>
          <View style={styles.engagementKV}>
            <Text style={styles.engagementKey}>Client</Text>
            <Text style={styles.engagementValue}>{organization.name}</Text>
          </View>
          <View style={styles.engagementKV}>
            <Text style={styles.engagementKey}>Worker</Text>
            <Text style={styles.engagementValue}>{contractor.displayName}</Text>
          </View>
          <View style={styles.engagementKV}>
            <Text style={styles.engagementKey}>Engagement</Text>
            <Text style={styles.engagementValue}>{engagement.displayName}</Text>
          </View>
          <View style={styles.engagementKV}>
            <Text style={styles.engagementKey}>Rule set version</Text>
            <Text style={styles.engagementValue}>{assessment.ruleSetVersion}</Text>
          </View>
          <View style={styles.engagementKV}>
            <Text style={styles.engagementKey}>Active from</Text>
            <Text style={styles.engagementValue}>{formatIsoDate(engagement.activeFrom)}</Text>
          </View>
          <View style={styles.engagementKV}>
            <Text style={styles.engagementKey}>Active to</Text>
            <Text style={styles.engagementValue}>
              {engagement.activeTo ? formatIsoDate(engagement.activeTo) : 'Ongoing'}
            </Text>
          </View>
        </View>

        <Text style={styles.footer} fixed>
          Status Determination Statement · {organization.name} · Rendered {renderedAtLabel}
        </Text>
        <Text style={styles.pageNumber} fixed render={renderPageNumber} />
      </Page>

      {/* Page 2 — per-area evidence */}
      <Page size="A4" style={styles.page} wrap>
        <Text style={styles.title}>Area-by-area reasoning</Text>
        {outcome.areas.map(ar => {
          const areaPill = AREA_PILLS[ar.verdict];
          const areaTitle = AREA_TITLES[ar.area];
          const drivingQs = (ar.drivingQuestionIds ?? [])
            .map(id => questionsById.get(id))
            .filter((q): q is NonNullable<typeof q> => q !== undefined);
          return (
            <View key={ar.area} style={styles.areaSection} wrap={false}>
              <View style={styles.areaTitleRow}>
                <View style={[styles.pill, { backgroundColor: areaPill.background }]}>
                  <Text style={{ color: areaPill.color }}>{areaPill.label}</Text>
                </View>
                <Text style={styles.areaTitle}>{areaTitle}</Text>
              </View>
              <View style={styles.evidenceList}>
                {drivingQs.map(q => {
                  const answer = assessment.answers[q.id];
                  const answerText = formatAnswer(answer);
                  return (
                    <View key={q.id} style={styles.evidenceItem} wrap={false}>
                      <Text style={styles.evidenceQuestion}>{q.prompt.en}</Text>
                      <Text style={styles.evidenceAnswer}>{answerText}</Text>
                      {q.caseLawCitation ? (
                        <Text style={styles.evidenceCitation}>{q.caseLawCitation}</Text>
                      ) : null}
                    </View>
                  );
                })}
                {ar.caseLawCitations.length > 0 ? (
                  <View style={styles.evidenceItem} wrap={false}>
                    <Text style={styles.evidenceCitation}>
                      Supporting case law: {ar.caseLawCitations.join('; ')}
                    </Text>
                  </View>
                ) : null}
              </View>
            </View>
          );
        })}

        <Text style={styles.footer} fixed>
          Status Determination Statement · {organization.name} · Rendered {renderedAtLabel}
        </Text>
        <Text style={styles.pageNumber} fixed render={renderPageNumber} />
      </Page>

      {/* Final page — dispute + disclaimer */}
      <Page size="A4" style={styles.page} wrap>
        <View style={styles.disputeBlock}>
          <Text style={styles.disputeTitle}>Challenging this determination</Text>
          <Text style={styles.disputeBody}>{IR35_DISPUTE_PROCESS_EN}</Text>
        </View>
        <Text style={styles.disclaimer}>{SDS_DISCLAIMER_EN}</Text>
        <Text style={styles.footer} fixed>
          Status Determination Statement · {organization.name} · Rendered {renderedAtLabel}
        </Text>
        <Text style={styles.pageNumber} fixed render={renderPageNumber} />
      </Page>
    </Document>
  );
}
