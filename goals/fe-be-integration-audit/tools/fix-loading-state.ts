#!/usr/bin/env tsx
/**
 * Auto-fix codemod for LOW missing-loading-state findings.
 *
 * Targets the common direct pattern:
 *   const xMutation = useMutation(trpc.<path>.mutationOptions(...));
 *   ...
 *   <Button onClick={() => xMutation.mutate(...)}>...
 *
 * For each JSX opening element that has an onClick / onSelect handler whose
 * body references `<varName>.mutate` or `.mutateAsync`, the codemod injects
 * `disabled={<varName>.isPending}` as a new attribute (immediately before
 * the matched handler attribute). It will not duplicate an existing
 * `disabled` prop and will not touch elements that already reference
 * `.isPending` anywhere in the same JSX opening element.
 *
 * Indirect patterns where the trigger calls a named handler (defined with
 * useCallback / function declaration) that internally invokes
 * `<varName>.mutate` are NOT auto-fixed — they require human judgement on
 * how to thread the loading state through the call hierarchy. The script
 * reports those as `skipped-indirect` so they can be addressed manually.
 *
 * Usage:
 *   npx tsx goals/fe-be-integration-audit/tools/fix-loading-state.ts
 *   npx tsx goals/fe-be-integration-audit/tools/fix-loading-state.ts --dry
 *
 * --dry prints the planned edits without writing them.
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import ts from 'typescript';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, '../../..');
const DATA = resolve(__dirname, '../data');

const dryRun = process.argv.includes('--dry');

type Finding = {
  id: string;
  severity: string;
  category: string;
  procedure?: string;
  file?: string;
  line?: number;
};

type Edit = { pos: number; insert: string };
type Report = {
  file: string;
  edits: number;
  skippedIndirect: number;
  skippedAlreadyHandled: number;
};

const findings: Finding[] = JSON.parse(readFileSync(resolve(DATA, 'findings.json'), 'utf8'));

const targets = new Map<string, Set<string>>(); // file -> set of procedure paths
for (const f of findings) {
  if (f.severity !== 'LOW' || f.category !== 'missing-loading-state') continue;
  if (!(f.file && f.procedure)) continue;
  const set = targets.get(f.file) ?? new Set<string>();
  set.add(f.procedure);
  targets.set(f.file, set);
}

const reports: Report[] = [];

for (const [relPath, procSet] of targets) {
  const file = resolve(ROOT, relPath);
  const text = readFileSync(file, 'utf8');
  const sf = ts.createSourceFile(file, text, ts.ScriptTarget.ESNext, true, ts.ScriptKind.TSX);

  // Step 1: find all `const <var> = useMutation(<path>.mutationOptions(...))` and
  // build a map from var name -> procedure path. We only care about vars whose
  // procedure path is in `procSet` for this file.
  const varToPath = new Map<string, string>();
  const visit1 = (n: ts.Node) => {
    if (
      ts.isVariableDeclaration(n) &&
      ts.isIdentifier(n.name) &&
      n.initializer &&
      ts.isCallExpression(n.initializer)
    ) {
      const callee = n.initializer.expression;
      // `useMutation(...)` — first argument is typically the mutationOptions call
      if (ts.isIdentifier(callee) && callee.text === 'useMutation') {
        const arg = n.initializer.arguments[0];
        const path = extractTrpcPath(arg);
        if (path && procSet.has(path)) {
          varToPath.set(n.name.text, path);
        }
      }
    }
    ts.forEachChild(n, visit1);
  };
  ts.forEachChild(sf, visit1);

  if (varToPath.size === 0) {
    reports.push({ file: relPath, edits: 0, skippedIndirect: 0, skippedAlreadyHandled: 0 });
    continue;
  }

  // Step 1b: find named handlers in the same file whose body references one of
  // the tracked mutation vars. Covers `const handleX = useCallback(() => mut.mutate(...))`
  // and plain `function handleX() { mut.mutate(...) }`. Maps handler name ->
  // the mutation var it ultimately triggers.
  const handlerToVar = new Map<string, string>();
  const captureHandler = (name: string, body: ts.Node) => {
    let firstVar: string | null = null;
    const find = (n: ts.Node) => {
      if (firstVar) return;
      if (
        ts.isPropertyAccessExpression(n) &&
        ts.isIdentifier(n.expression) &&
        ts.isIdentifier(n.name) &&
        (n.name.text === 'mutate' || n.name.text === 'mutateAsync') &&
        varToPath.has(n.expression.text)
      ) {
        firstVar = n.expression.text;
        return;
      }
      ts.forEachChild(n, find);
    };
    find(body);
    if (firstVar) handlerToVar.set(name, firstVar);
  };
  const visit1b = (n: ts.Node) => {
    // const handleX = useCallback(() => ..., [...])
    // const handleX = () => ...
    // const handleX = async () => ...
    if (ts.isVariableDeclaration(n) && ts.isIdentifier(n.name) && n.initializer) {
      const init = n.initializer;
      if (
        ts.isCallExpression(init) &&
        ts.isIdentifier(init.expression) &&
        init.expression.text === 'useCallback' &&
        init.arguments[0]
      ) {
        captureHandler(n.name.text, init.arguments[0]);
      } else if (ts.isArrowFunction(init) || ts.isFunctionExpression(init)) {
        captureHandler(n.name.text, init.body);
      }
    }
    // function handleX(...) { ... }
    if (ts.isFunctionDeclaration(n) && n.name && n.body) {
      captureHandler(n.name.text, n.body);
    }
    ts.forEachChild(n, visit1b);
  };
  ts.forEachChild(sf, visit1b);

  // Step 2: walk JSX opening elements, find onClick/onSelect/etc handlers whose
  // body references `<var>.mutate*` directly.
  const edits: Edit[] = [];
  let skippedAlready = 0;
  const TRIGGER_ATTRS = new Set(['onClick', 'onSelect', 'onSubmit', 'onPress']);
  // Whitelist of element names known to accept a `disabled` prop. Native HTML
  // elements that accept it plus shadcn/radix primitives used in this repo.
  // Custom application components are excluded — they may not surface a
  // `disabled` prop, which would cause TS to reject the injected attribute.
  const DISABLED_CAPABLE = new Set([
    'button',
    'input',
    'fieldset',
    'optgroup',
    'option',
    'select',
    'textarea',
    'Button',
    'IconButton',
    'CommandItem',
    'DropdownMenuItem',
    'DropdownMenuCheckboxItem',
    'DropdownMenuRadioItem',
    'MenuItem',
    'ContextMenuItem',
    'AlertDialogAction',
    'AlertDialogCancel',
    'SelectItem',
    'ToggleGroupItem',
    'Toggle',
    'Switch',
    'Checkbox',
    'RadioGroupItem',
    'Tab',
    'TabsTrigger',
  ]);

  const visit2 = (n: ts.Node) => {
    if (ts.isJsxOpeningElement(n) || ts.isJsxSelfClosingElement(n)) {
      const tagName = ts.isIdentifier(n.tagName) ? n.tagName.text : null;
      if (!(tagName && DISABLED_CAPABLE.has(tagName))) {
        ts.forEachChild(n, visit2);
        return;
      }
      const attrs = n.attributes.properties;
      let triggerAttr: ts.JsxAttribute | null = null;
      let triggerVar: string | null = null;
      let hasDisabled = false;
      let referencesIsPending = false;

      for (const attr of attrs) {
        if (!(ts.isJsxAttribute(attr) && ts.isIdentifier(attr.name))) continue;
        const name = attr.name.text;
        if (name === 'disabled') hasDisabled = true;
        if (TRIGGER_ATTRS.has(name) && attr.initializer) {
          const handlerVar = findHandlerMutation(attr.initializer, varToPath, handlerToVar);
          if (handlerVar) {
            triggerAttr = attr;
            triggerVar = handlerVar;
          }
        }
        // Look for any text-level reference to <var>.isPending already on this
        // element (e.g. disabled={mut.isPending || other} or className={...}).
        const attrText = attr.getText(sf);
        for (const v of varToPath.keys()) {
          if (attrText.includes(`${v}.isPending`)) referencesIsPending = true;
        }
      }

      if (triggerAttr && triggerVar) {
        if (hasDisabled || referencesIsPending) {
          skippedAlready++;
        } else {
          const insertPos = triggerAttr.getStart(sf);
          edits.push({
            pos: insertPos,
            insert: `disabled={${triggerVar}.isPending} `,
          });
        }
      }
    }
    ts.forEachChild(n, visit2);
  };
  ts.forEachChild(sf, visit2);

  // Step 3: estimate how many findings remain unfixed (indirect handlers)
  const distinctVars = new Set([...edits.map(e => e.insert)]).size;
  const skippedIndirect = Math.max(0, procSet.size - distinctVars - skippedAlready);

  if (edits.length === 0) {
    reports.push({
      file: relPath,
      edits: 0,
      skippedIndirect,
      skippedAlreadyHandled: skippedAlready,
    });
    continue;
  }

  // Apply edits in descending position order
  edits.sort((a, b) => b.pos - a.pos);
  let updated = text;
  for (const e of edits) {
    updated = updated.slice(0, e.pos) + e.insert + updated.slice(e.pos);
  }

  if (dryRun) {
    console.log(`[dry] ${relPath}: ${edits.length} edits`);
  } else {
    writeFileSync(file, updated, 'utf8');
  }
  reports.push({
    file: relPath,
    edits: edits.length,
    skippedIndirect,
    skippedAlreadyHandled: skippedAlready,
  });
}

const totalEdits = reports.reduce((a, r) => a + r.edits, 0);
const totalIndirect = reports.reduce((a, r) => a + r.skippedIndirect, 0);
const totalAlready = reports.reduce((a, r) => a + r.skippedAlreadyHandled, 0);

console.log(`\n${dryRun ? '[DRY RUN] ' : ''}codemod summary`);
console.log(`  files inspected: ${reports.length}`);
console.log(`  edits applied:   ${totalEdits}`);
console.log(`  already handled: ${totalAlready}`);
console.log(`  indirect (skip): ${totalIndirect}`);
console.log('');
for (const r of reports) {
  if (r.edits === 0 && r.skippedIndirect === 0 && r.skippedAlreadyHandled === 0) continue;
  console.log(
    `  ${r.file} — applied=${r.edits} already=${r.skippedAlreadyHandled} indirect=${r.skippedIndirect}`,
  );
}

/**
 * If `node` is a `.mutationOptions(...)` chain rooted at trpc/portalTrpc (or a
 * file-level alias), return the dotted path between the client and the method.
 * Otherwise return null.
 */
