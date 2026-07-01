// US Worker-Classification Determination Letter React-PDF template — verdict-first, evidence trailing.
//
// Contract:
// - Deterministic render: reads ONLY assessment.outcome (UsClassificationOutcome) +
//   assessment.questionsSnapshot + engagement context. There is NO LLM / network path.
// - NEVER imports live rule-set constants from @contractor-ops/classification (only TYPES);
//   the statute strings shown here are display copy baked into the template, not scoring inputs.
// - The advisory footer is SOFTWARE_NOT_LEGAL_ADVICE_EN from @contractor-ops/validators (a
//   CI-locked phrase — never translated or sourced from messages/*.json).
// - Byte stability: the caller supplies a stable `renderedAt` (typically assessment.completedAt).

import type {
  UsClassificationOutcome,
  UsClassificationVerdict,
  UsFederalCategory,
} from '@contractor-ops/classification';
import { SOFTWARE_NOT_LEGAL_ADVICE_EN } from '@contractor-ops/validators';
import { Document, Page, StyleSheet, Text, View } from '@react-pdf/renderer';

export const TEMPLATE_VERSION = 1 as const;
export const RENDERER_SLUG = 'us-determination-letter' as const;

// ---------------------------------------------------------------------------
// Colour tokens — mirror the ir35-sds palette. AB5 is always amber (warning),
// never red; §530 is always info-blue — a likely-employee verdict is the only
// destructive-toned signal (a genuine risk, consistent with IR35 "inside").
// ---------------------------------------------------------------------------

const TEAL_ACCENT = '#0d7f72';
const GREY_BODY = '#1f2937';
const GREY_MUTED = '#6b7280';
const GREY_RULE = '#d1d5db';

const VERDICT_GREEN = '#047857';
const VERDICT_RED = '#b91c1c';
const VERDICT_AMBER = '#b45309';
const VERDICT_GREY = '#4b5563';
const FLAG_AMBER = '#b45309';
const FLAG_INFO_BLUE = '#1d4ed8';

interface PillConfig {
  background: string;
  color: string;
  label: string;
}

const VERDICT_PILLS: Record<UsClassificationVerdict, PillConfig> = {
  employee: { background: VERDICT_RED, color: '#ffffff', label: 'Likely employee' },
  'independent-contractor': {
    background: VERDICT_GREEN,
    color: '#ffffff',
    label: 'Likely independent contractor',
  },
  indeterminate: { background: VERDICT_AMBER, color: '#ffffff', label: 'Indeterminate' },
};

const FEDERAL_CATEGORY_TITLES: Record<UsFederalCategory, string> = {
  behavioral: 'Behavioral control',
  financial: 'Financial control',
  relationship: 'Relationship of the parties',
};

// Statute / case-law citations surfaced verbatim so the letter is audit-defensible.
const CITE_COMMON_LAW = 'IRS common-law test — Rev. Rul. 87-41; Form SS-8';
const CITE_AB5 = 'CA Labor Code §2775-2785 (Dynamex; AB5 ABC test)';
const CITE_AB5_B2B = 'CA Labor Code §2776 (B2B / professional-services exemption)';
const CITE_SECTION_530 = '§530 of the Revenue Act of 1978 (safe-harbor relief)';

const STATUTE_CITATIONS: readonly string[] = [
  CITE_COMMON_LAW,
  CITE_AB5,
  CITE_AB5_B2B,
  CITE_SECTION_530,
];

