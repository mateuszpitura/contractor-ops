#!/usr/bin/env tsx
/**
 * Cross-join procedures.json + fe-callers.json -> findings.json + AUDIT.md.
 *
 * Severity rules:
 *   HIGH:
 *     - Destructive mutation call site with no AlertDialog in same file (missing confirm)
 *     - Mutation call site with no onError (silent failure)
 *     - Destructive orphan procedure (no FE caller)
 *   MED:
 *     - Mutation onSuccess present but no invalidation
 *     - Mutation onError present but no toast.error
 *     - Mutation onSuccess present but no toast.success (non-destructive)
 *     - Non-destructive orphan procedure
 *   LOW:
 *     - Mutation present but no isPending reference (no loading/disabled wiring)
 */
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const DATA = resolve(__dirname, '../data');
const procedures = JSON.parse(
  readFileSync(resolve(DATA, 'procedures.json'), 'utf8'),
) as Procedure[];
const callers = JSON.parse(readFileSync(resolve(DATA, 'fe-callers.json'), 'utf8')) as Caller[];
const falsePositives: FalsePositiveEntry[] = existsSync(resolve(DATA, 'false-positives.json'))
  ? (JSON.parse(
      readFileSync(resolve(DATA, 'false-positives.json'), 'utf8'),
    ) as FalsePositiveEntry[])
  : [];

type Procedure = {
  surface: string;
  path: string;
  type: 'query' | 'mutation' | 'subscription';
  middleware: string;
  destructive: boolean;
  file: string;
  line: number;
  inputFields?: string[];
};

const REASON_FIELD_NAMES = new Set([
  'reason',
  'comment',
  'note',
  'rejectReason',
  'rejectionReason',
]);
const SOFT_DELETE_SELF_PROCS = new Set([
  // Procedures that retire the actor's own scope (org/account/profile). After
  // success there are no caches to invalidate because subsequent reads hit a
  // deleted-org / no-session branch — invalidation is pointless.
  'gdpr.requestErasure',
  'organization.deleteSelf',
  'user.deleteAccount',
]);

function procHasReasonField(proc: Procedure | undefined): boolean {
  return Boolean(proc?.inputFields?.some(f => REASON_FIELD_NAMES.has(f)));
}

function isWizardStepProcedure(c: Caller): boolean {
  // Heuristic: ZATCA onboarding wizard advances by re-querying
  // getOnboardingState between steps. The mutation surfaces live under
  // components/zatca/ and their parent form re-runs the query — no FE-side
  // invalidate needed.
  return c.file.startsWith('apps/web/src/components/zatca/');
}
type Caller = {
  client: string;
  path: string;
  kind: string;
  file: string;
  line: number;
  handlers: {
    hasOnSuccess: boolean;
    hasOnError: boolean;
    hasToastSuccess: boolean;
    hasToastError: boolean;
    hasInvalidation: boolean;
    hasIsPending: boolean;
    hasOnMutate?: boolean;
    hasEmptyOnError?: boolean;
  };
  fileHasAlertDialog: boolean;
  isInHookFile?: boolean;
  isCalledInUseEffect?: boolean;
  isInRoutedAlias?: boolean;
  fileHasFileInputTrigger?: boolean;
  hasRedirectAfterMutate?: boolean;
};
type Severity = 'HIGH' | 'MED' | 'LOW';
type FalsePositiveEntry = {
  procedure: string;
  file: string;
  category: string;
  pattern: string;
  reason: string;
};
type Triage = {
  status: 'false-positive';
  pattern: string;
  reason: string;
};
type Finding = {
  id: string;
  severity: Severity;
  category: string;
  procedure?: string;
  file?: string;
  line?: number;
  problem: string;
  fix: string;
  triage?: Triage;
};

const findings: Finding[] = [];
const counter = { HIGH: 0, MED: 0, LOW: 0 };
function fid(s: Severity) {
  counter[s]++;
  return `F-${s}-${String(counter[s]).padStart(3, '0')}`;
}

