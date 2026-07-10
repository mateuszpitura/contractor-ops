// Team-calendar contract: overlapping same-team approved leave renders
// an accessible conflict marker (icon + text, never color alone) and the
// capacity band aggregates the share of the team out into success/warning/danger
// tiers.

import { describe, expect, it } from 'vitest';

import { render, screen } from '../../../test/test-utils.js';
import { TeamCalendarView } from '../team-calendar/team-calendar-view.js';

const CONFLICT_DAY = {
  date: '2026-01-12',
  teamId: 'team-eng',
  teamName: 'Engineering',
  headcount: 4,
  outCount: 2,
  capacityPct: 50,
  conflict: true,
  holiday: null,
  requests: [
    { id: 'r1', workerName: 'A. Nowak', status: 'APPROVED' as const },
    { id: 'r2', workerName: 'B. Kowalski', status: 'APPROVED' as const },
  ],
};

const CALM_DAY = {
  date: '2026-01-13',
  teamId: 'team-eng',
  teamName: 'Engineering',
  headcount: 4,
  outCount: 0,
  capacityPct: 0,
  conflict: false,
  holiday: null,
  requests: [],
};

describe('TeamCalendarView', () => {
  it('renders an accessible conflict marker on overlapping same-team approved leave', () => {
    render(
      <TeamCalendarView viewMode="month" days={[CONFLICT_DAY, CALM_DAY]} anchorDate="2026-01-01" />,
    );
    // Non-color cue: the conflict must be conveyed by text, not colour alone.
    expect(screen.getByText(/conflict/i)).toBeInTheDocument();
  });

  it('aggregates the capacity band from the share of the team out', () => {
    render(
      <TeamCalendarView viewMode="month" days={[CONFLICT_DAY, CALM_DAY]} anchorDate="2026-01-01" />,
    );
    // The 50%-out day surfaces its capacity figure.
    expect(screen.getByText(/50/)).toBeInTheDocument();
  });
});