const ADVISER_VERIFY_NOTE =
  'Every factor in this letter is adviser-verify. This determination is advisory ' +
  'decision-support, not a final legal determination — confirm with a qualified US ' +
  'tax adviser before acting on it.';

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
  flagRow: { flexDirection: 'row', flexWrap: 'wrap', marginTop: 4 },
  flagChip: {
    alignSelf: 'flex-start',
    marginRight: 8,
    marginBottom: 8,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 6,
    maxWidth: '48%',
  },
  flagChipLabel: { fontSize: 9, fontWeight: 'bold', color: '#ffffff' },
  flagChipDetail: { fontSize: 8, color: '#ffffff', marginTop: 2 },
  engagementGrid: { marginTop: 16, flexDirection: 'row', flexWrap: 'wrap' },
  engagementKV: { width: '50%', marginBottom: 8 },
  engagementKey: { fontSize: 8, color: GREY_MUTED, textTransform: 'uppercase' },
  engagementValue: { fontSize: 10, color: GREY_BODY },
  sectionTitle: {
    fontSize: 13,
    fontWeight: 'bold',
    color: GREY_BODY,
    marginTop: 20,
    marginBottom: 6,
  },
  factorRow: { marginTop: 12, marginBottom: 4 },
  factorTitle: { fontSize: 12, fontWeight: 'bold', color: GREY_BODY },
  factorSignals: { fontSize: 10, color: GREY_BODY, marginTop: 2 },
  factorCitation: { fontSize: 8, color: GREY_MUTED, marginTop: 2 },
  evidenceList: { marginLeft: 12 },
  evidenceItem: { marginBottom: 8 },
  evidenceQuestion: { fontSize: 10, color: GREY_BODY },
  evidenceAnswer: { fontSize: 10, color: TEAL_ACCENT, marginTop: 2 },
  evidenceCitation: { fontSize: 8, color: GREY_MUTED, marginTop: 2 },
  citationsBlock: { marginTop: 20 },
  citationItem: { fontSize: 9, color: GREY_BODY, marginBottom: 4 },
  adviserNote: {
    marginTop: 20,
    padding: 12,
    border: `1px solid ${GREY_RULE}`,
    borderRadius: 4,
    fontSize: 9,
    color: GREY_BODY,
    lineHeight: 1.55,
  },
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

interface LetterQuestion {
  readonly id: string;
  readonly prompt: { readonly en: string };
  readonly citation?: string;
  readonly category?: string;
}

interface LetterAnswer {
  readonly value?: unknown;
  readonly isNotApplicable?: boolean;
  readonly rawScore?: number;
}

export interface DeterminationLetterAssessment {
  ruleSetVersion: string;
  completedAt: Date | null;
  questionsSnapshot: { questions: readonly LetterQuestion[] } | null;
  answers: Record<string, LetterAnswer | undefined>;
  outcome: UsClassificationOutcome;
}

export interface DeterminationLetterEngagement {
  id: string;
  displayName: string;
  activeFrom: Date;
  activeTo: Date | null;
}

export interface DeterminationLetterContractor {
  id: string;
  displayName: string;
}

export interface DeterminationLetterOrganization {
  id: string;
  name: string;
  countryCode: string | null;
}