// ---------------------------------------------------------------------------
// Build lookup: procedure path -> caller list
// ---------------------------------------------------------------------------

const callersByPath = new Map<string, Caller[]>();
for (const c of callers) {
  const arr = callersByPath.get(c.path) ?? [];
  arr.push(c);
  callersByPath.set(c.path, arr);
}

// ---------------------------------------------------------------------------
// Direction A: BE -> FE (orphans)
// ---------------------------------------------------------------------------

const ORPHAN_INTENTIONAL_HINTS = [
  // Heuristics for "likely intentional non-UI" — these still emit findings but
  // get tagged so the triage step can move them to the appendix.
  /^public-api\./,
  /^webhook/i,
];

for (const proc of procedures) {
  const fePath = proc.path; // matches both trpc.X.Y and portalTrpc.X.Y
  const consumers = callersByPath.get(fePath) ?? [];
  if (consumers.length === 0) {
    const sev: Severity = proc.destructive ? 'HIGH' : 'MED';
    const intentional = ORPHAN_INTENTIONAL_HINTS.some(r => r.test(proc.path));
    findings.push({
      id: fid(sev),
      severity: sev,
      category: intentional ? 'orphan-likely-intentional' : 'orphan',
      procedure: proc.path,
      file: proc.file,
      line: proc.line,
      problem: `Procedure ${proc.path} (${proc.type}, surface=${proc.surface}) has no FE caller.`,
      fix: intentional
        ? 'Confirm caller (cron/webhook/public-api consumer) and move to AUDIT appendix. Delete if truly unused.'
        : 'Wire to relevant UI action, or delete procedure if obsolete, or document non-UI caller.',
    });
  }
}

// ---------------------------------------------------------------------------
// Direction B: FE -> BE (handler gaps)
// ---------------------------------------------------------------------------

// Pattern-aware suppression flags. Each predicate folds an Appendix-B
// pattern back into the detector so the corresponding finding is never
// emitted in the first place — the manifest entries that previously
// shouldered these become inert (still preserved as documentation).
function isHookCaller(c: Caller): boolean {
  return c.isInHookFile === true;
}
function isOptimisticUpdate(c: Caller): boolean {
  return c.handlers.hasOnMutate === true;
}
function isEffectDriven(c: Caller): boolean {
  return c.isCalledInUseEffect === true;
}
function isRoutedAlias(c: Caller): boolean {
  return c.isInRoutedAlias === true;
}
function hasSilentErrorHandler(c: Caller): boolean {
  return c.handlers.hasEmptyOnError === true;
}
function hasFileInputTrigger(c: Caller): boolean {
  return c.fileHasFileInputTrigger === true;
}
function hasRedirectAfterMutate(c: Caller): boolean {
  return c.hasRedirectAfterMutate === true;
}

