// Phase 58 Plan 05 Task 1 — outcome page behaviour contract.
//
// OC-1/2 IR35 variant, OC-3/4/5 DRV variant, OC-6 snapshot-not-live (Pitfall 1
// — LOAD-BEARING), OC-7 disclaimer gate, OC-8 IDOR fallback.

import { beforeEach, describe, expect, it, vi } from 'vitest';

const mockAssessment: { current: unknown } = { current: null };

vi.mock('next/navigation', () => ({
  useParams: () => ({ id: 'c1', engagementId: 'e1', assessmentId: 'a1' }),
}));

vi.mock('@/i18n/navigation', () => ({
  useRouter: () => ({ push: vi.fn() }),
  Link: ({ href, children }: { href: string; children: React.ReactNode }) => (
    <a href={href}>{children}</a>
  ),
}));

vi.mock('@/trpc/init', () => ({
  trpc: {
    classification: {
      getById: {
        queryOptions: ({ assessmentId }: { assessmentId: string }) => ({
          queryKey: [['classification', 'getById'], assessmentId],
          queryFn: async () => mockAssessment.current,
        }),
      },
      acknowledgeDisclaimer: {
        mutationOptions: () => ({ mutationFn: async () => ({ ok: true }) }),
      },
    },
  },
}));

vi.mock('sonner', () => ({ toast: { error: vi.fn(), success: vi.fn() } }));

// Mock the live rule-set constant. TEST OC-6 later flips this value; the
// outcome page must continue to render the snapshotted prompt, NOT this.
vi.mock('@contractor-ops/classification', async () => {
  const actual = await vi.importActual<Record<string, unknown>>('@contractor-ops/classification');
  return {
    ...actual,
    IR35_QUESTIONS: [
      {
        id: 'IR35-SUB-01',
        area: 'substitution',
        prompt: { en: 'TAMPERED', pl: 'TAMPERED', de: 'TAMPERED' },
        helpText: { en: 't', pl: 't', de: 't' },
        answerType: 'yes-no',
        required: true,
      },
    ],
  };
});

import { render, screen, waitFor } from '@/test/test-utils';

import OutcomePage from '../page';

function buildIr35Assessment() {
  return {
    id: 'a1',
    organizationId: 'o1',
    contractorAssignmentId: 'e1',
    countryCode: 'GB',
    ruleSetVersion: 'IR35-2024-CEST',
    status: 'completed',
    questionsSnapshot: {
      ruleSetVersion: 'IR35-2024-CEST',
      profileId: 'ir35',
      questions: [
        {
          id: 'IR35-SUB-01',
          area: 'substitution',
          prompt: { en: 'Original prompt Q1', pl: 'PL', de: 'DE' },
          helpText: { en: 'h', pl: 'h', de: 'h' },
          answerType: 'yes-no',
          required: true,
        },
      ],
    },
    answers: { 'IR35-SUB-01': 'yes' },
    outcome: {
      kind: 'IR35',
      ruleSetVersion: 'IR35-2024-CEST',
      verdict: 'outside',
      areas: [
        {
          area: 'substitution',
          verdict: 'strong-outside',
          caseLawCitations: ['Ready Mixed Concrete [1968]'],
          drivingQuestionIds: ['IR35-SUB-01'],
        },
        {
          area: 'control',
          verdict: 'leaning-outside',
          caseLawCitations: [],
          drivingQuestionIds: [],
        },
        {
          area: 'financial-risk',
          verdict: 'neutral',
          caseLawCitations: [],
          drivingQuestionIds: [],
        },
        {
          area: 'part-and-parcel',
          verdict: 'leaning-outside',
          caseLawCitations: [],
          drivingQuestionIds: [],
        },
        {
          area: 'moo',
          verdict: 'leaning-outside',
          caseLawCitations: [],
          drivingQuestionIds: [],
        },
      ],
      computedAt: new Date().toISOString(),
    },
    completedAt: new Date('2026-04-10T10:00:00Z'),
    disclaimerAcknowledgedAt: new Date(),
    immutableAfter: new Date(),
    createdAt: new Date(),
    updatedAt: new Date(),
  };
}