export interface UsDeterminationLetterProps {
  assessment: DeterminationLetterAssessment;
  engagement: DeterminationLetterEngagement;
  contractor: DeterminationLetterContractor;
  organization: DeterminationLetterOrganization;
  /** Stable timestamp for byte-equal re-renders — typically assessment.completedAt. */
  renderedAt: Date;
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

function formatAnswer(answer: LetterAnswer | undefined): string {
  if (!answer) return 'No answer';
  if (answer.isNotApplicable) return 'Not applicable';
  if (typeof answer.value === 'string') return answer.value;
  if (typeof answer.value === 'number') return String(answer.value);
  if (typeof answer.value === 'boolean') return answer.value ? 'Yes' : 'No';
  if (typeof answer.rawScore === 'number') return `Score: ${answer.rawScore}`;
  return '—';
}

// ---------------------------------------------------------------------------
// Main template
// ---------------------------------------------------------------------------

export function UsDeterminationLetterDocument({
  assessment,
  engagement,
  contractor,
  organization,
  renderedAt,
}: UsDeterminationLetterProps) {
  if (assessment.outcome?.kind !== 'US_CLASSIFICATION') {
    throw new Error(
      'UsDeterminationLetterDocument: assessment.outcome must be of kind US_CLASSIFICATION',
    );
  }
  if (!assessment.questionsSnapshot) {
    throw new Error(
      'UsDeterminationLetterDocument: questionsSnapshot is null — assessment must be completed',
    );
  }

  const outcome = assessment.outcome;
  const verdictPill = VERDICT_PILLS[outcome.verdict];
  const federalFactors = outcome.federalFactors ?? [];
  const questions = assessment.questionsSnapshot.questions;
  const renderedAtLabel = formatIsoDate(renderedAt);

  const ab5Chip: PillConfig = outcome.ab5Flag
    ? {
        background: FLAG_AMBER,
        color: '#ffffff',
        label: 'California AB5 / ABC test — dispositive overlay applied',
      }
    : {
        background: VERDICT_GREY,
        color: '#ffffff',
        label: 'California AB5 / ABC test — not applied (work outside California)',
      };

  const section530Chip: PillConfig = outcome.section530ReliefEligible
    ? {
        background: FLAG_INFO_BLUE,
        color: '#ffffff',
        label: '§530 safe-harbor relief — eligibility flagged for adviser review',
      }
    : {
        background: VERDICT_GREY,
        color: '#ffffff',
        label: '§530 safe-harbor relief — not indicated',
      };

  return (
    <Document
      title={`Classification Determination Letter — ${contractor.displayName} — ${engagement.displayName}`}
      author={organization.name}
      creator="Contractor Ops"
      producer="Contractor Ops"
      creationDate={renderedAt}
      modificationDate={renderedAt}>
      {/* Page 1 — verdict + flags + engagement details */}
      <Page size="A4" style={styles.page} wrap>
        <View style={styles.header}>
          <Text style={styles.title}>Classification Determination Letter</Text>
          <Text style={styles.subtitle}>
            Prepared by {organization.name} — US worker classification (IRS common-law + CA AB5 +
            §530)
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
            This letter reflects the {verdictPill.label} outcome produced by the{' '}
            {assessment.ruleSetVersion} rule set on {formatIsoDate(assessment.completedAt)}.
          </Text>
        </View>

        <View style={styles.flagRow}>
          <View style={[styles.flagChip, { backgroundColor: ab5Chip.background }]}>
            <Text style={styles.flagChipLabel}>{ab5Chip.label}</Text>
            <Text style={styles.flagChipDetail}>{CITE_AB5}</Text>
          </View>
          <View style={[styles.flagChip, { backgroundColor: section530Chip.background }]}>
            <Text style={styles.flagChipLabel}>{section530Chip.label}</Text>
            <Text style={styles.flagChipDetail}>{CITE_SECTION_530}</Text>
          </View>
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
          Classification Determination Letter · {organization.name} · Rendered {renderedAtLabel}
        </Text>
        <Text style={styles.pageNumber} fixed render={renderPageNumber} />
      </Page>

      {/* Page 2 — federal common-law factors + evidence */}
      <Page size="A4" style={styles.page} wrap>
        <Text style={styles.sectionTitle}>
          Federal common-law factors (IRS three-category test)
        </Text>
        {federalFactors.map(factor => (
          <View key={factor.category} style={styles.factorRow} wrap={false}>
            <Text style={styles.factorTitle}>{FEDERAL_CATEGORY_TITLES[factor.category]}</Text>
            <Text style={styles.factorSignals}>
              Employee signals: {factor.employeeSignals} · Contractor signals:{' '}
              {factor.contractorSignals}
            </Text>
            <Text style={styles.factorCitation}>{CITE_COMMON_LAW}</Text>
          </View>
        ))}

        <Text style={styles.sectionTitle}>Evidence considered</Text>
        <View style={styles.evidenceList}>
          {questions.map(question => {
            const answer = assessment.answers?.[question.id];
            return (
              <View key={question.id} style={styles.evidenceItem} wrap={false}>
                <Text style={styles.evidenceQuestion}>{question.prompt.en}</Text>
                <Text style={styles.evidenceAnswer}>{formatAnswer(answer)}</Text>
                {question.citation ? (
                  <Text style={styles.evidenceCitation}>{question.citation}</Text>
                ) : null}
              </View>
            );
          })}
        </View>

        <Text style={styles.footer} fixed>
          Classification Determination Letter · {organization.name} · Rendered {renderedAtLabel}
        </Text>
        <Text style={styles.pageNumber} fixed render={renderPageNumber} />
      </Page>

      {/* Final page — citations + adviser note + locked disclaimer */}
      <Page size="A4" style={styles.page} wrap>
        <Text style={styles.sectionTitle}>Statutes and authorities relied on</Text>
        <View style={styles.citationsBlock}>
          {STATUTE_CITATIONS.map(citation => (
            <Text key={citation} style={styles.citationItem}>
              • {citation}
            </Text>
          ))}
        </View>

        <View style={styles.adviserNote}>
          <Text>{ADVISER_VERIFY_NOTE}</Text>
        </View>

        <Text style={styles.disclaimer}>{SOFTWARE_NOT_LEGAL_ADVICE_EN}</Text>

        <Text style={styles.footer} fixed>
          Classification Determination Letter · {organization.name} · Rendered {renderedAtLabel}
        </Text>
        <Text style={styles.pageNumber} fixed render={renderPageNumber} />
      </Page>
    </Document>
  );
}