// Only inspect mutationOptions call sites (queries don't need toasts/confirm)
for (const c of callers) {
  if (c.kind !== 'mutationOptions') continue;
  const proc = procedures.find(p => p.path === c.path);
  const destructive = proc?.destructive ?? false;

  // HIGH: destructive without AlertDialog in same file. Skip when:
  //   - the mutation lives in a hook file (consumer-wraps-hook pattern), OR
  //   - the procedure input itself requires a reason/comment/note string
  //     (rejection-with-reason — required text input gates the mutation).
  const reasonGated = procHasReasonField(proc);
  if (destructive && !c.fileHasAlertDialog && !isHookCaller(c) && !reasonGated) {
    findings.push({
      id: fid('HIGH'),
      severity: 'HIGH',
      category: 'missing-confirmation',
      procedure: c.path,
      file: c.file,
      line: c.line,
      problem: `Destructive mutation ${c.path} fires without a confirmation dialog in this file.`,
      fix: 'Wrap the trigger in <AlertDialog> from @/components/ui/alert-dialog and only call mutate from AlertDialogAction onClick.',
    });
  }

  // HIGH: no onError (silent failure)
  if (!c.handlers.hasOnError) {
    findings.push({
      id: fid('HIGH'),
      severity: 'HIGH',
      category: 'missing-on-error',
      procedure: c.path,
      file: c.file,
      line: c.line,
      problem: `Mutation ${c.path} has no onError handler — failures are silent.`,
      fix: 'Add onError: (err) => toast.error(err.message) to the mutationOptions argument.',
    });
  } else if (!(c.handlers.hasToastError || hasSilentErrorHandler(c))) {
    // MED: onError present but no toast. Skip when onError body is empty
    // (intentional-silent-handler — typically logout flows where the failure
    // path is non-actionable for an already-signed-out user).
    findings.push({
      id: fid('MED'),
      severity: 'MED',
      category: 'missing-error-toast',
      procedure: c.path,
      file: c.file,
      line: c.line,
      problem: `Mutation ${c.path} has onError but does not call toast.error — user sees no error feedback.`,
      fix: 'Inside the existing onError handler, call toast.error(err.message) (or a translated message).',
    });
  }

  // MED: no onSuccess at all OR onSuccess without toast (non-destructive only — destructive often has separate redirect/UX)
  if (c.handlers.hasOnSuccess) {
    if (!c.handlers.hasToastSuccess) {
      findings.push({
        id: fid('MED'),
        severity: 'MED',
        category: 'missing-success-toast',
        procedure: c.path,
        file: c.file,
        line: c.line,
        problem: `Mutation ${c.path} succeeds with no toast.success — user gets no confirmation.`,
        fix: 'Call toast.success("...") inside the existing onSuccess handler.',
      });
    }
    if (
      !(
        c.handlers.hasInvalidation ||
        isOptimisticUpdate(c) ||
        SOFT_DELETE_SELF_PROCS.has(c.path) ||
        isWizardStepProcedure(c)
      )
    ) {
      // Suppressions:
      //   - optimistic-update: onMutate + onSettled refreshes the cache.
      //   - soft-delete-self: nothing to invalidate after the org / session
      //     is gone.
      //   - wizard-step-progression: ZATCA wizard re-queries
      //     getOnboardingState between steps; UI is conditional on local
      //     step state, not cache freshness.
      findings.push({
        id: fid('MED'),
        severity: 'MED',
        category: 'missing-invalidation',
        procedure: c.path,
        file: c.file,
        line: c.line,
        problem: `Mutation ${c.path} succeeds without invalidating queries — stale UI until reload.`,
        fix: 'Call queryClient.invalidateQueries({ queryKey: trpc.<relatedQuery>.queryOptions(...).queryKey }) in onSuccess.',
      });
    }
  } else if (!(isOptimisticUpdate(c) || isHookCaller(c) || hasRedirectAfterMutate(c))) {
    // Skip when:
    //   - onMutate present (optimistic-update flow refreshes cache).
    //   - mutation lives in a hook (consumer chains via mutateAsync and
    //     handles post-success work).
    //   - redirect-on-mutate: file uses router.replace / window.location.href
    //     AND awaits mutateAsync. After the redirect there's no UI to update.
    findings.push({
      id: fid('MED'),
      severity: 'MED',
      category: 'missing-on-success',
      procedure: c.path,
      file: c.file,
      line: c.line,
      problem: `Mutation ${c.path} has no onSuccess handler — UI never updates or confirms.`,
      fix: 'Add onSuccess: () => { toast.success(...); queryClient.invalidateQueries({ queryKey: ... }); }',
    });
  }

  // LOW: no isPending reference (no loading/disabled wiring). Suppressed by:
  //   - hook-bound mutation (consumer drives loading state)
  //   - optimistic-update (no need to disable; cache mutates first)
  //   - effect-driven mutation (no user-clickable trigger)
  //   - routed-mutation alias (the active branch is the wired trigger)
  //   - file-input trigger (the <input type="file"> can't be disabled mid-
  //     upload; a step-state machine gates progress)
  if (
    !(
      c.handlers.hasIsPending ||
      isHookCaller(c) ||
      isOptimisticUpdate(c) ||
      isEffectDriven(c) ||
      isRoutedAlias(c) ||
      hasFileInputTrigger(c)
    )
  ) {
    findings.push({
      id: fid('LOW'),
      severity: 'LOW',
      category: 'missing-loading-state',
      procedure: c.path,
      file: c.file,
      line: c.line,
      problem: `Mutation ${c.path} trigger has no isPending reference — button not disabled while pending, double-submit possible.`,
      fix: 'Add disabled={mutation.isPending} to the trigger element and render a loading indicator.',
    });
  }
}

