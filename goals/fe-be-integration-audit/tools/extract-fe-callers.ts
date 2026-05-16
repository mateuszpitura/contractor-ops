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
    /**
     * `onMutate` present in mutationOptions — signals an optimistic-update
     * pattern. The cache is mutated before the round-trip, so the conventional
     * `onSuccess` / invalidation / `isPending` checks do not apply.
     */
    hasOnMutate: boolean;
    /**
     * `onError` exists but its body is empty (no statements) — an intentional
     * silent swallow, typically used by mutations whose failure path is
     * non-actionable for the user (e.g. portal.logout).
     */
    hasEmptyOnError: boolean;
  };
  fileHasAlertDialog: boolean;
  /**
   * Caller lives under `apps/web/src/hooks/use-*` — confirmation gates and
   * loading-state UI live in the consuming component, not the hook.
   */
  isInHookFile: boolean;
  /**
   * The mutation's `.mutate` is invoked from inside a `useEffect` callback.
   * Effect-driven mutations have no discrete user trigger, so a loading
   * disable would have nothing to attach to.
   */
  isCalledInUseEffect: boolean;
  /**
   * The mutation var participates in a ternary alias of the form
   * `const X = cond ? mutA : mutB;` and an alias of that shape exists in
   * the same file. Used to suppress per-mutation noise when only one of
   * the routed mutations is active per render — the shared alias is the
   * one wired into the trigger.
   */
  isInRoutedAlias: boolean;
  /**
   * The file contains a `<input type="file">` JSX element. Mutations
   * triggered from a file picker's onChange are gated by a state
   * machine (`step = 'parsing'` → `'results'` / `'error'`) rather than a
   * disabled flag — the file input itself can't be disabled mid-upload.
   */
  fileHasFileInputTrigger: boolean;
  /**
   * The file contains a `router.replace(...)` or `window.location.href =`
   * assignment AND uses `mutateAsync` on this mutation. Indicates a
   * redirect-on-mutate pattern where the page unmounts after the mutation
   * resolves, so an onSuccess handler would have no UI to update.
   */
  hasRedirectAfterMutate: boolean;
  /**
   * A same-file handler that calls `<mutationVar>.mutate` is passed as a JSX
   * prop (any `on*` attribute) to a child component, OR `<var>.mutate` is
   * referenced inline inside a JSX `on*` attribute value that's bound on a
   * non-trigger-capable child element. The trigger ultimately lives inside
   * the child, so the wrapping file has nothing to disable.
   */
  isPassedToChildAsCallback: boolean;
};

const callers: Caller[] = [];

const TRPC_CLIENT_NAMES = new Set(['trpc', 'portalTrpc']);

type AliasTarget = { client: string; prefix: string[] };

/**
 * Module-level identifiers that re-export a slice of a tRPC client. Used by
 * typed-accessor files that work around TypeScript depth limits (e.g.
 * apps/web/src/lib/peppol-trpc.ts) or expose a sub-router shortcut (e.g.
 * zatcaTrpc → trpc.zatca). The detector treats calls rooted at these names
 * as if they were rooted at `<client>.<prefix>.*`.
 */
const MODULE_ALIASES: Record<string, AliasTarget> = {
  zatcaTrpc: { client: 'trpc', prefix: ['zatca'] },
  peppolTrpc: { client: 'trpc', prefix: ['peppol'] },
};

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
 * Build a file-local alias map by scanning top-level `const X = Y;` declarations
 * where Y is either a known tRPC client, a module-level accessor, or another
 * local alias. Resolves `const utils = trpc;` and chains like
 * `const a = utils; const b = a;`.
 */
function collectLocalAliases(sf: ts.SourceFile): Map<string, AliasTarget> {
  const map = new Map<string, AliasTarget>();
  const visit = (n: ts.Node) => {
    if (
      ts.isVariableDeclaration(n) &&
      ts.isIdentifier(n.name) &&
      n.initializer &&
      ts.isIdentifier(n.initializer)
    ) {
      const aliasName = n.name.text;
      const target = n.initializer.text;
      if (TRPC_CLIENT_NAMES.has(target)) {
        map.set(aliasName, { client: target, prefix: [] });
      } else if (MODULE_ALIASES[target]) {
        map.set(aliasName, MODULE_ALIASES[target]);
      } else if (map.has(target)) {
        const existing = map.get(target);
        if (existing) map.set(aliasName, existing);
      }
    }
    ts.forEachChild(n, visit);
  };
  ts.forEachChild(sf, visit);
  return map;
}

