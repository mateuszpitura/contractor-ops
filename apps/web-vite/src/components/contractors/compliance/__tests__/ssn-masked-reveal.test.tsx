/**
 * Phase 84 · Plan 00 (Wave 0 RED) — US-FIELD-02 / US-FIELD-04, UI-SPEC §B.
 * See .planning/milestones/v7.0-phases/84-.../84-UI-SPEC.md §B.
 *
 * RED until Plan 05 creates
 *   apps/web-vite/src/components/contractors/compliance/ssn-masked-reveal.tsx
 * exporting `SsnMaskedReveal`. The import below resolves to a not-yet-existing
 * module so the suite fails (Cannot find module).
 *
 * Locks the five UI-SPEC §B states:
 *   1. Masked (default) — `•••-••-1234`, last-4 aria-label, NO full value in DOM
 *   2. Reveal absent    — canReveal=false → reveal control NOT rendered (not disabled)
 *   3. Reveal available — canReveal=true → "Reveal SSN" button present
 *   4. Revealed         — click → loading (Loader2) → full value + "Hide SSN"
 *   5. Reveal error     — inline role="alert" FieldError + fall back to masked
 *
 * The tRPC reveal mutation is mocked. Path-scoped only — NEVER the unscoped
 * web-vite suite (RAM constraint).
 */

import { describe, expect, it, vi } from 'vitest';

// Mock the reveal hook (the only tRPC boundary for this component). Each test
// overrides the implementation to exercise idle / loading / success / error.
const mockReveal = vi.fn();
vi.mock('../hooks/use-reveal-ssn.js', () => ({
  useRevealSsn: () => mockReveal(),
}));

import { render, screen, waitFor } from '../../../../test/test-utils.js';
import { SsnMaskedReveal } from '../ssn-masked-reveal.js';

function idleHook(over: Record<string, unknown> = {}) {
  return {
    reveal: vi.fn(),
    revealedSsn: undefined,
    isPending: false,
    isError: false,
    error: null,
    reset: vi.fn(),
    ...over,
  };
}

describe('SsnMaskedReveal — masked default (UI-SPEC §B state 1)', () => {
  it('shows the masked •••-••-1234 display with a last-4 aria-label and no full value', () => {
    mockReveal.mockReturnValue(idleHook());
    render(<SsnMaskedReveal contractorId="contractor-1" last4="1234" canReveal={false} />);
    expect(screen.getByText('•••-••-1234')).toBeInTheDocument();
    expect(screen.getByLabelText(/last four digits 1234/i)).toBeInTheDocument();
    // No full 9-digit value anywhere in the DOM.
    expect(document.body.textContent).not.toMatch(/\d{3}-\d{2}-\d{4}/);
  });
});

describe('SsnMaskedReveal — reveal absent (UI-SPEC §B state 2)', () => {
  it('does NOT render the reveal control when canReveal=false (absent, not disabled)', () => {
    mockReveal.mockReturnValue(idleHook());
    render(<SsnMaskedReveal contractorId="contractor-1" last4="1234" canReveal={false} />);
    expect(screen.queryByRole('button', { name: /Reveal SSN/i })).toBeNull();
  });
});

describe('SsnMaskedReveal — reveal available (UI-SPEC §B state 3)', () => {
  it('renders the "Reveal SSN" button when canReveal=true', () => {
    mockReveal.mockReturnValue(idleHook());
    render(<SsnMaskedReveal contractorId="contractor-1" last4="1234" canReveal={true} />);
    expect(screen.getByRole('button', { name: /Reveal SSN/i })).toBeInTheDocument();
  });
});

describe('SsnMaskedReveal — revealed flow (UI-SPEC §B state 4)', () => {
  it('shows a loading spinner while pending, then the full value + "Hide SSN"', async () => {
    const reveal = vi.fn();
    // Loading state.
    mockReveal.mockReturnValue(idleHook({ reveal, isPending: true }));
    const { rerender } = render(
      <SsnMaskedReveal contractorId="contractor-1" last4="1234" canReveal={true} />,
    );
    expect(document.querySelector('.animate-spin')).toBeTruthy();

    // Resolved state — full value present, toggle flips to "Hide SSN".
    mockReveal.mockReturnValue(idleHook({ reveal, revealedSsn: '078-05-1234', isPending: false }));
    rerender(<SsnMaskedReveal contractorId="contractor-1" last4="1234" canReveal={true} />);
    await waitFor(() => {
      expect(screen.getByText('078-05-1234')).toBeInTheDocument();
    });
    expect(screen.getByRole('button', { name: /Hide SSN/i })).toBeInTheDocument();
  });
});

describe('SsnMaskedReveal — reveal error (UI-SPEC §B state 5)', () => {
  it('renders an inline role="alert" error and falls back to the masked display', () => {
    mockReveal.mockReturnValue(
      idleHook({ isError: true, error: new Error('reveal failed'), revealedSsn: undefined }),
    );
    render(<SsnMaskedReveal contractorId="contractor-1" last4="1234" canReveal={true} />);
    expect(screen.getByRole('alert')).toBeInTheDocument();
    // Falls back to masked.
    expect(screen.getByText('•••-••-1234')).toBeInTheDocument();
  });
});