function buildDrvAssessment() {
  return {
    ...buildIr35Assessment(),
    countryCode: 'DE',
    ruleSetVersion: 'SCHEINSELBSTANDIGKEIT-DRV-2024',
    questionsSnapshot: {
      ruleSetVersion: 'SCHEINSELBSTANDIGKEIT-DRV-2024',
      profileId: 'scheinselbstandigkeit',
      questions: [
        {
          id: 'DRV-INT-01',
          category: 'integration',
          prompt: { en: 'Integration Q1', pl: 'PL', de: 'Integration DE' },
          helpText: { en: 'h', pl: 'h', de: 'h' },
          answerType: 'score-0-3',
          required: true,
        },
      ],
    },
    outcome: {
      kind: 'SCHEINSELBSTANDIGKEIT',
      ruleSetVersion: 'SCHEINSELBSTANDIGKEIT-DRV-2024',
      verdict: 'amber',
      totalScore: 45,
      categories: [
        {
          category: 'integration',
          weight: 30,
          rawScore: 1.5,
          weightedScore: 45,
          verdict: 'amber',
          drvReferences: ['DRV § 7 SGB IV'],
        },
        {
          category: 'entrepreneurial',
          weight: 30,
          rawScore: 1,
          weightedScore: 30,
          verdict: 'amber',
          drvReferences: [],
        },
        {
          category: 'personal-dep',
          weight: 25,
          rawScore: 0.5,
          weightedScore: 12.5,
          verdict: 'green',
          drvReferences: [],
        },
        {
          category: 'economic-dep',
          weight: 15,
          rawScore: 2,
          weightedScore: 30,
          verdict: 'amber',
          drvReferences: [],
        },
      ],
      computedAt: new Date().toISOString(),
    },
  };
}

describe('ClassificationOutcomePage (Plan 05 Task 1)', () => {
  beforeEach(() => {
    mockAssessment.current = null;
  });

  it('OC-1/2: IR35 variant renders verdict banner + 5 area cards', async () => {
    mockAssessment.current = buildIr35Assessment();
    render(<OutcomePage />);
    await waitFor(() => {
      expect(screen.getByTestId('verdict-banner')).toBeInTheDocument();
    });
    expect(screen.getAllByTestId('ir35-area-card')).toHaveLength(5);
    const banner = screen.getByTestId('verdict-banner');
    expect(banner.getAttribute('data-tone')).toBe('success');
    expect(banner.getAttribute('data-kind')).toBe('ir35');
  });

  it('OC-3/4: DRV variant renders traffic-light banner + 4 category bars', async () => {
    mockAssessment.current = buildDrvAssessment();
    render(<OutcomePage />);
    await waitFor(() => {
      expect(screen.getByTestId('verdict-banner')).toBeInTheDocument();
    });
    expect(screen.getAllByTestId('drv-category-bar')).toHaveLength(4);
    const banner = screen.getByTestId('verdict-banner');
    expect(banner.getAttribute('data-tone')).toBe('warning');
    expect(banner.getAttribute('data-kind')).toBe('drv');
  });

  it('OC-6 (Pitfall 1 — LOAD-BEARING): renders snapshot prompt, not live rule-set', async () => {
    mockAssessment.current = buildIr35Assessment();
    render(<OutcomePage />);
    await waitFor(() => {
      expect(screen.getByText('Original prompt Q1')).toBeInTheDocument();
    });
    expect(screen.queryByText('TAMPERED')).not.toBeInTheDocument();
  });

  it('OC-7: disclaimer dialog is mounted when disclaimerAcknowledgedAt is null', async () => {
    const a = buildIr35Assessment();
    a.disclaimerAcknowledgedAt = null as unknown as Date;
    mockAssessment.current = a;
    render(<OutcomePage />);
    await waitFor(() => {
      expect(screen.getByRole('alertdialog')).toBeInTheDocument();
    });
  });

  it('OC-7: disclaimer dialog is NOT mounted when disclaimerAcknowledgedAt is set', async () => {
    mockAssessment.current = buildIr35Assessment();
    render(<OutcomePage />);
    await waitFor(() => {
      expect(screen.getByTestId('verdict-banner')).toBeInTheDocument();
    });
    expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument();
  });

  it('OC-8 (IDOR): null query response renders a notFound card', async () => {
    mockAssessment.current = null;
    render(<OutcomePage />);
    await waitFor(() => {
      expect(screen.getByText(/not available/i)).toBeInTheDocument();
    });
  });
});