function resolveRoot(id: string, localAliases: Map<string, AliasTarget>): AliasTarget | null {
  if (TRPC_CLIENT_NAMES.has(id)) return { client: id, prefix: [] };
  if (MODULE_ALIASES[id]) return MODULE_ALIASES[id];
  return localAliases.get(id) ?? null;
}

/**
 * Match a PropertyAccessExpression chain rooted at a tRPC client, a module
 * alias (zatcaTrpc, peppolTrpc), or a file-local alias (const utils = trpc).
 *
 * Example AST: `trpc.equipment.equipment.assign.mutationOptions`
 *   client = 'trpc'
 *   pathSegments = ['equipment','equipment','assign']
 *   terminal = 'mutationOptions'
 */
function matchTrpcChain(
  expr: ts.Node,
  localAliases: Map<string, AliasTarget>,
): { client: string; path: string; terminal: string } | null {
  if (!ts.isPropertyAccessExpression(expr)) return null;
  const segments: string[] = [];
  let node: ts.Expression = expr;
  while (ts.isPropertyAccessExpression(node)) {
    if (!ts.isIdentifier(node.name)) return null;
    segments.unshift(node.name.text);
    node = node.expression;
  }
  if (!ts.isIdentifier(node)) return null;
  const resolved = resolveRoot(node.text, localAliases);
  if (!resolved) return null;
  // Need at least a procedure name + terminal (when prefix is empty); when an
  // alias already provides a prefix, a 2-segment chain still has 1 segment
  // before the terminal which is enough.
  if (segments.length < 2) return null;
  const terminal = segments[segments.length - 1];
  if (!TERMINAL_METHODS.has(terminal)) return null;
  const pathSegs = [...resolved.prefix, ...segments.slice(0, -1)];
  return { client: resolved.client, path: pathSegs.join('.'), terminal };
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
  hasOnMutate: boolean;
  hasEmptyOnError: boolean;
} {
  const flags = {
    hasOnSuccess: false,
    hasOnError: false,
    hasToastSuccess: false,
    hasToastError: false,
    hasInvalidation: false,
    hasOnMutate: false,
    hasEmptyOnError: false,
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
      if (handlerName === 'onMutate') {
        flags.hasOnMutate = true;
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
      if (handlerName === 'onMutate') flags.hasOnMutate = true;
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
      // Empty onError handler — block body with no statements OR an arrow
      // function returning a no-op (e.g. `onError: () => {}`). Intentional
      // silent swallow.
      if (handlerName === 'onError' && body) {
        if (
          (ts.isArrowFunction(body) || ts.isFunctionExpression(body)) &&
          ts.isBlock(body.body) &&
          body.body.statements.length === 0
        ) {
          flags.hasEmptyOnError = true;
        } else if (ts.isMethodDeclaration(prop) && prop.body && prop.body.statements.length === 0) {
          flags.hasEmptyOnError = true;
        }
      }
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
 * OR `<varName>.status === 'pending'` (alias used by some files) in a
 * SourceFile. All count as "loading-state handled":
 *   - `.isPending` → UI bound directly.
 *   - `.mutateAsync` → caller awaits inside an async pipeline; loading state
 *     is managed by the caller's own state machine (upload progress, wizard
 *     advance, etc.), not by a single trigger button.
 *   - `.status === 'pending'` → typed-status alias, identical to `.isPending`
 *     in TanStack v5 mutations. Some files prefer this for symmetry with
 *     useQuery's `status` semantics.
 */
function fileHasIsPendingFor(sf: ts.SourceFile, mutationVar: string | null): boolean {
  if (!mutationVar) return false;
  let found = false;
  const visit = (n: ts.Node) => {
    if (found) return;
    // Direct property access: <var>.isPending / .isLoading / .mutateAsync
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
    // Status-based alias: <var>.status === 'pending' (either side of `===`)
    if (
      ts.isBinaryExpression(n) &&
      n.operatorToken.kind === ts.SyntaxKind.EqualsEqualsEqualsToken
    ) {
      const sides = [n.left, n.right];
      const hasStatusAccess = sides.some(
        s =>
          ts.isPropertyAccessExpression(s) &&
          ts.isIdentifier(s.expression) &&
          s.expression.text === mutationVar &&
          ts.isIdentifier(s.name) &&
          s.name.text === 'status',
      );
      const hasPendingLiteral = sides.some(
        s => ts.isStringLiteralLike(s) && (s.text === 'pending' || s.text === 'loading'),
      );
      if (hasStatusAccess && hasPendingLiteral) {
        found = true;
        return;
      }
    }
    ts.forEachChild(n, visit);
  };
  ts.forEachChild(sf, visit);
  return found;
}

/** True when `<mutationVar>.mutate` (or .mutateAsync) is invoked from inside
 *  a `useEffect` callback in the same SourceFile — effect-driven mutation
 *  with no user-clickable trigger. */
function mutationCalledInUseEffect(sf: ts.SourceFile, mutationVar: string | null): boolean {
  if (!mutationVar) return false;
  let found = false;
  const visit = (n: ts.Node) => {
    if (found) return;
    // Look for useEffect(<arrow>, [...])
    if (
      ts.isCallExpression(n) &&
      ts.isIdentifier(n.expression) &&
      n.expression.text === 'useEffect' &&
      n.arguments[0]
    ) {
      const inner = (node: ts.Node) => {
        if (found) return;
        if (
          ts.isPropertyAccessExpression(node) &&
          ts.isIdentifier(node.expression) &&
          node.expression.text === mutationVar &&
          ts.isIdentifier(node.name) &&
          (node.name.text === 'mutate' || node.name.text === 'mutateAsync')
        ) {
          found = true;
          return;
        }
        ts.forEachChild(node, inner);
      };
      ts.forEachChild(n.arguments[0], inner);
    }
    ts.forEachChild(n, visit);
  };
  ts.forEachChild(sf, visit);
  return found;
}

/** True when `<mutationVar>.mutateAsync` is invoked anywhere in the file.
 *  Used to discriminate fire-and-forget mutate from awaited mutateAsync
 *  pipelines for the redirect-on-mutate heuristic. */
function mutationUsesMutateAsyncIn(sf: ts.SourceFile, mutationVar: string | null): boolean {
  if (!mutationVar) return false;
  let found = false;
  const visit = (n: ts.Node) => {
    if (found) return;
    if (
      ts.isPropertyAccessExpression(n) &&
      ts.isIdentifier(n.expression) &&
      n.expression.text === mutationVar &&
      ts.isIdentifier(n.name) &&
      n.name.text === 'mutateAsync'
    ) {
      found = true;
      return;
    }
    ts.forEachChild(n, visit);
  };
  ts.forEachChild(sf, visit);
  return found;
}

/** True when a same-file handler calls `<mutationVar>.mutate` AND that
 *  handler's identifier (or the mutation var itself) appears as a JSX
 *  attribute value somewhere in the file. Catches the "child component owns
 *  the trigger" pattern where the parent wires the mutation through an
 *  `onX={handler}` prop and there's no native disable-able element in this
 *  file. The non-disable-capable tag list (handled via the codemod's
 *  DISABLED_CAPABLE list) is the inverse case — here the child component
 *  type isn't known, so we suppress regardless.
 *
 *  Also accepts inline mutation refs (`onSave={() => mut.mutate(...)}`) on
 *  any JSX attribute whose name is NOT in the standard trigger set
 *  (onClick / onSubmit / onSelect / onPress). Custom prop names like
 *  `onSave`, `onConfirm`, `onApprove` get caught here. */
function isPassedToChildCallback(sf: ts.SourceFile, mutationVar: string | null): boolean {
  if (!mutationVar) return false;
  // 1. Collect all top-level handler names whose body references
  //    <mutationVar>.mutate / .mutateAsync.
  const wrappingHandlerNames = new Set<string>();
  const findHandlers = (n: ts.Node) => {
    if (
      ts.isVariableDeclaration(n) &&
      ts.isIdentifier(n.name) &&
      n.initializer &&
      (ts.isArrowFunction(n.initializer) ||
        ts.isFunctionExpression(n.initializer) ||
        (ts.isCallExpression(n.initializer) &&
          ts.isIdentifier(n.initializer.expression) &&
          n.initializer.expression.text === 'useCallback' &&
          n.initializer.arguments[0]))
    ) {
      const body =
        ts.isCallExpression(n.initializer) && n.initializer.arguments[0]
          ? n.initializer.arguments[0]
          : (n.initializer as ts.ArrowFunction | ts.FunctionExpression).body;
      if (body && referencesMutationMutate(body, mutationVar)) {
        wrappingHandlerNames.add(n.name.text);
      }
    }
    if (ts.isFunctionDeclaration(n) && n.name && n.body) {
      if (referencesMutationMutate(n.body, mutationVar)) {
        wrappingHandlerNames.add(n.name.text);
      }
    }
    ts.forEachChild(n, findHandlers);
  };
  ts.forEachChild(sf, findHandlers);

  // 2. Walk JSX attributes. Match if:
  //    a) attribute initializer is an Identifier referencing a wrapping handler, OR
  //    b) attribute initializer references <mutationVar>.mutate inline AND the
  //       attribute name is not a standard native trigger (onClick / onSubmit /
  //       onSelect / onPress).
  const NATIVE_TRIGGERS = new Set(['onClick', 'onSubmit', 'onSelect', 'onPress']);
  let matched = false;
  const visit = (n: ts.Node) => {
    if (matched) return;
    if (ts.isJsxAttribute(n) && ts.isIdentifier(n.name) && n.initializer) {
      const attrName = n.name.text;
      if (
        ts.isJsxExpression(n.initializer) &&
        n.initializer.expression &&
        ts.isIdentifier(n.initializer.expression) &&
        wrappingHandlerNames.has(n.initializer.expression.text)
      ) {
        matched = true;
        return;
      }
      if (
        attrName.startsWith('on') &&
        !NATIVE_TRIGGERS.has(attrName) &&
        ts.isJsxExpression(n.initializer) &&
        n.initializer.expression &&
        referencesMutationMutate(n.initializer.expression, mutationVar)
      ) {
        matched = true;
        return;
      }
    }
    ts.forEachChild(n, visit);
  };
  ts.forEachChild(sf, visit);
  return matched;
}

/** Find a `useMutation({ mutationFn: <mutationVar>.mutationFn, ... })` call
 *  in the file and return its options literal so its handlers can be
 *  merged into the upstream mutationOptions caller. Returns null when
 *  the pattern isn't present.
 *
 *  Pattern context: some files wrap a base mutationOptions to add
 *  onMutate / onSettled / cache-write helpers around the underlying
 *  mutationFn. The detector originally only saw the base call. This
 *  follow-up scan attaches the wrapper's handler intent. */
function findWrappedUseMutationOptions(
  sf: ts.SourceFile,
  baseVar: string | null,
): ts.ObjectLiteralExpression | null {
  if (!baseVar) return null;
  let result: ts.ObjectLiteralExpression | null = null;
  const visit = (n: ts.Node) => {
    if (result) return;
    if (
      ts.isCallExpression(n) &&
      ts.isIdentifier(n.expression) &&
      n.expression.text === 'useMutation' &&
      n.arguments[0] &&
      ts.isObjectLiteralExpression(n.arguments[0])
    ) {
      const obj = n.arguments[0];
      for (const prop of obj.properties) {
        if (
          ts.isPropertyAssignment(prop) &&
          prop.name &&
          ts.isIdentifier(prop.name) &&
          prop.name.text === 'mutationFn' &&
          ts.isPropertyAccessExpression(prop.initializer) &&
          ts.isIdentifier(prop.initializer.expression) &&
          prop.initializer.expression.text === baseVar &&
          ts.isIdentifier(prop.initializer.name) &&
          prop.initializer.name.text === 'mutationFn'
        ) {
          result = obj;
          return;
        }
      }
    }
    ts.forEachChild(n, visit);
  };
  ts.forEachChild(sf, visit);
  return result;
}

function referencesMutationMutate(node: ts.Node, mutationVar: string): boolean {
  let found = false;
  const visit = (n: ts.Node) => {
    if (found) return;
    if (
      ts.isPropertyAccessExpression(n) &&
      ts.isIdentifier(n.expression) &&
      n.expression.text === mutationVar &&
      ts.isIdentifier(n.name) &&
      (n.name.text === 'mutate' || n.name.text === 'mutateAsync')
    ) {
      found = true;
      return;
    }
    ts.forEachChild(n, visit);
  };
  ts.forEachChild(node, visit);
  return found;
}

/** True when the file declares a ternary alias of the form
 *  `const X = cond ? mutA : (cond2 ? mutB : mutC);` and `mutationVar` appears
 *  as one of the branch identifiers. Indicates the mutation participates in
 *  a routed-by-context dispatch where only one branch is active per render. */
function isInRoutedAliasFor(sf: ts.SourceFile, mutationVar: string | null): boolean {
  if (!mutationVar) return false;
  let found = false;
  const visit = (n: ts.Node) => {
    if (found) return;
    if (ts.isVariableDeclaration(n) && n.initializer && ts.isConditionalExpression(n.initializer)) {
      const branches: ts.Expression[] = [];
      const collect = (expr: ts.Expression) => {
        if (ts.isConditionalExpression(expr)) {
          collect(expr.whenTrue);
          collect(expr.whenFalse);
        } else {
          branches.push(expr);
        }
      };
      collect(n.initializer);
      const branchNames = branches
        .filter(b => ts.isIdentifier(b))
        .map(b => (b as ts.Identifier).text);
      if (branchNames.length >= 2 && branchNames.includes(mutationVar)) {
        found = true;
        return;
      }
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
  const localAliases = collectLocalAliases(sf);
  const fileHasAlertDialog =
    text.includes('AlertDialog') ||
    text.includes("from '@/components/ui/alert-dialog'") ||
    text.includes("from '@/components/ui/dialog'") ||
    text.includes('confirm(');

  // Hook files (apps/web/src/hooks/use-*.ts[x]) re-host mutations on behalf of
  // their consumers. Confirmation gates, loading-state UI, and post-mutateAsync
  // pipelines all live in the consuming component — not in the hook — so a
  // hook-bound mutation that "looks unhandled" is almost always handled by the
  // caller.
  const relFile = relative(ROOT, file);
  const isInHookFile =
    relFile.startsWith('apps/web/src/hooks/use-') ||
    relFile.includes('/hooks/use-template-mutations');
  // File-picker mutation surface (state-machine-progress pattern).
  const fileHasFileInputTrigger = /<input[^>]+type=['"]file['"]/i.test(text);
  // Mutation-then-redirect pattern. router.push / router.replace plus
  // direct assignment to window.location.href all qualify; each unmounts
  // the calling page and makes onSuccess UI work moot.
  const fileHasRedirect =
    text.includes('router.push') ||
    text.includes('router.replace') ||
    text.includes('window.location.href');

  const visit = (node: ts.Node) => {
    if (ts.isCallExpression(node)) {
      const match = matchTrpcChain(node.expression, localAliases);
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
              hasOnMutate: handlers.hasOnMutate || siblingFlags.hasOnMutate,
              hasEmptyOnError: handlers.hasEmptyOnError || siblingFlags.hasEmptyOnError,
            };
          }

          // Wrapped useMutation pattern: `useMutation({ mutationFn: base.mutationFn, ... })`
          // where `base` is the enclosing var of this mutationOptions call.
          // Merge the wrapper's options-literal handlers into ours so onMutate
          // (and any other ergonomics added at the wrapper level) get
          // surfaced for suppression rules downstream.
          const wrapped = findWrappedUseMutationOptions(sf, enclosingVar);
          if (wrapped) {
            const wrappedFlags = inspectMutationOptions(wrapped);
            handlers = {
              hasOnSuccess: handlers.hasOnSuccess || wrappedFlags.hasOnSuccess,
              hasOnError: handlers.hasOnError || wrappedFlags.hasOnError,
              hasToastSuccess: handlers.hasToastSuccess || wrappedFlags.hasToastSuccess,
              hasToastError: handlers.hasToastError || wrappedFlags.hasToastError,
              hasInvalidation: handlers.hasInvalidation || wrappedFlags.hasInvalidation,
              hasOnMutate: handlers.hasOnMutate || wrappedFlags.hasOnMutate,
              hasEmptyOnError: handlers.hasEmptyOnError || wrappedFlags.hasEmptyOnError,
            };
          }
        }

        const hasIsPending =
          match.terminal === 'mutationOptions' ? fileHasIsPendingFor(sf, enclosingVar) : false;
        const isCalledInUseEffect =
          match.terminal === 'mutationOptions'
            ? mutationCalledInUseEffect(sf, enclosingVar)
            : false;
        const isInRoutedAlias =
          match.terminal === 'mutationOptions' ? isInRoutedAliasFor(sf, enclosingVar) : false;
        // Redirect-on-mutate only fires when the mutation is actually
        // awaited (mutateAsync) — a synchronous mutate+redirect is fine on
        // its own, the redirect is the success UX.
        const hasRedirectAfterMutate =
          match.terminal === 'mutationOptions' &&
          fileHasRedirect &&
          mutationUsesMutateAsyncIn(sf, enclosingVar);
        const isPassedToChildAsCallback =
          match.terminal === 'mutationOptions' ? isPassedToChildCallback(sf, enclosingVar) : false;
        callers.push({
          client: match.client,
          path: match.path,
          kind: match.terminal,
          file: relFile,
          line: lineOf(node, sf),
          handlers: { ...handlers, hasIsPending },
          fileHasAlertDialog,
          isInHookFile,
          isCalledInUseEffect,
          isInRoutedAlias,
          fileHasFileInputTrigger,
          hasRedirectAfterMutate,
          isPassedToChildAsCallback,
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