// ---------------------------------------------------------------------------
// Apply manual triage manifest (false-positives.json)
// ---------------------------------------------------------------------------

const fpKey = (e: { procedure?: string; file?: string; category: string }) =>
  `${e.procedure ?? ''}::${e.file ?? ''}::${e.category}`;
const fpIndex = new Map<string, FalsePositiveEntry>();
for (const entry of falsePositives) fpIndex.set(fpKey(entry), entry);

for (const f of findings) {
  const match = fpIndex.get(fpKey(f));
  if (match) {
    f.triage = { status: 'false-positive', pattern: match.pattern, reason: match.reason };
  }
}

// Separate active findings from triaged ones for the AUDIT.md split.
const activeFindings = findings.filter(f => !f.triage);
const triagedFindings = findings.filter(f => f.triage);

// ---------------------------------------------------------------------------
// Write findings + AUDIT.md
// ---------------------------------------------------------------------------

writeFileSync(resolve(DATA, 'findings.json'), JSON.stringify(findings, null, 2), 'utf8');

// ---------------------------------------------------------------------------
// AUDIT.md generation
// ---------------------------------------------------------------------------

const byDomain = (path: string): string => {
  const head = path.split('.')[0];
  // Map to domain folder by membership
  const DOMAIN_MAP: Record<string, string> = {
    // compliance
    classification: 'compliance',
    classificationDashboard: 'compliance',
    classificationDocument: 'compliance',
    consent: 'compliance',
    economicDependencyAlert: 'compliance',
    gdpr: 'compliance',
    ir35Chain: 'compliance',
    ir35Attestation: 'compliance',
    reassessmentTrigger: 'compliance',
    statusfeststellungsverfahren: 'compliance',
    zatca: 'compliance',
    // finance
    bacs: 'finance',
    billing: 'finance',
    exchangeRate: 'finance',
    invoiceIntake: 'finance',
    invoice: 'finance',
    latePaymentInterest: 'finance',
    payment: 'finance',
    skonto: 'finance',
    // equipment
    equipment: 'equipment',
    // workflow
    workflow: 'workflow',
    workflowRoles: 'workflow',
    // integrations
    googleWorkspace: 'integrations',
    jira: 'integrations',
    ksef: 'integrations',
    linear: 'integrations',
    peppol: 'integrations',
    teams: 'integrations',
    integration: 'integrations',
    // portal
    portal: 'portal',
    portalTime: 'portal',
    portalDocMapper: 'portal',
  };
  return DOMAIN_MAP[head] ?? 'core';
};

const bySeverity: Record<Severity, Finding[]> = { HIGH: [], MED: [], LOW: [] };
for (const f of activeFindings) bySeverity[f.severity].push(f);

const domains = [
  'core',
  'compliance',
  'equipment',
  'finance',
  'integrations',
  'portal',
  'workflow',
];
const summary = domains.map(d => {
  const high = activeFindings.filter(
    f => f.severity === 'HIGH' && (f.procedure ? byDomain(f.procedure) === d : false),
  ).length;
  const med = activeFindings.filter(
    f => f.severity === 'MED' && (f.procedure ? byDomain(f.procedure) === d : false),
  ).length;
  const low = activeFindings.filter(
    f => f.severity === 'LOW' && (f.procedure ? byDomain(f.procedure) === d : false),
  ).length;
  return { d, high, med, low, total: high + med + low };
});

