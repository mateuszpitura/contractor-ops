#!/usr/bin/env tsx
/**
 * Triage orphan findings: search non-FE callers (cron, jobs, scripts, services,
 * public-api REST routes) for references to each orphan procedure name.
 * Tags findings as "intentional non-UI" with caller location, or leaves them
 * as true orphans.
 *
 * Updates findings.json in place. Updates AUDIT.md to reflect new categories
 * and adds the "Intentional non-UI" appendix.
 */
import { execSync } from 'node:child_process';
import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, '../../..');
const DATA = resolve(__dirname, '../data');

type Triage = {
  status: 'false-positive';
  pattern: string;
  reason: string;
};

type Finding = {
  id: string;
  severity: 'HIGH' | 'MED' | 'LOW';
  category: string;
  procedure?: string;
  file?: string;
  line?: number;
  problem: string;
  fix: string;
  intentionalCallers?: string[];
  triage?: Triage;
};

type ProcedureRecord = {
  surface: string;
  path: string;
  type: string;
  middleware: string;
  destructive: boolean;
  file: string;
  line: number;
};

const findings: Finding[] = JSON.parse(readFileSync(resolve(DATA, 'findings.json'), 'utf8'));

const allProcedures: ProcedureRecord[] = JSON.parse(
  readFileSync(resolve(DATA, 'procedures.json'), 'utf8'),
);
const procByPath = new Map<string, ProcedureRecord[]>();
for (const p of allProcedures) {
  const arr = procByPath.get(p.path) ?? [];
  arr.push(p);
  procByPath.set(p.path, arr);
}

const NON_UI_MIDDLEWARES = new Set([
  'cronProcedure',
  'apiKeyAdminProcedure',
  'apiKeyTenantProcedure',
  'apiKeyTenantFlaggedProcedure',
]);

const orphans = findings.filter(
  f => f.category === 'orphan' || f.category === 'orphan-likely-intentional',
);
console.log(`triaging ${orphans.length} orphans...`);

// Search locations *outside* the FE app — anywhere the procedure could be called
// by a non-UI consumer.
const SEARCH_PATHS = [
  'apps/public-api/src',
  'packages/api/src/services',
  'packages/api/src/jobs',
  'scripts',
  'infra',
  'docker',
];

function searchProc(procedurePath: string): string[] {
  const procName = procedurePath.split('.').pop() ?? procedurePath;
  const fullCallerPattern = `caller.${procedurePath}`;
  const captures: string[] = [];

  for (const sp of SEARCH_PATHS) {
    const dir = resolve(ROOT, sp);
    try {
      // 1) Strong signal: literal `caller.<path>` call
      const out1 = execSync(
        `grep -rn --include='*.ts' --include='*.tsx' --include='*.mjs' --include='*.js' -F ${JSON.stringify(fullCallerPattern)} ${JSON.stringify(dir)} 2>/dev/null || true`,
        { encoding: 'utf8' },
      );
      for (const line of out1.split('\n').filter(Boolean)) {
        captures.push(line);
      }
      // 2) Weaker signal: bare procedure name (only as a hint, not proof)
      const out2 = execSync(
        `grep -rn --include='*.ts' --include='*.tsx' --include='*.mjs' --include='*.js' -wF ${JSON.stringify(procName)} ${JSON.stringify(dir)} 2>/dev/null || true`,
        { encoding: 'utf8' },
      );
      for (const line of out2.split('\n').filter(Boolean)) {
        // Skip lines that are clearly definitions or comments
        if (line.includes('//') && !line.includes('caller.')) continue;
        if (line.includes(`${procName}:`) && line.includes('procedure')) continue;
        if (captures.includes(line)) continue;
        captures.push(line);
      }
    } catch {
      // grep returns 1 on no match — ignore
    }
  }
  return captures;
}

let intentionalCount = 0;
for (const o of orphans) {
  if (!o.procedure) continue;

  // Signal #1: middleware indicates non-UI consumer (cron / public-api / admin REST).
  const procs = procByPath.get(o.procedure) ?? [];
  const nonUiMw = procs.find(p => NON_UI_MIDDLEWARES.has(p.middleware));
  if (nonUiMw) {
    o.category = 'orphan-intentional-non-ui';
    o.intentionalCallers = [
      `(middleware=${nonUiMw.middleware} on ${nonUiMw.file}:${nonUiMw.line})`,
    ];
    o.severity = 'LOW';
    intentionalCount++;
    continue;
  }

  // Signal #2: literal caller.<path> reference in non-FE source.
  const callers = searchProc(o.procedure);
  const strongCallerLine = callers.find(line => line.includes(`caller.${o.procedure}`));
  if (strongCallerLine) {
    o.category = 'orphan-intentional-non-ui';
    o.intentionalCallers = callers.slice(0, 5);
    o.severity = 'LOW';
    intentionalCount++;
    continue;
  }

  // Weaker signals: attach as hint, do not auto-reclassify.
  if (callers.length > 0) {
    o.intentionalCallers = callers.slice(0, 5);
  }
}

