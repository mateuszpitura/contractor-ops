/**
 * REPORT.md, per-route sheets, SUMMARY.md, findings.json
 */

import { mkdir, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import type { Manifest } from './manifest.js';

export type Severity = 'blocker' | 'high' | 'medium' | 'low';

export interface Finding {
  severity: Severity;
  cluster: string;
  routeId: string;
  locale: string;
  theme: string;
  viewport: string;
  message: string;
  detail?: string;
  variant?: string;
}

export interface RouteResult {
  routeId: string;
  app: 'web' | 'landing' | 'cms';
  pathTemplate: string;
  combinations: number;
  findings: Finding[];
  shotIndexes: number[];
}

export interface ReportData {
  outDir: string;
  runId: string;
  flags: Record<string, unknown>;
  matrixSize: number;
  routes: RouteResult[];
  manifest: Manifest;
  startedAt: string;
  finishedAt: string;
}

export async function writeReports(data: ReportData): Promise<number> {
  const reportsDir = resolve(data.outDir, 'routes');
  await mkdir(reportsDir, { recursive: true });

  const manifestPath = resolve(data.outDir, 'manifest.json');
  await writeFile(manifestPath, JSON.stringify(data.manifest, null, 2), 'utf8');

  const jsonPath = resolve(data.outDir, 'findings.json');
  await writeFile(
    jsonPath,
    JSON.stringify(
      {
        manifest: 'manifest.json',
        runId: data.runId,
        flags: data.flags,
        routes: data.routes.map(r => ({
          routeId: r.routeId,
          findings: r.findings,
          shotIndexes: r.shotIndexes,
        })),
        galleryAudit: data.manifest.galleryAudit,
        coverage: data.manifest.coverage,
        startedAt: data.startedAt,
        finishedAt: data.finishedAt,
      },
      null,
      2,
    ),
    'utf8',
  );

  for (const result of data.routes) {
    const shots = data.manifest.shots.filter(s => s.routeId === result.routeId);
    const sheetPath = resolve(reportsDir, `${result.routeId}.md`);
    const lines = [
      `# ${result.routeId}`,
      ``,
      `**App:** ${result.app}`,
      `**Path:** \`${result.pathTemplate}\``,
      `**Combinations walked:** ${result.combinations}`,
      `**Findings:** ${result.findings.length}`,
      ``,
      `## Screenshots (manifest)`,
      ``,
      ...shots.map(s => `- \`${s.file}\` — ${s.status} variant=${s.variant} index=${s.index}`),
      ``,
      `## Findings`,
      ``,
    ];
    if (result.findings.length === 0) {
      lines.push('_None._');
    } else {
      lines.push('| severity | cluster | locale | theme | viewport | message |');
      lines.push('| --- | --- | --- | --- | --- | --- |');
      for (const f of result.findings) {
        lines.push(
          `| ${f.severity} | ${f.cluster} | ${f.locale} | ${f.theme} | ${f.viewport} | ${f.message.replace(/\|/g, '\\|')} |`,
        );
      }
    }
    await writeFile(sheetPath, lines.join('\n'), 'utf8');
  }

  await writeSummary(data);
  const totalFindings = data.routes.reduce((acc, r) => acc + r.findings.length, 0);
  await writeReportMd(data, totalFindings);
  return totalFindings;
}

async function writeSummary(data: ReportData): Promise<void> {
  const lines = [
    `# QA walk SUMMARY — ${data.runId}`,
    ``,
    `| # | route | viewport | theme | variant | status | file |`,
    `| --- | --- | --- | --- | --- | --- | --- |`,
  ];
  const sorted = [...data.manifest.shots].sort(
    (a, b) =>
      a.locale.localeCompare(b.locale) || a.index - b.index || a.variant.localeCompare(b.variant),
  );
  for (const s of sorted) {
    lines.push(
      `| ${String(s.index).padStart(3, '0')} | ${s.routeId} | ${s.viewport} | ${s.theme} | ${s.variant} | ${s.status} | \`${s.file}\` |`,
    );
  }
  lines.push('');
  lines.push(
    `**Coverage:** ${data.manifest.coverage.captured}/${data.manifest.coverage.expected} success surfaces`,
  );
  await writeFile(resolve(data.outDir, 'SUMMARY.md'), lines.join('\n'), 'utf8');
}

async function writeReportMd(data: ReportData, totalFindings: number): Promise<void> {
  const byCluster = new Map<string, number>();
  const bySeverity = new Map<Severity, number>();
  for (const r of data.routes) {
    for (const f of r.findings) {
      byCluster.set(f.cluster, (byCluster.get(f.cluster) ?? 0) + 1);
      bySeverity.set(f.severity, (bySeverity.get(f.severity) ?? 0) + 1);
    }
  }
  const ga = data.manifest.galleryAudit;
  const cov = data.manifest.coverage;
  const pct = cov.expected > 0 ? ((cov.captured / cov.expected) * 100).toFixed(1) : '100.0';

  const reportLines = [
    `# QA walk-and-fix — ${data.runId}`,
    ``,
    `- **Started:** ${data.startedAt}`,
    `- **Finished:** ${data.finishedAt}`,
    `- **Routes walked:** ${data.routes.length}`,
    `- **Combinations:** ${data.matrixSize}`,
    `- **Findings:** ${totalFindings}`,
    `- **Capture coverage:** ${pct}% (${cov.captured}/${cov.expected})`,
    ``,
    `## Gallery audit`,
    ``,
    `| metric | count |`,
    `| --- | --- |`,
    `| success screenshots | ${ga.successScreenshots} |`,
    `| broken | ${ga.brokenScreenshots} |`,
    `| loading | ${ga.loadingScreenshots} |`,
    `| capture-missing | ${ga.captureMissing} |`,
    `| suspected seed mismatch | ${ga.suspectedSeedMismatch ? 'yes' : 'no'} |`,
    ``,
  ];
  if (ga.suspectedSeedMismatch) {
    reportLines.push(
      `> **Blocker hint:** >15% routes show not-found / entity patterns — check \`QA_DEFAULT_ORG_ID\` and \`resolveQaParams\`.`,
      ``,
    );
  }
  reportLines.push(
    `## By severity`,
    ``,
    `| severity | count |`,
    `| --- | --- |`,
    ...(['blocker', 'high', 'medium', 'low'] as Severity[]).map(
      s => `| ${s} | ${bySeverity.get(s) ?? 0} |`,
    ),
    ``,
    `## By cluster`,
    ``,
    `| cluster | count |`,
    `| --- | --- |`,
    ...[...byCluster.entries()].sort((a, b) => b[1] - a[1]).map(([c, n]) => `| ${c} | ${n} |`),
    ``,
    `## Per-route sheets`,
    ``,
    ...data.routes.map(
      r => `- [${r.routeId}](./routes/${r.routeId}.md) — ${r.findings.length} findings`,
    ),
    ``,
    `## SUMMARY`,
    ``,
    `See [SUMMARY.md](./SUMMARY.md) for the full screenshot gallery index.`,
    ``,
  );
  const reportPath = resolve(data.outDir, 'REPORT.md');
  await writeFile(reportPath, reportLines.join('\n'), 'utf8');
  process.stdout.write(`\nReport written to ${reportPath}\n`);
  process.stdout.write(`Findings: ${totalFindings}\n`);
  process.stdout.write(`Coverage: ${cov.captured}/${cov.expected} (${pct}%)\n`);
}