const lines: string[] = [];
lines.push('# FE↔BE Integration Audit Report');
lines.push('');
lines.push(`Generated: ${new Date().toISOString()}`);
lines.push('');
lines.push('## Summary');
lines.push('');
lines.push(
  `- Active findings: **${activeFindings.length}** (HIGH ${bySeverity.HIGH.length} / MED ${bySeverity.MED.length} / LOW ${bySeverity.LOW.length})`,
);
lines.push(`- Triaged as false positive: **${triagedFindings.length}** (see Appendix B)`);
lines.push(
  `- Procedures audited: **${procedures.length}** (across appRouter + portalAppRouter + publicApiRouter)`,
);
lines.push(
  `- FE mutation call sites audited: **${callers.filter(c => c.kind === 'mutationOptions').length}**`,
);
lines.push('');
lines.push('### By domain');
lines.push('');
lines.push('| Domain | HIGH | MED | LOW | Total |');
lines.push('|--------|------|-----|-----|-------|');
for (const s of summary) {
  lines.push(`| ${s.d} | ${s.high} | ${s.med} | ${s.low} | ${s.total} |`);
}
lines.push('');

for (const sev of ['HIGH', 'MED', 'LOW'] as const) {
  lines.push(`## ${sev} (${bySeverity[sev].length})`);
  lines.push('');
  // Group by category within severity
  const byCat = new Map<string, Finding[]>();
  for (const f of bySeverity[sev]) {
    const arr = byCat.get(f.category) ?? [];
    arr.push(f);
    byCat.set(f.category, arr);
  }
  for (const [cat, items] of [...byCat.entries()].sort()) {
    lines.push(`### ${cat} (${items.length})`);
    lines.push('');
    for (const f of items) {
      const loc = f.file ? `${f.file}:${f.line}` : '—';
      lines.push(`- **${f.id}** \`${loc}\` — ${f.problem} _Fix:_ ${f.fix}`);
    }
    lines.push('');
  }
}

// ---------------------------------------------------------------------------
// Appendix B: triaged false positives (manual review notes from
// data/false-positives.json). These are flagged by the detector but
// reviewed and confirmed as intentional patterns — kept here so reviewers
// don't re-trip on the same items.
// ---------------------------------------------------------------------------

if (triagedFindings.length > 0) {
  lines.push('## Appendix B — Triaged false positives');
  lines.push('');
  lines.push(
    'Findings the detector raised that were manually reviewed and confirmed intentional. Annotations live in `data/false-positives.json` and survive pipeline regeneration.',
  );
  lines.push('');
  const byPattern = new Map<string, Finding[]>();
  for (const f of triagedFindings) {
    const key = f.triage?.pattern ?? 'unclassified';
    const arr = byPattern.get(key) ?? [];
    arr.push(f);
    byPattern.set(key, arr);
  }
  for (const [pattern, items] of [...byPattern.entries()].sort()) {
    lines.push(`### ${pattern} (${items.length})`);
    lines.push('');
    for (const f of items) {
      const loc = f.file ? `${f.file}:${f.line}` : '—';
      lines.push(
        `- **${f.id}** \`${loc}\` — ${f.procedure} (${f.category}). _Why benign:_ ${f.triage?.reason}`,
      );
    }
    lines.push('');
  }
}

writeFileSync(resolve(DATA, '..', 'AUDIT.md'), lines.join('\n'), 'utf8');

console.log(
  `\n✓ active findings: HIGH=${bySeverity.HIGH.length}  MED=${bySeverity.MED.length}  LOW=${bySeverity.LOW.length}  total=${activeFindings.length}`,
);
console.log(`  triaged as false positive: ${triagedFindings.length}`);
console.log('  wrote data/findings.json + AUDIT.md');
