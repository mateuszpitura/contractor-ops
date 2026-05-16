#!/usr/bin/env tsx
/**
 * Extract every tRPC call site from apps/web/src + apps/public-api/src
 * into fe-callers.json.
 *
 * Output entry shape (mutation):
 * {
 *   client: 'trpc' | 'portalTrpc',
 *   path: 'equipment.equipment.assign',
 *   kind: 'mutationOptions' | 'queryOptions' | 'useMutation' | 'useQuery' | ...,
 *   file: 'apps/web/src/components/...',
 *   line: 42,
 *   handlers: {
 *     hasOnSuccess: boolean,
 *     hasOnError: boolean,
 *     hasToastSuccess: boolean,
 *     hasToastError: boolean,
 *     hasInvalidation: boolean,
 *     hasIsPending: boolean,
 *   },
 *   fileHasAlertDialog: boolean,
 * }
 */
import { mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import ts from 'typescript';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, '../../..');
const WEB_SRC = resolve(ROOT, 'apps/web/src');
const PUBLIC_API_SRC = resolve(ROOT, 'apps/public-api/src');
const OUT = resolve(__dirname, '../data/fe-callers.json');

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

const callers: Caller[] = [];

const TRPC_CLIENT_NAMES = new Set(['trpc', 'portalTrpc', 'zatcaTrpc']);
const TERMINAL_METHODS = new Set([
  'queryOptions',
  'mutationOptions',
  'subscriptionOptions',
  'useQuery',
  'useMutation',
  'useSuspenseQuery',
  'useInfiniteQuery',
  'useSuspenseInfiniteQuery',
  'useSubscription',
  'infiniteQueryOptions',
  'queryKey',
  'query', // ssr direct call
  'mutate', // direct trpc client mutate
]);

function collectFiles(dir: string): string[] {
  const out: string[] = [];
  const walk = (d: string) => {
    let entries: import('node:fs').Dirent[];
    try {
      entries = readdirSync(d, { withFileTypes: true });
    } catch {
      return;
    }
    for (const entry of entries) {
      const full = join(d, entry.name);
      if (entry.isDirectory()) {
        if (
          entry.name === '__tests__' ||
          entry.name === 'node_modules' ||
          entry.name === '.next' ||
          entry.name === 'dist' ||
          entry.name === 'storybook-static'
        ) {
          continue;
        }
        walk(full);
      } else if (
        (entry.name.endsWith('.ts') || entry.name.endsWith('.tsx')) &&
        !entry.name.endsWith('.d.ts') &&
        !entry.name.endsWith('.test.ts') &&
        !entry.name.endsWith('.test.tsx') &&
        !entry.name.endsWith('.spec.ts') &&
        !entry.name.endsWith('.spec.tsx')
      ) {
        out.push(full);
      }
    }
  };
  walk(dir);
  return out;
}

// ---------------------------------------------------------------------------
// AST helpers
// ---------------------------------------------------------------------------

/**
 * Match a PropertyAccessExpression chain rooted at `trpc.` or `portalTrpc.`.
 * Returns { client, pathSegments, terminal } where terminal is the last method (queryOptions, etc.)
 * if it is a TERMINAL_METHOD. The pathSegments are everything between the client and the terminal.
 *
 * Example AST: `trpc.equipment.equipment.assign.mutationOptions`
 *   client = 'trpc'
 *   pathSegments = ['equipment','equipment','assign']
 *   terminal = 'mutationOptions'
 */
function matchTrpcChain(expr: ts.Node): { client: string; path: string; terminal: string } | null {
  if (!ts.isPropertyAccessExpression(expr)) return null;
  const segments: string[] = [];
  let node: ts.Expression = expr;
  while (ts.isPropertyAccessExpression(node)) {
    if (!ts.isIdentifier(node.name)) return null;
    segments.unshift(node.name.text);
    node = node.expression;
  }
  if (!ts.isIdentifier(node)) return null;
  if (!TRPC_CLIENT_NAMES.has(node.text)) return null;
  const client = node.text;
  // segments is e.g. ['equipment','equipment','assign','mutationOptions']
  if (segments.length < 2) return null;
  const terminal = segments[segments.length - 1];
  if (!TERMINAL_METHODS.has(terminal)) return null;
  let pathSegs = segments.slice(0, -1);
  // `zatcaTrpc` is an alias for `trpc.zatca` — prepend the router prefix so
  // procedure-path matching against `appRouter.zatca.*` succeeds.
  if (client === 'zatcaTrpc') {
    pathSegs = ['zatca', ...pathSegs];
  }
  return { client, path: pathSegs.join('.'), terminal };
}

