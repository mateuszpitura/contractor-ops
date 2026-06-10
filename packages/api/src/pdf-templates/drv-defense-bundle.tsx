// DRV Defensivdokumentation React-PDF template.
//
// 4-section consolidated audit defense bundle for the Deutsche Rentenversicherung:
//   1. Engagement structure (two-column key/value block)
//   2. Independence indicators (4 DRV categories with weighted-score pills)
//   3. Risk assessment history (newest first, deltas vs next-older)
//   4. Other-client attestation + same-tenant cross-reference table
// Final page: DRV_DEFENSE_DISCLAIMER_DE verbatim.
//
// Locked-phrase contract: imports ONLY @contractor-ops/validators locked constants +
// @contractor-ops/classification types. NEVER imports live rule-set constants from
// @contractor-ops/classification/profiles/*.

import type {
  Assessment,
  ScheinCategory,
  ScheinCategoryResult,
  ScheinVerdict,
} from '@contractor-ops/classification';
import {
  DRV_DEFENSE_ATTESTATION_FOOTER_DE,
  DRV_DEFENSE_COVER_HEADER_DE,
  DRV_DEFENSE_CROSS_REFERENCE_FOOTER_DE,
  DRV_DEFENSE_DISCLAIMER_DE,
  DRV_DEFENSE_SECTION_TITLES_DE,
  DRV_DEFENSE_TABLE_HEADERS_DE,
} from '@contractor-ops/validators';
import { Document, Page, StyleSheet, Text, View } from '@react-pdf/renderer';

export const TEMPLATE_VERSION = 1 as const;
export const RENDERER_SLUG = 'drv-defense-bundle' as const;

// ---------------------------------------------------------------------------
// Colour tokens
// ---------------------------------------------------------------------------

const TEAL_ACCENT = '#0d7f72';
const GREY_BODY = '#1f2937';
const GREY_MUTED = '#6b7280';
const GREY_RULE = '#d1d5db';

const VERDICT_COLOURS: Record<ScheinVerdict, { bg: string; fg: string; label: string }> = {
  green: { bg: '#047857', fg: '#ffffff', label: 'Grün — geringes Risiko' },
  amber: { bg: '#b45309', fg: '#ffffff', label: 'Gelb — erhöhte Indizien' },
  red: { bg: '#b91c1c', fg: '#ffffff', label: 'Rot — hohes Risiko' },
};

const CATEGORY_LABELS: Record<ScheinCategory, string> = {
  integration: 'Eingliederung in die Arbeitsorganisation',
  entrepreneurial: 'Unternehmerische Selbstständigkeit',
  'personal-dep': 'Persönliche Abhängigkeit',
  'economic-dep': 'Wirtschaftliche Abhängigkeit',
};

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------

