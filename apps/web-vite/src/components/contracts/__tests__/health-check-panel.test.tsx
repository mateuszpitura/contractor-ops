import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@/test/test-utils';
import { HealthCheckPanel } from '../health-check-panel';

type ResultsJson = {
  version: 1;
  ipAssignment: Record<string, unknown>;
};

const baseResult: ResultsJson = {
  version: 1,
  ipAssignment: {
    verdict: 'LIKELY_PRESENT',
    citedClauses: [
      {
        phraseId: 'uk.hereby_assigns@v1',
        jurisdiction: 'UK',
        citedText: 'the Contractor hereby assigns all rights',
        confidence: 0.95,
        regexMatched: true,
        regexMatchSpan: { startChar: 0, endChar: 30 },
      },
    ],
    evaluatedAgainst: [{ jurisdiction: 'UK', phraseLibraryVersion: '1.0.0' }],
    rawModelToolUseInput: {},
    runId: 'run_1',
    runStartedAt: '2026-05-31T08:00:00.000Z',
    runCompletedAt: '2026-05-31T08:00:42.000Z',
  },
};

function withVerdict(verdict: string, extra: Record<string, unknown> = {}): ResultsJson {
  return {
    version: 1,
    ipAssignment: { ...baseResult.ipAssignment, verdict, ...extra },
  };
}

describe('<HealthCheckPanel /> (Phase 75 D-09 + D-16)', () => {
  it('renders LIKELY_PRESENT verdict with the cited clause text', () => {
    render(<HealthCheckPanel resultsJson={baseResult} />);
    expect(screen.getByText('Likely present')).toBeInTheDocument();
    expect(screen.getByText(/hereby assigns all rights/)).toBeInTheDocument();
  });

  it('renders LIKELY_MISSING verdict with the no-cited-clauses message', () => {
    render(<HealthCheckPanel resultsJson={withVerdict('LIKELY_MISSING', { citedClauses: [] })} />);
    expect(screen.getByText('Likely missing')).toBeInTheDocument();
    expect(screen.getByText(/No IP-assignment language found/)).toBeInTheDocument();
  });

  it('renders MANUAL_REVIEW_REQUIRED with the cross-jurisdiction-mismatch flag', () => {
    render(
      <HealthCheckPanel
        resultsJson={withVerdict('MANUAL_REVIEW_REQUIRED', {
          crossJurisdictionMismatch: { foundJurisdiction: 'UK', expectedJurisdiction: 'DE' },
        })}
      />,
    );
    expect(screen.getByTestId('cross-jurisdiction-mismatch')).toBeInTheDocument();
  });

  it('renders the PENDING-phrase footer + marker when pendingPhrasesCited is non-empty', () => {
    render(
      <HealthCheckPanel
        resultsJson={withVerdict('LIKELY_PRESENT', {
          pendingPhrasesCited: ['uk.hereby_assigns@v1'],
        })}
      />,
    );
    expect(screen.getByTestId('pending-phrase-footer')).toBeInTheDocument();
    expect(screen.getByTestId('pending-phrase-marker')).toBeInTheDocument();
  });

  it('hides the Re-run button in readOnly mode', () => {
    render(<HealthCheckPanel resultsJson={baseResult} readOnly />);
    expect(screen.queryByTestId('health-check-rerun')).not.toBeInTheDocument();
  });

  it('shows the Re-run button and calls onRerun by default', async () => {
    const onRerun = vi.fn();
    const { setup } = await import('@/test/test-utils');
    const { user } = setup(<HealthCheckPanel resultsJson={baseResult} onRerun={onRerun} />);
    const button = screen.getByTestId('health-check-rerun');
    expect(button).toBeInTheDocument();
    await user.click(button);
    expect(onRerun).toHaveBeenCalledOnce();
  });

  it('renders the fallback message when resultsJson does not validate', () => {
    render(<HealthCheckPanel resultsJson={{ malformed: 'data' }} />);
    expect(screen.getByText(/Health-check data uses an unsupported format/)).toBeInTheDocument();
  });

  it.todo(
    'AuditLog drill-in renders the same panel from historical resultsJson (covered in audit-log detail tests)',
  );
});