function lineOf(node: ts.Node, sf: ts.SourceFile): number {
  return sf.getLineAndCharacterOfPosition(node.getStart(sf)).line + 1;
}

/** Inspect an object literal passed to mutationOptions({...}) and return handler flags. */
function inspectMutationOptions(arg: ts.Expression | undefined): {
  hasOnSuccess: boolean;
  hasOnError: boolean;
  hasToastSuccess: boolean;
  hasToastError: boolean;
  hasInvalidation: boolean;
} {
  const flags = {
    hasOnSuccess: false,
    hasOnError: false,
    hasToastSuccess: false,
    hasToastError: false,
    hasInvalidation: false,
  };
  if (!(arg && ts.isObjectLiteralExpression(arg))) return flags;
  for (const prop of arg.properties) {
    // Shorthand property assignment: { onSuccess, onError } where the name
    // matches an in-scope identifier. Treat as indirect handler (see below).
    if (ts.isShorthandPropertyAssignment(prop) && ts.isIdentifier(prop.name)) {
      const handlerName = prop.name.text;
      if (handlerName === 'onSuccess') {
        flags.hasOnSuccess = true;
        flags.hasToastSuccess = true;
        flags.hasInvalidation = true;
      }
      if (handlerName === 'onError') {
        flags.hasOnError = true;
        flags.hasToastError = true;
      }
      continue;
    }
    if (
      (ts.isPropertyAssignment(prop) || ts.isMethodDeclaration(prop)) &&
      prop.name &&
      ts.isIdentifier(prop.name)
    ) {
      const handlerName = prop.name.text;
      if (handlerName === 'onSuccess') flags.hasOnSuccess = true;
      if (handlerName === 'onError') flags.hasOnError = true;
      // If the handler value is an Identifier (extracted callback reference)
      // we cannot follow it without cross-file resolution. Assume the
      // referenced function does the right thing — mark all sub-flags
      // (toast/invalidation) as satisfied to avoid noise. False negatives
      // here are documented as a detector limitation in AUDIT.md.
      if (ts.isPropertyAssignment(prop) && ts.isIdentifier(prop.initializer)) {
        if (handlerName === 'onSuccess') {
          flags.hasToastSuccess = true;
          flags.hasInvalidation = true;
        }
        if (handlerName === 'onError') {
          flags.hasToastError = true;
        }
        continue;
      }
      // walk body for toast.* / invalidateQueries
      const body: ts.Node | undefined = ts.isPropertyAssignment(prop)
        ? prop.initializer
        : prop.body;
      if (body) {
        ts.forEachChild(body, walkInner);
        function walkInner(n: ts.Node) {
          if (ts.isCallExpression(n)) {
            const callee = n.expression;
            const calleeText = callee.getText();
            if (calleeText === 'toast.success' && handlerName === 'onSuccess') {
              flags.hasToastSuccess = true;
            }
            if (calleeText === 'toast.error' && handlerName === 'onError') {
              flags.hasToastError = true;
            }
            // toast.success could appear in onError too if double-call; treat onSuccess flag strictly
            if (calleeText.endsWith('invalidateQueries') && handlerName === 'onSuccess') {
              flags.hasInvalidation = true;
            }
            if (calleeText.endsWith('invalidate') && handlerName === 'onSuccess') {
              // e.g. utils.something.invalidate()
              flags.hasInvalidation = true;
            }
          }
          ts.forEachChild(n, walkInner);
        }
      }
    }
  }
  return flags;
}

/**
 * Detect any reference to `<varName>.isPending` OR `<varName>.mutateAsync`
 * in a SourceFile. Both count as "loading-state handled":
 *   - `.isPending` → UI bound directly.
 *   - `.mutateAsync` → caller awaits inside an async pipeline; loading state
 *     is managed by the caller's own state machine (upload progress, wizard
 *     advance, etc.), not by a single trigger button.
 */
