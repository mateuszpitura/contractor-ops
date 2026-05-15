#!/usr/bin/env tsx
import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import ts from 'typescript';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, '../../..');
const DATA = resolve(__dirname, '../data');

type Finding = {
  id: string;
  severity: 'HIGH' | 'MED' | 'LOW';
  category: string;
  procedure?: string;
  file?: string;
  line?: number;
  problem: string;
  fix: string;
  fixed?: boolean;
};

const findings: Finding[] = JSON.parse(readFileSync(resolve(DATA, 'findings.json'), 'utf8'));

const FIXABLE_CATEGORIES = new Set([
  'missing-on-error',
  'missing-error-toast',
  'missing-success-toast',
  'missing-on-success',
  'missing-invalidation',
]);

const filterArg = process.argv[2]; // optional: 'HIGH' | 'MED' | 'LOW' | category name
const candidates = findings.filter(f => {
  if (!FIXABLE_CATEGORIES.has(f.category)) return false;
  if (!(f.file && f.line)) return false;
  if (f.fixed) return false;
  if (filterArg) {
    if (filterArg === 'HIGH' || filterArg === 'MED' || filterArg === 'LOW') {
      return f.severity === filterArg;
    }
    return f.category === filterArg;
  }
  return true;
});

console.log(`processing ${candidates.length} fixable findings (filter=${filterArg ?? 'all'})`);

const byFile = new Map<string, Finding[]>();
for (const f of candidates) {
  const arr = byFile.get(f.file!) ?? [];
  arr.push(f);
  byFile.set(f.file!, arr);
}