function extractTrpcPath(arg: ts.Expression | undefined): string | null {
  if (!(arg && ts.isCallExpression(arg))) return null;
  const callee = arg.expression;
  if (!ts.isPropertyAccessExpression(callee)) return null;
  if (!ts.isIdentifier(callee.name) || callee.name.text !== 'mutationOptions') return null;
  // Walk back to root
  const segments: string[] = [];
  let cur: ts.Expression = callee.expression;
  while (ts.isPropertyAccessExpression(cur)) {
    if (!ts.isIdentifier(cur.name)) return null;
    segments.unshift(cur.name.text);
    cur = cur.expression;
  }
  if (!ts.isIdentifier(cur)) return null;
  // We don't strictly need the client name; findings.json uses the bare path
  // (e.g. `time.approve`) so just return the joined segments.
  return segments.join('.');
}

/**
 * Walk a JSX trigger attribute initializer and resolve the mutation var name
 * the handler ultimately triggers.
 *
 * Two patterns are accepted:
 *   1. Direct call inside the attribute: `onClick={() => mut.mutate(...)}` or
 *      `onClick={mut.mutate}`.
 *   2. Reference to a named handler whose body invokes `mut.mutate*`:
 *      `onClick={handleApprove}` where `handleApprove` was captured by
 *      `handlerToVar` during the pre-pass.
 */
function findHandlerMutation(
  initializer: ts.JsxAttributeValue,
  varToPath: Map<string, string>,
  handlerToVar: Map<string, string>,
): string | null {
  if (!(ts.isJsxExpression(initializer) && initializer.expression)) return null;
  let found: string | null = null;
  const visit = (n: ts.Node) => {
    if (found) return;
    if (
      ts.isPropertyAccessExpression(n) &&
      ts.isIdentifier(n.expression) &&
      ts.isIdentifier(n.name) &&
      (n.name.text === 'mutate' || n.name.text === 'mutateAsync') &&
      varToPath.has(n.expression.text)
    ) {
      found = n.expression.text;
      return;
    }
    if (ts.isIdentifier(n) && handlerToVar.has(n.text)) {
      found = handlerToVar.get(n.text) ?? null;
      return;
    }
    ts.forEachChild(n, visit);
  };
  visit(initializer.expression);
  return found;
}
