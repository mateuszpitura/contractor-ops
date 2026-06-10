// UK IP-clause phrase library.
//
// Per-jurisdiction phrase library used by the contract health check
// (run-health-check.ts) for regex grounding (LLM-first verdict + regex
// sanity check). Each phrase entry's legal sign-off status is tracked separately
// in `signoff-registry.json` under `legal-signoff.ip_clauses.<phraseId>`.
//
// DO NOT add any of these phrase IDs as keys in messages/*.json — these are
// regex patterns matched against contract PDF text, not user-facing strings.
//
// Legal sign-off: PENDING per Standing Constraint. Production wording flips
// PENDING → APPROVED via post-deploy PR per UK adviser, each carrying upstreamRef.

export const IP_CLAUSES_UK = {
  'uk.hereby_assigns@v1': {
    regex: /\bhereby\s+(absolutely\s+and\s+irrevocably\s+)?assigns?\b/i,
    citedTextExample:
      'the Contractor hereby assigns to the Company all intellectual property rights, present and future, in the Works',
    locale: 'en' as const,
    jurisdiction: 'UK' as const,
    sufficiencyForJurisdiction: 'UK' as const,
    legalBasisRef: 'Copyright, Designs and Patents Act 1988 s.90(1)',
    version: 1 as const,
  },
  'uk.assignment_present_and_future@v1': {
    regex: /(present\s+and\s+future|now\s+existing\s+and\s+hereafter)\s+(rights|copyrights?)/i,
    citedTextExample: 'present and future rights in all such Works',
    locale: 'en' as const,
    jurisdiction: 'UK' as const,
    sufficiencyForJurisdiction: 'UK' as const,
    legalBasisRef: 'Copyright, Designs and Patents Act 1988 s.91 (future copyright)',
    version: 1 as const,
  },
  'uk.moral_rights_waiver@v1': {
    regex: /waiv(er|es?|ing)\s+of\s+(all\s+)?moral\s+rights/i,
    citedTextExample: 'the Contractor waives all moral rights in the Works',
    locale: 'en' as const,
    jurisdiction: 'UK' as const,
    sufficiencyForJurisdiction: 'UK' as const,
    legalBasisRef: 'Copyright, Designs and Patents Act 1988 s.87',
    version: 1 as const,
  },
} as const;

export type UkIpClausePhraseId = keyof typeof IP_CLAUSES_UK;