function fileHasIsPendingFor(sf: ts.SourceFile, mutationVar: string | null): boolean {
  if (!mutationVar) return false;
  let found = false;
  const visit = (n: ts.Node) => {
    if (found) return;
    if (
      ts.isPropertyAccessExpression(n) &&
      ts.isIdentifier(n.expression) &&
      n.expression.text === mutationVar &&
      ts.isIdentifier(n.name) &&
      (n.name.text === 'isPending' || n.name.text === 'isLoading' || n.name.text === 'mutateAsync')
    ) {
      found = true;
      return;
    }
    ts.forEachChild(n, visit);
  };
  ts.forEachChild(sf, visit);
  return found;
}

/** Walk up to find a wrapping VariableDeclaration -> name. */
function findEnclosingVarName(node: ts.Node): string | null {
  let cur: ts.Node | undefined = node;
  while (cur) {
    if (ts.isVariableDeclaration(cur) && ts.isIdentifier(cur.name)) return cur.name.text;
    cur = cur.parent;
  }
  return null;
}

// ---------------------------------------------------------------------------
// Walk each source file
// ---------------------------------------------------------------------------

const files = [...collectFiles(WEB_SRC), ...collectFiles(PUBLIC_API_SRC)];
console.log(`scanning ${files.length} files`);

for (const file of files) {
  const text = readFileSync(file, 'utf8');
  if (!(text.includes('trpc') || text.includes('portalTrpc'))) continue;
  const sf = ts.createSourceFile(file, text, ts.ScriptTarget.ESNext, true, ts.ScriptKind.TSX);
  const fileHasAlertDialog =
    text.includes('AlertDialog') ||
    text.includes("from '@/components/ui/alert-dialog'") ||
    text.includes("from '@/components/ui/dialog'") ||
    text.includes('confirm(');

  const visit = (node: ts.Node) => {
    if (ts.isCallExpression(node)) {
      const match = matchTrpcChain(node.expression);
      if (match) {
        const enclosingVar = findEnclosingVarName(node);
        let handlers =
          match.terminal === 'mutationOptions'
            ? inspectMutationOptions(node.arguments[0])
            : {
                hasOnSuccess: false,
                hasOnError: false,
                hasToastSuccess: false,
                hasToastError: false,
                hasInvalidation: false,
              };

        // Spread pattern: `useMutation({ ...trpc.X.Y.mutationOptions(), onSuccess })`
        // — inspect the surrounding object literal for sibling handlers.
        if (match.terminal === 'mutationOptions') {
          const spread = node.parent;
          if (
            spread &&
            ts.isSpreadAssignment(spread) &&
            spread.parent &&
            ts.isObjectLiteralExpression(spread.parent)
          ) {
            const siblingFlags = inspectMutationOptions(spread.parent);
            handlers = {
              hasOnSuccess: handlers.hasOnSuccess || siblingFlags.hasOnSuccess,
              hasOnError: handlers.hasOnError || siblingFlags.hasOnError,
              hasToastSuccess: handlers.hasToastSuccess || siblingFlags.hasToastSuccess,
              hasToastError: handlers.hasToastError || siblingFlags.hasToastError,
              hasInvalidation: handlers.hasInvalidation || siblingFlags.hasInvalidation,
            };
          }
        }

        const hasIsPending =
          match.terminal === 'mutationOptions' ? fileHasIsPendingFor(sf, enclosingVar) : false;
        callers.push({
          client: match.client,
          path: match.path,
          kind: match.terminal,
          file: relative(ROOT, file),
          line: lineOf(node, sf),
          handlers: { ...handlers, hasIsPending },
          fileHasAlertDialog,
        });
      }
    }
    ts.forEachChild(node, visit);
  };
  ts.forEachChild(sf, visit);
}

mkdirSync(dirname(OUT), { recursive: true });
writeFileSync(OUT, JSON.stringify(callers, null, 2), 'utf8');

const byKind = callers.reduce<Record<string, number>>((acc, c) => {
  acc[c.kind] = (acc[c.kind] ?? 0) + 1;
  return acc;
}, {});
const uniquePaths = new Set(callers.map(c => `${c.client}:${c.path}`));

console.log(`\n✓ wrote ${callers.length} call sites to ${relative(ROOT, OUT)}`);
console.log(`  by kind: ${JSON.stringify(byKind)}`);
console.log(`  unique paths: ${uniquePaths.size}`);
