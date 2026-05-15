#!/usr/bin/env tsx
/**
 * Extract every tRPC procedure from packages/api into procedures.json.
 *
 * Output entry shape:
 * {
 *   surface: 'appRouter' | 'portalAppRouter' | 'publicApiRouter',
 *   path: 'equipment.equipment.assign',
 *   type: 'query' | 'mutation' | 'subscription',
 *   middleware: 'tenantProcedure' | 'protectedProcedure' | ...,
 *   destructive: boolean,
 *   file: 'packages/api/src/routers/equipment/equipment.ts',
 *   line: 123,
 * }
 *
 * Walks the AST using the TypeScript compiler API. Resolves
 * router({}) and mergeRouters() calls by following imported
 * identifiers to their declarations within packages/api/src.
 */
import { mkdirSync, readdirSync, writeFileSync } from 'node:fs';
import { dirname, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import ts from 'typescript';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, '../../..');
const API_SRC = resolve(ROOT, 'packages/api/src');
const OUT = resolve(__dirname, '../data/procedures.json');

const DESTRUCTIVE_VERBS = [
  'delete',
  'remove',
  'archive',
  'revoke',
  'cancel',
  'disconnect',
  'unassign',
  'destroy',
  'purge',
  'wipe',
  'discard',
  'detach',
  'unlink',
  'reject',
  'deactivate',
];

type Procedure = {
  surface: string;
  path: string;
  type: 'query' | 'mutation' | 'subscription';
  middleware: string;
  destructive: boolean;
  file: string;
  line: number;
};

const procedures: Procedure[] = [];

// ---------------------------------------------------------------------------
// Program setup: include every .ts/.tsx in packages/api/src
// ---------------------------------------------------------------------------

const program = ts.createProgram({
  rootNames: collectFiles(API_SRC),
  options: {
    allowJs: false,
    target: ts.ScriptTarget.ESNext,
    module: ts.ModuleKind.ESNext,
    moduleResolution: ts.ModuleResolutionKind.Bundler,
    strict: false,
    noEmit: true,
    skipLibCheck: true,
    esModuleInterop: true,
    jsx: ts.JsxEmit.Preserve,
  },
});
const checker = program.getTypeChecker();