const styles = StyleSheet.create({
  page: {
    fontFamily: 'Helvetica',
    fontSize: 10,
    lineHeight: 1.5,
    color: GREY_BODY,
    padding: 56,
    paddingBottom: 72,
  },
  coverTitle: { fontSize: 22, fontWeight: 'bold', color: TEAL_ACCENT, marginBottom: 16 },
  coverSub: { fontSize: 10, color: GREY_MUTED, marginBottom: 24 },
  sectionTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: TEAL_ACCENT,
    marginBottom: 12,
    borderBottom: `1px solid ${GREY_RULE}`,
    paddingBottom: 6,
  },
  keyValueRow: { flexDirection: 'row', flexWrap: 'wrap', marginBottom: 8 },
  keyCell: { width: '40%', fontSize: 9, color: GREY_MUTED, textTransform: 'uppercase' },
  valueCell: { width: '60%', fontSize: 10 },
  categoryCard: {
    marginBottom: 14,
    padding: 12,
    border: `1px solid ${GREY_RULE}`,
    borderRadius: 4,
  },
  categoryHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: 6 },
  pill: {
    alignSelf: 'flex-start',
    paddingHorizontal: 10,
    paddingVertical: 3,
    borderRadius: 999,
    fontSize: 9,
    fontWeight: 'bold',
  },
  categoryTitle: { fontSize: 13, fontWeight: 'bold', marginLeft: 8 },
  scoreLine: { fontSize: 10, marginBottom: 4 },
  evidenceQ: { fontSize: 10, marginTop: 4 },
  historyRow: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 10,
    border: `1px solid ${GREY_RULE}`,
    borderRadius: 4,
    marginBottom: 8,
  },
  historyMeta: { flex: 1, paddingRight: 12 },
  historyDelta: { width: 180, textAlign: 'right', fontSize: 10 },
  tableRow: { flexDirection: 'row', borderBottom: `1px solid ${GREY_RULE}`, paddingVertical: 4 },
  tableHeaderCell: {
    flex: 1,
    fontSize: 9,
    fontWeight: 'bold',
    color: GREY_MUTED,
    textTransform: 'uppercase',
  },
  tableCell: { flex: 1, fontSize: 10 },
  attestationText: {
    marginTop: 16,
    padding: 12,
    border: `1px solid ${GREY_RULE}`,
    borderRadius: 4,
    fontSize: 10,
    lineHeight: 1.55,
  },
  footerNote: { fontSize: 9, color: GREY_MUTED, marginTop: 8 },
  disclaimer: { fontSize: 10, color: GREY_BODY, lineHeight: 1.55 },
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

export interface DrvEngagement {
  id: string;
  displayName: string;
  activeFrom: Date;
  activeTo: Date | null;
}

export interface DrvContractor {
  id: string;
  displayName: string;
}

export interface DrvOrganization {
  id: string;
  name: string;
  countryCode: string | null;
}

export interface DrvAttestation {
  statementText: string;
  signedName: string;
  signedAt: Date | null;
}

export interface DrvCrossReferenceRow {
  id: string;
  activeFrom: Date;
  activeTo: Date | null;
  status: string;
  organization: { name: string };
  project: { name: string } | null;
}

