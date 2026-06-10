// Body-redaction logger guard.
//
// AST scan via ts-morph: walks every CallExpression of shape
// `<expr>.<level>({ body: ... }, ...)` and reports an offence unless the
// enclosing procedure prefix is on the includePrefixes allow-list or the
// site is grandfathered into the baseline.

import type { CallExpression, ObjectLiteralExpression } from 'ts-morph';
import { Project, SyntaxKind } from 'ts-morph';

export interface LogsGuardOptions {
  files: readonly string[];
  includePrefixes: readonly string[];
  /** Sites whose `file:line` are present here are ignored (baseline diff mode). */
  baseline?: readonly { file: string; line: number }[];
}

export interface LogsGuardOffence {
  kind: 'unredacted-body-log';
  file: string;
  line: number;
  procedure: string; // best-effort; 'unknown' when not derivable
  snippet: string;
  remediation: string;
}

const REMEDIATION_ANCHOR = 'docs/lint-remediation/lint-logs.md#unredacted-body-log';
const LOGGER_METHOD_NAMES = new Set(['info', 'warn', 'error', 'debug', 'trace', 'fatal']);

export async function runLogsGuard(opts: LogsGuardOptions): Promise<LogsGuardOffence[]> {
  const project = new Project({
    skipAddingFilesFromTsConfig: true,
    useInMemoryFileSystem: false,
    compilerOptions: { allowJs: true },
  });
  for (const f of opts.files) {
    try {
      project.addSourceFileAtPath(f);
    } catch {
      // ignore unreadable files
    }
  }

  const baselineKey = (file: string, line: number) => `${file}:${line}`;
  const baseline = new Set((opts.baseline ?? []).map(b => baselineKey(b.file, b.line)));

  const offences: LogsGuardOffence[] = [];

  for (const sf of project.getSourceFiles()) {
    sf.forEachDescendant(node => {
      if (node.getKind() !== SyntaxKind.CallExpression) return;
      const call = node as CallExpression;
      const expr = call.getExpression();
      if (expr.getKind() !== SyntaxKind.PropertyAccessExpression) return;
      const propAccess = expr.asKind(SyntaxKind.PropertyAccessExpression);
      if (!propAccess) return;
      const methodName = propAccess.getName();
      if (!LOGGER_METHOD_NAMES.has(methodName)) return;

      // First arg should be an object literal with a `body` key.
      const args = call.getArguments();
      const firstArg = args[0];
      if (!firstArg || firstArg.getKind() !== SyntaxKind.ObjectLiteralExpression) {
        return;
      }
      const obj = firstArg as ObjectLiteralExpression;
      const bodyProp = obj.getProperty('body');
      if (!bodyProp) return;

      const procedure = inferProcedureFromContext(call) ?? 'unknown';

      // Approved opt-in: matching procedure prefix in the allow-list.
      if (
        procedure !== 'unknown' &&
        opts.includePrefixes.some(p => {
          if (p.includes('*')) return false; // wildcards forbidden
          const [prefix] = p.split(':') as [string, string | undefined];
          return procedure.startsWith(prefix);
        })
      ) {
        return;
      }

      const file = sf.getFilePath();
      const line = call.getStartLineNumber();
      if (baseline.has(baselineKey(file, line))) return;

      const snippet = call.getText().slice(0, 120).replace(/\s+/g, ' ');

      offences.push({
        kind: 'unredacted-body-log',
        file,
        line,
        procedure,
        snippet,
        remediation: REMEDIATION_ANCHOR,
      });
    });
  }

  return offences.sort((a, b) => a.file.localeCompare(b.file) || a.line - b.line);
}

function inferProcedureFromContext(call: CallExpression): string | null {
  // Look in the source file for a const declaration like:
  //   const log = createTrpcLogger({ procedure: 'contractor.create', ... });
  // and return the procedure literal.
  const sf = call.getSourceFile();
  let proc: string | null = null;
  sf.forEachDescendant(n => {
    if (proc) return;
    if (n.getKind() !== SyntaxKind.CallExpression) return;
    const c = n as CallExpression;
    const e = c.getExpression();
    if (!e.getText().includes('createTrpcLogger')) return;
    const arg = c.getArguments()[0];
    if (!arg || arg.getKind() !== SyntaxKind.ObjectLiteralExpression) return;
    const propEntry = (arg as ObjectLiteralExpression).getProperty('procedure');
    if (!propEntry) return;
    const initializer = propEntry.asKind(SyntaxKind.PropertyAssignment)?.getInitializer();
    const text = initializer?.getText() ?? '';
    proc = text.replace(/^['"`]|['"`]$/g, '');
  });
  return proc;
}