function collectFiles(dir: string): string[] {
  const out: string[] = [];
  const walk = (d: string) => {
    for (const entry of readdirSync(d, { withFileTypes: true })) {
      const full = join(d, entry.name);
      if (entry.isDirectory()) {
        if (entry.name === '__tests__' || entry.name === 'node_modules') continue;
        walk(full);
      } else if (
        (entry.name.endsWith('.ts') || entry.name.endsWith('.tsx')) &&
        !entry.name.endsWith('.d.ts')
      ) {
        out.push(full);
      }
    }
  };
  walk(dir);
  return out;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function lineOf(node: ts.Node): number {
  const sf = node.getSourceFile();
  return sf.getLineAndCharacterOfPosition(node.getStart()).line + 1;
}

function classifyVerb(name: string): boolean {
  const lower = name.toLowerCase();
  return DESTRUCTIVE_VERBS.some(v => lower === v || lower.startsWith(v));
}

/** Returns the variable initializer declaration for an Identifier, following imports. */
function resolveIdentifier(id: ts.Identifier): ts.Expression | null {
  const symbol = checker.getSymbolAtLocation(id);
  if (!symbol) return null;
  const decls = symbol.getDeclarations() ?? [];
  for (const d of decls) {
    if (ts.isVariableDeclaration(d) && d.initializer) {
      return d.initializer;
    }
    // Import or export specifier — follow alias
    if (ts.isImportSpecifier(d) || ts.isExportSpecifier(d) || ts.isImportClause(d)) {
      const aliased = checker.getAliasedSymbol(symbol);
      const target = aliased.getDeclarations() ?? [];
      for (const td of target) {
        if (ts.isVariableDeclaration(td) && td.initializer) return td.initializer;
      }
    }
  }
  // Fall through: try alias directly
  try {
    const aliased = checker.getAliasedSymbol(symbol);
    const target = aliased.getDeclarations() ?? [];
    for (const td of target) {
      if (ts.isVariableDeclaration(td) && td.initializer) return td.initializer;
    }
  } catch {
    // not aliased
  }
  return null;
}

/** Find the middleware identifier ("tenantProcedure", "protectedProcedure", etc.) at the head of a procedure expression chain. */
function extractMiddleware(expr: ts.Expression): string {
  let current: ts.Expression = expr;
  while (ts.isCallExpression(current) || ts.isPropertyAccessExpression(current)) {
    if (ts.isCallExpression(current)) {
      current = current.expression;
    } else {
      current = current.expression;
    }
  }
  if (ts.isIdentifier(current)) return current.text;
  return 'unknown';
}

/** Walk a property assignment value to see if it is a procedure (ends in .query/.mutation/.subscription). */
function detectProcedureCall(
  value: ts.Expression,
): { type: 'query' | 'mutation' | 'subscription'; middleware: string; node: ts.Node } | null {
  // Walk the top-level call: builder.method.method.<query|mutation|subscription>(input)
  let node: ts.Expression = value;
  while (ts.isCallExpression(node) || ts.isPropertyAccessExpression(node)) {
    if (ts.isCallExpression(node)) {
      const callee = node.expression;
      if (ts.isPropertyAccessExpression(callee) && ts.isIdentifier(callee.name)) {
        const methodName = callee.name.text;
        if (methodName === 'query' || methodName === 'mutation' || methodName === 'subscription') {
          return {
            type: methodName as 'query' | 'mutation' | 'subscription',
            middleware: extractMiddleware(callee.expression),
            node,
          };
        }
      }
      node = callee;
    } else {
      node = node.expression;
    }
  }
  return null;
}

/** Walk a router({...}) ObjectLiteral and emit procedures + recurse into sub-routers. */
function walkRouterObject(
  obj: ts.ObjectLiteralExpression,
  prefix: string[],
  surface: string,
  seen: Set<string>,
): void {
  for (const prop of obj.properties) {
    if (!(ts.isPropertyAssignment(prop) || ts.isShorthandPropertyAssignment(prop))) continue;
    const keyNode = prop.name;
    if (!(keyNode && ts.isIdentifier(keyNode))) continue;
    const key = keyNode.text;
    const value: ts.Expression = ts.isPropertyAssignment(prop) ? prop.initializer : keyNode; // shorthand: value === key identifier

    // Case A: procedure (e.g. `list: tenantProcedure.use(...).input(...).query(async ...)`)
    const proc = detectProcedureCall(value);
    if (proc) {
      const sf = proc.node.getSourceFile();
      procedures.push({
        surface,
        path: [...prefix, key].join('.'),
        type: proc.type,
        middleware: proc.middleware,
        destructive: classifyVerb(key),
        file: relative(ROOT, sf.fileName),
        line: lineOf(proc.node),
      });
      continue;
    }

    // Case B: nested router (identifier referring to another router or inline router({...}))
    walkRouterValue(value, [...prefix, key], surface, seen);
  }
}

/** Walk any expression that should resolve to a router (router({...}), mergeRouters(...), Identifier→declaration). */
function walkRouterValue(
  expr: ts.Expression,
  prefix: string[],
  surface: string,
  seen: Set<string>,
): void {
  // Inline router({...})
  if (
    ts.isCallExpression(expr) &&
    ts.isIdentifier(expr.expression) &&
    expr.expression.text === 'router' &&
    expr.arguments.length > 0 &&
    ts.isObjectLiteralExpression(expr.arguments[0])
  ) {
    walkRouterObject(expr.arguments[0], prefix, surface, seen);
    return;
  }
  // mergeRouters(a, b, c) — walk each
  if (
    ts.isCallExpression(expr) &&
    ts.isIdentifier(expr.expression) &&
    expr.expression.text === 'mergeRouters'
  ) {
    for (const arg of expr.arguments) {
      walkRouterValue(arg, prefix, surface, seen);
    }
    return;
  }
  // Identifier → resolve to declaration
  if (ts.isIdentifier(expr)) {
    const key = `${expr.getSourceFile().fileName}:${expr.text}`;
    if (seen.has(key)) return;
    seen.add(key);
    const resolved = resolveIdentifier(expr);
    if (resolved) {
      walkRouterValue(resolved, prefix, surface, seen);
    } else {
      console.warn(`  cannot resolve identifier ${expr.text} at ${prefix.join('.')}`);
    }
    return;
  }
  // ConditionalExpression: a ? b : c (e.g. classification kill-switch)
  if (ts.isConditionalExpression(expr)) {
    walkRouterValue(expr.whenTrue, prefix, surface, seen);
    walkRouterValue(expr.whenFalse, prefix, surface, seen);
    return;
  }
  // ObjectLiteralExpression (already a router({}) inner shape)
  if (ts.isObjectLiteralExpression(expr)) {
    walkRouterObject(expr, prefix, surface, seen);
    return;
  }
  // ParenthesizedExpression
  if (ts.isParenthesizedExpression(expr)) {
    walkRouterValue(expr.expression, prefix, surface, seen);
    return;
  }
  // Spread in object (...someRouterObj)
  if (ts.isSpreadElement(expr) || ts.isSpreadAssignment(expr)) {
    const inner = (expr as ts.SpreadElement | ts.SpreadAssignment).expression;
    walkRouterValue(inner, prefix, surface, seen);
    return;
  }
  // satisfies / as type assertions
  if (ts.isAsExpression(expr) || ts.isSatisfiesExpression(expr)) {
    walkRouterValue(expr.expression, prefix, surface, seen);
    return;
  }
  console.warn(
    `  unrecognized router expression kind=${ts.SyntaxKind[expr.kind]} at ${prefix.join('.')}`,
  );
}

// ---------------------------------------------------------------------------
// Entry points: find the appRouter, portalAppRouter, publicApiRouter declarations
// ---------------------------------------------------------------------------

function findExportedRouter(sourceFilePath: string, exportName: string): ts.Expression | null {
  const sf = program.getSourceFile(sourceFilePath);
  if (!sf) return null;
  let result: ts.Expression | null = null;
  ts.forEachChild(sf, node => {
    if (ts.isVariableStatement(node)) {
      const isExport = node.modifiers?.some(m => m.kind === ts.SyntaxKind.ExportKeyword);
      if (!isExport) return;
      for (const decl of node.declarationList.declarations) {
        if (ts.isIdentifier(decl.name) && decl.name.text === exportName && decl.initializer) {
          result = decl.initializer;
        }
      }
    }
  });
  return result;
}

const entryPoints: Array<{ surface: string; file: string; exportName: string }> = [
  { surface: 'appRouter', file: resolve(API_SRC, 'root.ts'), exportName: 'appRouter' },
  {
    surface: 'portalAppRouter',
    file: resolve(API_SRC, 'portal-root.ts'),
    exportName: 'portalAppRouter',
  },
  {
    surface: 'publicApiRouter',
    file: resolve(API_SRC, 'routers/public-api/index.ts'),
    exportName: 'publicApiRouter',
  },
];

for (const ep of entryPoints) {
  console.log(`\n[surface] ${ep.surface}  (${relative(ROOT, ep.file)})`);
  const expr = findExportedRouter(ep.file, ep.exportName);
  if (!expr) {
    console.warn(`  could not find export ${ep.exportName} in ${ep.file}`);
    continue;
  }
  walkRouterValue(expr, [], ep.surface, new Set());
}

// ---------------------------------------------------------------------------
// Write
// ---------------------------------------------------------------------------

mkdirSync(dirname(OUT), { recursive: true });
writeFileSync(OUT, JSON.stringify(procedures, null, 2), 'utf8');

const byType = procedures.reduce<Record<string, number>>((acc, p) => {
  acc[p.type] = (acc[p.type] ?? 0) + 1;
  return acc;
}, {});
const bySurface = procedures.reduce<Record<string, number>>((acc, p) => {
  acc[p.surface] = (acc[p.surface] ?? 0) + 1;
  return acc;
}, {});
const destructiveCount = procedures.filter(p => p.destructive).length;

console.log(`\n✓ wrote ${procedures.length} procedures to ${relative(ROOT, OUT)}`);
console.log(`  by type:    ${JSON.stringify(byType)}`);
console.log(`  by surface: ${JSON.stringify(bySurface)}`);
console.log(`  destructive: ${destructiveCount}`);
