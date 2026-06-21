// lint:scopes guard.
//
// Asserts that every write-capable scope string in an IdP adapter's
// getOAuthConfig().scopes array is traceable to a typed-const declared in
// `packages/integrations/src/scopes/*.ts` (the global allow-set) OR to a
// `const ... = [...] as const` array literal in the same adapter file.
//
// Adding a write-capable scope literal directly without putting it in a typed-const
// fails CI. Read-only scopes (`*.readonly`) are exempt.

import type { ArrayLiteralExpression, StringLiteral, VariableDeclaration } from 'ts-morph';
import { Project, SyntaxKind } from 'ts-morph';

export interface ScopesGuardOptions {
  /** Adapter source files to scan (absolute paths). */
  adapterFiles: readonly string[];
  /** Typed-const scope files that form the global allow-set (absolute paths). */
  scopeFiles: readonly string[];
}

export interface ScopesGuardOffence {
  kind: 'untyped-scope';
  adapter: string;
  scope: string;
  remediation: string;
}

const REMEDIATION_ANCHOR = 'docs/lint-remediation/lint-scopes.md#untyped-scope';

// A scope literal matching any of these requires a typed-const trace.
// Read-only scopes (`*.readonly`) never match — they are exempt.
const WRITE_SCOPE_PATTERNS = [
  /admin\.directory\.user(?!\.readonly)/,
  /admin\.directory\.group(?!\.readonly)/,
  /\.write/,
  /admin:org/,
  /admin\.users\.session/,
  /scim:write/,
  /User\.EnableDisableAccount\.All/,
  /User\.RevokeSessions\.All/,
];

// Recognises OAuth-scope-shaped string literals (URL, `admin:*`, MS-Graph `User.*`).
const SCOPE_LITERAL_SHAPE = /^(https:\/\/.+|admin:|User\.|scim:)/;

function basename(filePath: string): string {
  const parts = filePath.split(/[/\\]/);
  return parts[parts.length - 1] ?? filePath;
}

/**
 * String values of a `const x = [...]` or `const x = [...] as const` array
 * literal initializer. Empty for any other declaration shape.
 */
function constArrayStringValues(decl: VariableDeclaration): string[] {
  const init = decl.getInitializer();
  if (!init) return [];
  // Unwrap `[...] as const` (AsExpression) down to the ArrayLiteralExpression.
  const arr =
    init.asKind(SyntaxKind.ArrayLiteralExpression) ??
    init.asKind(SyntaxKind.AsExpression)?.getExpression().asKind(SyntaxKind.ArrayLiteralExpression);
  if (!arr) return [];

  const values: string[] = [];
  for (const el of (arr as ArrayLiteralExpression).getElements()) {
    const lit = el.asKind(SyntaxKind.StringLiteral);
    if (lit) values.push((lit as StringLiteral).getLiteralValue());
  }
  return values;
}

function collectConstArrayStringLiterals(filePathsProject: Project, into: Set<string>): void {
  for (const sf of filePathsProject.getSourceFiles()) {
    for (const decl of sf.getVariableDeclarations()) {
      for (const value of constArrayStringValues(decl)) {
        into.add(value);
      }
    }
  }
}

export function runScopesGuard(opts: ScopesGuardOptions): ScopesGuardOffence[] {
  // Global allow-set: every string literal in any const array across scopes/*.ts.
  const scopeProject = new Project({ skipAddingFilesFromTsConfig: true });
  for (const f of opts.scopeFiles) {
    try {
      scopeProject.addSourceFileAtPath(f);
    } catch {
      // ignore unreadable files
    }
  }
  const globalAllowSet = new Set<string>();
  collectConstArrayStringLiterals(scopeProject, globalAllowSet);

  const offences: ScopesGuardOffence[] = [];

  for (const adapterPath of opts.adapterFiles) {
    const adapterProject = new Project({ skipAddingFilesFromTsConfig: true });
    let sf: ReturnType<Project['addSourceFileAtPath']>;
    try {
      sf = adapterProject.addSourceFileAtPath(adapterPath);
    } catch {
      continue;
    }

    // File-local allow-set: global consts + any same-file `const [...] as const` literals.
    const localAllowSet = new Set<string>(globalAllowSet);
    collectConstArrayStringLiterals(adapterProject, localAllowSet);

    // Every OAuth-scope-shaped string literal in the file.
    const seen = new Set<string>();
    sf.forEachDescendant(node => {
      const lit = node.asKind(SyntaxKind.StringLiteral);
      if (!lit) return;
      const value = lit.getLiteralValue();
      if (!SCOPE_LITERAL_SHAPE.test(value)) return;
      if (!WRITE_SCOPE_PATTERNS.some(re => re.test(value))) return; // read-only / non-write exempt
      if (localAllowSet.has(value)) return; // traced to a typed-const
      if (seen.has(value)) return;
      seen.add(value);
      offences.push({
        kind: 'untyped-scope',
        adapter: basename(adapterPath),
        scope: value,
        remediation: `Move "${value}" into a typed-const in packages/integrations/src/scopes/<provider>-deprovision-scopes.ts and import-spread it into getOAuthConfig().scopes. See ${REMEDIATION_ANCHOR}.`,
      });
    });
  }

  return offences;
}
