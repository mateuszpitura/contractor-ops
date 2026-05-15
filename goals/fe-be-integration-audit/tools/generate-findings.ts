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
import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const DATA = resolve(__dirname, '../data');
const procedures = JSON.parse(
  readFileSync(resolve(DATA, 'procedures.json'), 'utf8'),
) as Procedure[];
const callers = JSON.parse(readFileSync(resolve(DATA, 'fe-callers.json'), 'utf8')) as Caller[];

type Procedure = {
  surface: string;
  path: string;
  type: 'query' | 'mutation' | 'subscription';
  middleware: string;
  destructive: boolean;
  file: string;
  line: number;
};
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
  };
  fileHasAlertDialog: boolean;
};
type Severity = 'HIGH' | 'MED' | 'LOW';
type Finding = {
  id: string;
  severity: Severity;
  category: string;
  procedure?: string;
  file?: string;
  line?: number;
  problem: string;
  fix: string;
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

// Only inspect mutationOptions call sites (queries don't need toasts/confirm)
for (const c of callers) {
  if (c.kind !== 'mutationOptions') continue;
  const proc = procedures.find(p => p.path === c.path);
  const destructive = proc?.destructive ?? false;

  // HIGH: destructive without AlertDialog in same file
  if (destructive && !c.fileHasAlertDialog) {
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
  } else if (!c.handlers.hasToastError) {
    // MED: onError present but no toast
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
    if (!c.handlers.hasInvalidation) {
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
  } else {
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

  // LOW: no isPending reference (no loading/disabled wiring)
  if (!c.handlers.hasIsPending) {
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
for (const f of findings) bySeverity[f.severity].push(f);

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
  const high = findings.filter(
    f => f.severity === 'HIGH' && (f.procedure ? byDomain(f.procedure) === d : false),
  ).length;
  const med = findings.filter(
    f => f.severity === 'MED' && (f.procedure ? byDomain(f.procedure) === d : false),
  ).length;
  const low = findings.filter(
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
  `- Total findings: **${findings.length}** (HIGH ${bySeverity.HIGH.length} / MED ${bySeverity.MED.length} / LOW ${bySeverity.LOW.length})`,
);
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

writeFileSync(resolve(DATA, '..', 'AUDIT.md'), lines.join('\n'), 'utf8');

console.log(
  `\n✓ findings: HIGH=${bySeverity.HIGH.length}  MED=${bySeverity.MED.length}  LOW=${bySeverity.LOW.length}  total=${findings.length}`,
);
console.log('  wrote data/findings.json + AUDIT.md');