writeFileSync(resolve(DATA, 'findings.json'), JSON.stringify(findings, null, 2), 'utf8');
console.log(`tagged ${intentionalCount} orphans as intentional non-UI`);

// ---------------------------------------------------------------------------
// Regenerate AUDIT.md from updated findings
// ---------------------------------------------------------------------------

type Severity = 'HIGH' | 'MED' | 'LOW';
// Triaged findings (false positives from data/false-positives.json) are
// rendered in their own Appendix B and excluded from severity buckets so
// counts reflect the active triage backlog.
const activeFindings = findings.filter(f => !f.triage);
const triagedFindings = findings.filter(f => f.triage);
const bySeverity: Record<Severity, Finding[]> = { HIGH: [], MED: [], LOW: [] };
for (const f of activeFindings) bySeverity[f.severity].push(f);

const procedures = JSON.parse(readFileSync(resolve(DATA, 'procedures.json'), 'utf8')) as Array<{
  surface: string;
  path: string;
}>;
const callerCount = (
  JSON.parse(readFileSync(resolve(DATA, 'fe-callers.json'), 'utf8')) as Array<{ kind: string }>
).filter(c => c.kind === 'mutationOptions').length;

const byDomain = (path: string): string => {
  const head = path.split('.')[0];
  const DOMAIN_MAP: Record<string, string> = {
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
    bacs: 'finance',
    billing: 'finance',
    exchangeRate: 'finance',
    invoiceIntake: 'finance',
    invoice: 'finance',
    latePaymentInterest: 'finance',
    payment: 'finance',
    skonto: 'finance',
    equipment: 'equipment',
    workflow: 'workflow',
    workflowRoles: 'workflow',
    googleWorkspace: 'integrations',
    jira: 'integrations',
    ksef: 'integrations',
    linear: 'integrations',
    peppol: 'integrations',
    teams: 'integrations',
    integration: 'integrations',
    portal: 'portal',
    portalTime: 'portal',
    portalDocMapper: 'portal',
  };
  return DOMAIN_MAP[head] ?? 'core';
};

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
  `- Procedures audited: **${procedures.length}** (appRouter + portalAppRouter + publicApiRouter)`,
);
lines.push(`- FE mutation call sites audited: **${callerCount}**`);
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
  const items = bySeverity[sev].filter(f => f.category !== 'orphan-intentional-non-ui');
  lines.push(`## ${sev} (${items.length})`);
  lines.push('');
  const byCat = new Map<string, Finding[]>();
  for (const f of items) {
    const arr = byCat.get(f.category) ?? [];
    arr.push(f);
    byCat.set(f.category, arr);
  }
  for (const [cat, group] of [...byCat.entries()].sort()) {
    lines.push(`### ${cat} (${group.length})`);
    lines.push('');
    for (const f of group) {
      const loc = f.file ? `${f.file}:${f.line}` : '—';
      lines.push(`- **${f.id}** \`${loc}\` — ${f.problem} _Fix:_ ${f.fix}`);
    }
    lines.push('');
  }
}

// Appendix A: intentional non-UI orphans (auto-tagged above)
const intentional = findings.filter(f => f.category === 'orphan-intentional-non-ui');
lines.push('## Appendix A — Intentional non-UI consumers');
lines.push('');
lines.push(
  `These procedures have no FE caller because they are invoked from non-UI consumers (public-api REST routes, background jobs, cron scripts, services). Count: **${intentional.length}**.`,
);
lines.push('');
for (const f of intentional) {
  lines.push(`- **${f.id}** \`${f.procedure}\` — caller(s):`);
  for (const c of f.intentionalCallers ?? []) {
    lines.push(`  - \`${c.replace(`${ROOT}/`, '')}\``);
  }
}
lines.push('');

// Appendix B: manually triaged false positives. Annotations live in
// data/false-positives.json — see generate-findings.ts for how they attach.
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
console.log('✓ AUDIT.md updated');