export interface DRVDefenseBundleDocumentProps {
  assessment: Assessment;
  priorAssessments: Assessment[]; // newest first, INCLUDES the current assessment
  engagement: DrvEngagement;
  contractor: DrvContractor;
  organization: DrvOrganization;
  attestation: DrvAttestation;
  crossReference: DrvCrossReferenceRow[];
  renderedAt: Date;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function formatDate(d: Date | null | undefined): string {
  if (!d) return '—';
  return d.toISOString().slice(0, 10);
}

function renderPageNumber({ pageNumber, totalPages }: { pageNumber: number; totalPages: number }) {
  return `${pageNumber} / ${totalPages}`;
}

function formatDelta(current: number, previous: number): string {
  const diff = current - previous;
  const sign = diff > 0 ? '+' : diff < 0 ? '−' : '±';
  return `Δ ${sign}${Math.abs(diff)}`;
}

// ---------------------------------------------------------------------------
// Main template
// ---------------------------------------------------------------------------

export function DRVDefenseBundleDocument({
  assessment,
  priorAssessments,
  engagement,
  contractor,
  organization,
  attestation,
  crossReference,
  renderedAt,
}: DRVDefenseBundleDocumentProps) {
  if (assessment.outcome?.kind !== 'SCHEINSELBSTANDIGKEIT') {
    throw new Error('DRVDefenseBundleDocument: assessment.outcome must be Scheinselbstandigkeit');
  }
  if (!assessment.questionsSnapshot) {
    throw new Error('DRVDefenseBundleDocument: questionsSnapshot is null — assessment incomplete');
  }

  const outcome = assessment.outcome;
  const questionsByCategory = new Map<
    string,
    (typeof assessment.questionsSnapshot.questions)[number][]
  >();
  for (const q of assessment.questionsSnapshot.questions) {
    if (!q.category) continue;
    const list = questionsByCategory.get(q.category) ?? [];
    list.push(q);
    questionsByCategory.set(q.category, list);
  }

  const renderedAtLabel = formatDate(renderedAt);
  const sectionTitles = DRV_DEFENSE_SECTION_TITLES_DE;
  const tableHeaders = DRV_DEFENSE_TABLE_HEADERS_DE.crossReference;

  // Compose history with the current assessment included.
  const history: Assessment[] = [assessment, ...priorAssessments];

  return (
    <Document title={`DRV Defensivdokumentation — ${contractor.displayName}`}>
      {/* Cover */}
      <Page size="A4" style={styles.page} wrap>
        <Text style={styles.coverTitle}>{DRV_DEFENSE_COVER_HEADER_DE}</Text>
        <Text style={styles.coverSub}>
          {organization.name} · {contractor.displayName} · {engagement.displayName}
        </Text>

        <View style={styles.keyValueRow}>
          <Text style={styles.keyCell}>Auftraggeber</Text>
          <Text style={styles.valueCell}>{organization.name}</Text>
        </View>
        <View style={styles.keyValueRow}>
          <Text style={styles.keyCell}>Auftragnehmer:in</Text>
          <Text style={styles.valueCell}>{contractor.displayName}</Text>
        </View>
        <View style={styles.keyValueRow}>
          <Text style={styles.keyCell}>Engagement</Text>
          <Text style={styles.valueCell}>{engagement.displayName}</Text>
        </View>
        <View style={styles.keyValueRow}>
          <Text style={styles.keyCell}>Bewertungsversion</Text>
          <Text style={styles.valueCell}>{assessment.ruleSetVersion}</Text>
        </View>
        <View style={styles.keyValueRow}>
          <Text style={styles.keyCell}>Bewertung abgeschlossen</Text>
          <Text style={styles.valueCell}>{formatDate(assessment.completedAt)}</Text>
        </View>
        <View style={styles.keyValueRow}>
          <Text style={styles.keyCell}>Dokument erstellt</Text>
          <Text style={styles.valueCell}>{renderedAtLabel}</Text>
        </View>

        <Text style={styles.footer} fixed>
          DRV Defensivdokumentation · {organization.name} · {renderedAtLabel}
        </Text>
        <Text style={styles.pageNumber} fixed render={renderPageNumber} />
      </Page>

      {/* Table of contents */}
      <Page size="A4" style={styles.page} wrap>
        <Text style={styles.sectionTitle}>Inhalt</Text>
        <View style={styles.keyValueRow}>
          <Text style={styles.keyCell}>1</Text>
          <Text style={styles.valueCell}>{sectionTitles.engagementStructure}</Text>
        </View>
        <View style={styles.keyValueRow}>
          <Text style={styles.keyCell}>2</Text>
          <Text style={styles.valueCell}>{sectionTitles.independenceIndicators}</Text>
        </View>
        <View style={styles.keyValueRow}>
          <Text style={styles.keyCell}>3</Text>
          <Text style={styles.valueCell}>{sectionTitles.riskAssessmentHistory}</Text>
        </View>
        <View style={styles.keyValueRow}>
          <Text style={styles.keyCell}>4</Text>
          <Text style={styles.valueCell}>{sectionTitles.otherClientAttestation}</Text>
        </View>

        <Text style={styles.footer} fixed>
          DRV Defensivdokumentation · {organization.name} · {renderedAtLabel}
        </Text>
        <Text style={styles.pageNumber} fixed render={renderPageNumber} />
      </Page>

      {/* Section 1: engagement structure */}
      <Page size="A4" style={styles.page} wrap>
        <Text style={styles.sectionTitle}>1 · {sectionTitles.engagementStructure}</Text>
        <View style={styles.keyValueRow}>
          <Text style={styles.keyCell}>Kunde</Text>
          <Text style={styles.valueCell}>{organization.name}</Text>
        </View>
        <View style={styles.keyValueRow}>
          <Text style={styles.keyCell}>Auftragnehmer:in</Text>
          <Text style={styles.valueCell}>{contractor.displayName}</Text>
        </View>
        <View style={styles.keyValueRow}>
          <Text style={styles.keyCell}>Startdatum</Text>
          <Text style={styles.valueCell}>{formatDate(engagement.activeFrom)}</Text>
        </View>
        <View style={styles.keyValueRow}>
          <Text style={styles.keyCell}>Enddatum</Text>
          <Text style={styles.valueCell}>
            {engagement.activeTo ? formatDate(engagement.activeTo) : 'Laufend'}
          </Text>
        </View>
        <View style={styles.keyValueRow}>
          <Text style={styles.keyCell}>Engagement</Text>
          <Text style={styles.valueCell}>{engagement.displayName}</Text>
        </View>
        <View style={styles.keyValueRow}>
          <Text style={styles.keyCell}>Regelwerk-Version</Text>
          <Text style={styles.valueCell}>{assessment.ruleSetVersion}</Text>
        </View>

        <Text style={styles.footer} fixed>
          DRV Defensivdokumentation · {organization.name} · {renderedAtLabel}
        </Text>
        <Text style={styles.pageNumber} fixed render={renderPageNumber} />
      </Page>

      {/* Section 2: independence indicators */}
      <Page size="A4" style={styles.page} wrap>
        <Text style={styles.sectionTitle}>2 · {sectionTitles.independenceIndicators}</Text>
        {outcome.categories.map((c: ScheinCategoryResult) => {
          const pill = VERDICT_COLOURS[c.verdict];
          const questions = questionsByCategory.get(c.category) ?? [];
          return (
            <View key={c.category} style={styles.categoryCard} wrap={false}>
              <View style={styles.categoryHeader}>
                <View style={[styles.pill, { backgroundColor: pill.bg }]}>
                  <Text style={{ color: pill.fg }}>{pill.label}</Text>
                </View>
                <Text style={styles.categoryTitle}>{CATEGORY_LABELS[c.category]}</Text>
              </View>
              <Text style={styles.scoreLine}>
                Gewichtung {c.weight}% · Rohwert {c.rawScore} · Gewichteter Wert{' '}
                {c.weightedScore.toFixed(1)}
              </Text>
              {questions.map(q => {
                const answer = assessment.answers[q.id];
                const answerText = answer?.isNotApplicable
                  ? 'Nicht anwendbar'
                  : typeof answer?.value === 'string'
                    ? answer.value
                    : typeof answer?.value === 'number'
                      ? String(answer.value)
                      : typeof answer?.rawScore === 'number'
                        ? `Score ${answer.rawScore}`
                        : '—';
                return (
                  <Text key={q.id} style={styles.evidenceQ}>
                    {q.prompt.de} — <Text style={{ color: TEAL_ACCENT }}>{answerText}</Text>
                    {q.drvReference ? (
                      <Text style={{ color: GREY_MUTED }}> · {q.drvReference}</Text>
                    ) : null}
                  </Text>
                );
              })}
            </View>
          );
        })}

        <Text style={styles.footer} fixed>
          DRV Defensivdokumentation · {organization.name} · {renderedAtLabel}
        </Text>
        <Text style={styles.pageNumber} fixed render={renderPageNumber} />
      </Page>

      {/* Section 3: risk history */}
      <Page size="A4" style={styles.page} wrap>
        <Text style={styles.sectionTitle}>3 · {sectionTitles.riskAssessmentHistory}</Text>
        {history.map((row, index) => {
          if (row.outcome?.kind !== 'SCHEINSELBSTANDIGKEIT') return null;
          const pill = VERDICT_COLOURS[row.outcome.verdict];
          const prev = history[index + 1];
          const prevOutcome = prev?.outcome;
          const deltaText =
            prevOutcome && prevOutcome.kind === 'SCHEINSELBSTANDIGKEIT'
              ? `${formatDelta(row.outcome.totalScore, prevOutcome.totalScore)} — ${prevOutcome.verdict} → ${row.outcome.verdict}`
              : 'Erste Bewertung — kein Vergleichswert';
          return (
            <View key={row.id} style={styles.historyRow} wrap={false}>
              <View style={styles.historyMeta}>
                <View style={[styles.pill, { backgroundColor: pill.bg, marginBottom: 4 }]}>
                  <Text style={{ color: pill.fg }}>{pill.label}</Text>
                </View>
                <Text style={styles.scoreLine}>
                  {formatDate(row.completedAt)} · Regelwerk {row.ruleSetVersion} · Gesamt{' '}
                  {row.outcome.totalScore}
                </Text>
              </View>
              <Text style={styles.historyDelta}>{deltaText}</Text>
            </View>
          );
        })}

        <Text style={styles.footer} fixed>
          DRV Defensivdokumentation · {organization.name} · {renderedAtLabel}
        </Text>
        <Text style={styles.pageNumber} fixed render={renderPageNumber} />
      </Page>

      {/* Section 4: attestation + cross-reference */}
      <Page size="A4" style={styles.page} wrap>
        <Text style={styles.sectionTitle}>4 · {sectionTitles.otherClientAttestation}</Text>

        <View style={styles.tableRow} wrap={false}>
          <Text style={styles.tableHeaderCell}>{tableHeaders.client}</Text>
          <Text style={styles.tableHeaderCell}>{tableHeaders.role}</Text>
          <Text style={styles.tableHeaderCell}>{tableHeaders.startDate}</Text>
          <Text style={styles.tableHeaderCell}>{tableHeaders.endDate}</Text>
        </View>
        {crossReference.length === 0 ? (
          <Text style={styles.scoreLine}>
            Keine weiteren Engagements auf dieser Plattform erfasst.
          </Text>
        ) : (
          crossReference.map(row => (
            <View key={row.id} style={styles.tableRow} wrap={false}>
              <Text style={styles.tableCell}>{row.organization.name}</Text>
              <Text style={styles.tableCell}>{row.project?.name ?? '—'}</Text>
              <Text style={styles.tableCell}>{formatDate(row.activeFrom)}</Text>
              <Text style={styles.tableCell}>
                {row.activeTo ? formatDate(row.activeTo) : 'Laufend'}
              </Text>
            </View>
          ))
        )}

        <Text style={styles.footerNote}>{DRV_DEFENSE_CROSS_REFERENCE_FOOTER_DE}</Text>

        <View style={styles.attestationText} wrap={false}>
          <Text>{attestation.statementText}</Text>
          <Text style={{ marginTop: 12 }}>{DRV_DEFENSE_ATTESTATION_FOOTER_DE}</Text>
          <Text style={styles.footerNote}>
            Unterzeichnet von {attestation.signedName} am {formatDate(attestation.signedAt)}
          </Text>
        </View>

        <Text style={styles.footer} fixed>
          DRV Defensivdokumentation · {organization.name} · {renderedAtLabel}
        </Text>
        <Text style={styles.pageNumber} fixed render={renderPageNumber} />
      </Page>

      {/* Disclaimer */}
      <Page size="A4" style={styles.page} wrap>
        <Text style={styles.sectionTitle}>Rechtlicher Hinweis</Text>
        <Text style={styles.disclaimer}>{DRV_DEFENSE_DISCLAIMER_DE}</Text>

        <Text style={styles.footer} fixed>
          DRV Defensivdokumentation · {organization.name} · {renderedAtLabel}
        </Text>
        <Text style={styles.pageNumber} fixed render={renderPageNumber} />
      </Page>
    </Document>
  );
}