function ensureToastImport(text: string): { text: string; changed: boolean } {
  if (/from\s+['"]sonner['"]/.test(text)) return { text, changed: false };
  // Insert after the last import statement
  const importRegex = /^(import\s+[^\n]+\n)+/m;
  const m = text.match(importRegex);
  if (!m) {
    // file starts without imports — prepend
    return { text: `import { toast } from 'sonner';\n${text}`, changed: true };
  }
  const idx = m.index! + m[0].length;
  return {
    text: text.slice(0, idx) + "import { toast } from 'sonner';\n" + text.slice(idx),
    changed: true,
  };
}

/**
 * Apply all fixes in a single file. Returns updated text + summary of applied IDs.
 */
function fixFile(
  filePath: string,
  fileFindings: Finding[],
): {
  text: string;
  appliedIds: string[];
} {
  let text = readFileSync(filePath, 'utf8');
  const appliedIds: string[] = [];
  let needsToast = false;
  let needsQueryClient = false;

  // Re-parse for each finding (state may have shifted after prior edits)
  for (const f of fileFindings) {
    if (!f.procedure) continue;
    const sf = ts.createSourceFile(filePath, text, ts.ScriptTarget.ESNext, true, ts.ScriptKind.TSX);
    const targetLine = f.line! - 1;

    // Find the mutationOptions call expression closest to the target line for f.procedure.
    let target: ts.CallExpression | null = null;
    const visit = (node: ts.Node) => {
      if (target) return;
      if (ts.isCallExpression(node)) {
        const callText = node.expression.getText(sf);
        if (
          callText.endsWith(`${f.procedure}.mutationOptions`) ||
          callText.endsWith(`${f.procedure?.split('.').slice(-1)[0]}.mutationOptions`)
        ) {
          const { line } = sf.getLineAndCharacterOfPosition(node.getStart(sf));
          if (Math.abs(line - targetLine) <= 5) {
            target = node;
            return;
          }
        }
      }
      ts.forEachChild(node, visit);
    };
    visit(sf);
    if (!target) {
      console.log(`  ${f.id} ${f.file}:${f.line} — could not locate call expression`);
      continue;
    }

    // Decide where to insert: surrounding object if spread; else inner mutationOptions arg.
    const targetCall = target as ts.CallExpression;
    const insideArg = targetCall.arguments[0];
    let targetObj: ts.ObjectLiteralExpression | null = null;
    let _isOuterSpread = false;
    const parent = targetCall.parent;
    if (
      parent &&
      ts.isSpreadAssignment(parent) &&
      parent.parent &&
      ts.isObjectLiteralExpression(parent.parent)
    ) {
      targetObj = parent.parent;
      _isOuterSpread = true;
    } else if (insideArg && ts.isObjectLiteralExpression(insideArg)) {
      targetObj = insideArg;
    }

    // ---------- Case A: missing-on-error → add onError handler ----------
    if (f.category === 'missing-on-error') {
      // Check existing properties
      if (targetObj) {
        const hasOnError = targetObj.properties.some(
          p =>
            (ts.isPropertyAssignment(p) || ts.isMethodDeclaration(p)) &&
            p.name &&
            ts.isIdentifier(p.name) &&
            p.name.text === 'onError',
        );
        if (hasOnError) {
          // Already added — mark fixed
          appliedIds.push(f.id);
          continue;
        }
        text = insertPropertyIntoObject(
          text,
          targetObj,
          sf,
          'onError: (err) => toast.error(err.message),',
        );
        needsToast = true;
        appliedIds.push(f.id);
      } else {
        // mutationOptions() with no arg — replace () with ({onError: ...})
        const start = targetCall.getStart(sf);
        const end = targetCall.getEnd();
        const callText = text.slice(start, end);
        const replaced = callText.replace(
          /mutationOptions\s*\(\s*\)/,
          `mutationOptions({ onError: (err) => toast.error(err.message) })`,
        );
        if (replaced !== callText) {
          text = text.slice(0, start) + replaced + text.slice(end);
          needsToast = true;
          appliedIds.push(f.id);
        }
      }
      continue;
    }

    // ---------- Case B: missing-error-toast → add toast.error inside onError ----------
    if (f.category === 'missing-error-toast') {
      if (!targetObj) continue;
      const onErrorProp = targetObj.properties.find(
        p =>
          (ts.isPropertyAssignment(p) || ts.isMethodDeclaration(p)) &&
          p.name &&
          ts.isIdentifier(p.name) &&
          p.name.text === 'onError',
      );
      if (!onErrorProp) continue;
      const paramName = handlerParamName(onErrorProp);
      const inserted = injectToastIntoHandler(
        text,
        onErrorProp,
        sf,
        `toast.error(${paramName}.message);`,
      );
      if (inserted) {
        text = inserted;
        needsToast = true;
        appliedIds.push(f.id);
      }
      continue;
    }

    // ---------- Case D: missing-on-success → add onSuccess handler ----------
    if (f.category === 'missing-on-success') {
      if (targetObj) {
        const hasOnSuccess = targetObj.properties.some(
          p =>
            (ts.isPropertyAssignment(p) || ts.isMethodDeclaration(p)) &&
            p.name &&
            ts.isIdentifier(p.name) &&
            p.name.text === 'onSuccess',
        );
        if (hasOnSuccess) {
          appliedIds.push(f.id);
          continue;
        }
        text = insertPropertyIntoObject(
          text,
          targetObj,
          sf,
          "onSuccess: () => { toast.success('Done.'); },",
        );
        needsToast = true;
        appliedIds.push(f.id);
      } else {
        const start = targetCall.getStart(sf);
        const end = targetCall.getEnd();
        const callText = text.slice(start, end);
        const replaced = callText.replace(
          /mutationOptions\s*\(\s*\)/,
          `mutationOptions({ onSuccess: () => { toast.success('Done.'); } })`,
        );
        if (replaced !== callText) {
          text = text.slice(0, start) + replaced + text.slice(end);
          needsToast = true;
          appliedIds.push(f.id);
        }
      }
      continue;
    }

    // ---------- Case C: missing-success-toast → add toast.success inside onSuccess ----------
    if (f.category === 'missing-success-toast') {
      if (!targetObj) continue;
      const onSuccessProp = targetObj.properties.find(
        p =>
          (ts.isPropertyAssignment(p) || ts.isMethodDeclaration(p)) &&
          p.name &&
          ts.isIdentifier(p.name) &&
          p.name.text === 'onSuccess',
      );
      if (!onSuccessProp) continue;
      const inserted = injectToastIntoHandler(text, onSuccessProp, sf, "toast.success('Done.');");
      if (inserted) {
        text = inserted;
        needsToast = true;
        appliedIds.push(f.id);
      }
      continue;
    }

    // ---------- Case E: missing-invalidation → add queryClient.invalidateQueries(trpc.<router>.pathFilter()) ----------
    if (f.category === 'missing-invalidation') {
      if (!targetObj) continue;
      const onSuccessProp = targetObj.properties.find(
        p =>
          (ts.isPropertyAssignment(p) || ts.isMethodDeclaration(p)) &&
          p.name &&
          ts.isIdentifier(p.name) &&
          p.name.text === 'onSuccess',
      );
      if (!onSuccessProp) continue;
      // Determine client name from procedure path lookup: derive from chain root.
      // Quick heuristic: scan file for `from '@/trpc/init'` import to find trpc/portalTrpc names.
      const clientName =
        text.includes('portalTrpc') && f.procedure?.startsWith('portal')
          ? 'portalTrpc'
          : text.includes('zatcaTrpc') && f.procedure?.startsWith('zatca')
            ? 'zatcaTrpc'
            : 'trpc';
      const routerName = f.procedure?.split('.')[0];
      const stmt = `queryClient.invalidateQueries(${clientName}.${routerName}.pathFilter());`;
      const inserted = injectToastIntoHandler(text, onSuccessProp, sf, stmt);
      if (inserted) {
        text = inserted;
        needsQueryClient = true;
        appliedIds.push(f.id);
      }
    }
  }

  if (needsToast) {
    const r = ensureToastImport(text);
    text = r.text;
  }
  if (needsQueryClient) {
    text = ensureQueryClient(text);
  }
  return { text, appliedIds };
}

/**
 * Ensure file has `useQueryClient` import + `const queryClient = useQueryClient();`
 * inside the component body. Idempotent.
 */
function ensureQueryClient(text: string): string {
  // 1) Import: useQueryClient must come from @tanstack/react-query
  if (!/useQueryClient/.test(text)) {
    // Augment existing @tanstack/react-query import or add new
    const rqImport = /import\s*\{([^}]*)\}\s*from\s*['"]@tanstack\/react-query['"]/;
    const m = text.match(rqImport);
    if (m) {
      const names = m[1]
        .split(',')
        .map(s => s.trim())
        .filter(Boolean);
      if (!names.includes('useQueryClient')) {
        names.push('useQueryClient');
      }
      text = text.replace(rqImport, `import { ${names.join(', ')} } from '@tanstack/react-query'`);
    } else {
      // No @tanstack/react-query import — insert one after last import
      const importRegex = /^(import\s+[^\n]+\n)+/m;
      const m2 = text.match(importRegex);
      if (m2) {
        const idx = m2.index! + m2[0].length;
        text =
          text.slice(0, idx) +
          "import { useQueryClient } from '@tanstack/react-query';\n" +
          text.slice(idx);
      }
    }
  }
  // 2) Hook call: `const queryClient = useQueryClient();` — must appear before any onSuccess that uses it.
  if (!/const\s+queryClient\s*=\s*useQueryClient\(\)/.test(text)) {
    // Inject before the first hook-using line (useMutation, useResourceMutation, etc.).
    const hookSite = text.search(/\n\s*const\s+\w+\s*=\s*use[A-Z]\w*[Mm]utation\(/);
    if (hookSite > -1) {
      let lineStart = hookSite + 1;
      while (lineStart < text.length && text[lineStart] === ' ') lineStart++;
      const indent = text.slice(hookSite + 1, lineStart);
      text =
        text.slice(0, hookSite + 1) +
        `${indent}const queryClient = useQueryClient();\n` +
        text.slice(hookSite + 1);
    } else {
      // Fallback: inject after first `function ... {` or `export function ... {`
      const fnSite = text.search(/\n\s*(?:export\s+)?function\s+\w+[^{]*\{/);
      if (fnSite > -1) {
        const closingBrace = text.indexOf('{', fnSite);
        if (closingBrace > -1) {
          text =
            text.slice(0, closingBrace + 1) +
            `\n  const queryClient = useQueryClient();` +
            text.slice(closingBrace + 1);
        }
      }
    }
  }
  return text;
}

/** Insert `propText` (e.g. "onError: ...,") into `obj`. Returns updated full source text. */
function insertPropertyIntoObject(
  text: string,
  obj: ts.ObjectLiteralExpression,
  sf: ts.SourceFile,
  propText: string,
): string {
  // Strategy: insert just before the closing brace
  const closeBracePos = obj.getEnd() - 1; // position of '}'
  // Determine if object is empty / has trailing items
  const props = obj.properties;
  const before = text.slice(0, closeBracePos);
  const after = text.slice(closeBracePos);

  // Detect indentation from object opening
  const _openBracePos = obj.getStart(sf) + (text[obj.getStart(sf)] === '{' ? 1 : 0);
  // Walk back from closeBracePos to find newline + indent
  let lineStart = closeBracePos;
  while (lineStart > 0 && text[lineStart - 1] !== '\n') lineStart--;
  const closingIndent = text.slice(lineStart, closeBracePos).match(/^\s*/)?.[0] ?? '';
  const innerIndent = closingIndent + '  ';

  if (props.length === 0) {
    return `${before}\n${innerIndent}${propText}\n${closingIndent}${after}`;
  }
  // Has props — insert before closing brace, ensure trailing comma on prior prop if missing
  const lastProp = props[props.length - 1];
  const lastEnd = lastProp.getEnd();
  const trailingText = text.slice(lastEnd, closeBracePos);
  // If there's no comma between last prop and closing brace, add one
  let injected: string;
  if (trailingText.match(/,\s*$/)) {
    injected = `${before}\n${innerIndent}${propText}\n${closingIndent}${after}`;
  } else {
    injected = `${text.slice(0, lastEnd)},\n${innerIndent}${propText}\n${closingIndent}${after}`;
  }
  return injected;
}

/** Extract first parameter name from a handler property (arrow fn or method). Returns 'err' as fallback. */
function handlerParamName(prop: ts.ObjectLiteralElementLike): string {
  let params: ts.NodeArray<ts.ParameterDeclaration> | null = null;
  if (ts.isPropertyAssignment(prop)) {
    if (ts.isArrowFunction(prop.initializer) || ts.isFunctionExpression(prop.initializer)) {
      params = prop.initializer.parameters;
    }
  } else if (ts.isMethodDeclaration(prop)) {
    params = prop.parameters;
  }
  if (params && params.length > 0) {
    const first = params[0];
    if (ts.isIdentifier(first.name)) return first.name.text;
  }
  return 'err';
}

/** Inject a statement into an onSuccess/onError handler body (arrow fn body or method body). */
function injectToastIntoHandler(
  text: string,
  prop: ts.ObjectLiteralElementLike,
  sf: ts.SourceFile,
  stmt: string,
): string | null {
  let body: ts.Node | null = null;
  if (
    ts.isPropertyAssignment(prop) &&
    (ts.isArrowFunction(prop.initializer) || ts.isFunctionExpression(prop.initializer))
  ) {
    body = prop.initializer.body;
  } else if (ts.isMethodDeclaration(prop) && prop.body) {
    body = prop.body;
  }
  if (!body) return null;
  // If body is a Block, insert at end. If it's an expression (arrow shorthand), wrap into block.
  if (ts.isBlock(body)) {
    const closePos = body.getEnd() - 1; // '}'
    let lineStart = closePos;
    while (lineStart > 0 && text[lineStart - 1] !== '\n') lineStart--;
    const closingIndent = text.slice(lineStart, closePos).match(/^\s*/)?.[0] ?? '';
    const innerIndent = closingIndent + '  ';
    return `${text.slice(0, closePos)}${innerIndent}${stmt}\n${closingIndent}${text.slice(closePos)}`;
  }
  // Arrow shorthand: wrap
  const start = body.getStart(sf);
  const end = body.getEnd();
  const inner = text.slice(start, end);
  return `${text.slice(0, start)}{ ${inner}; ${stmt} }${text.slice(end)}`;
}

// ---------------------------------------------------------------------------
// Apply
// ---------------------------------------------------------------------------

let totalApplied = 0;
const filesTouched: string[] = [];
for (const [file, items] of byFile) {
  const absPath = resolve(ROOT, file);
  try {
    const before = readFileSync(absPath, 'utf8');
    const { text, appliedIds } = fixFile(absPath, items);
    if (text !== before && appliedIds.length > 0) {
      writeFileSync(absPath, text, 'utf8');
      filesTouched.push(file);
      totalApplied += appliedIds.length;
      console.log(`✓ ${file}  +${appliedIds.length} (${appliedIds.join(',')})`);
      for (const f of findings) {
        if (appliedIds.includes(f.id)) f.fixed = true;
      }
    }
  } catch (e) {
    console.error(`✗ ${file}: ${e}`);
  }
}

writeFileSync(resolve(DATA, 'findings.json'), JSON.stringify(findings, null, 2), 'utf8');
console.log(`\n✓ applied ${totalApplied} fixes across ${filesTouched.length} files`);
