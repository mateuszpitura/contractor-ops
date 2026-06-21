// Multi-tenant Prisma schema guard.
//
// Walks the provided list of `*.prisma` files, parses each `model X { ... }`
// block, and returns one offence for every model that:
//   - declares any field, AND
//   - has no `organizationId` field, AND
//   - is not present in the allowlist.
//
// The parser is line-based and strips `//` line comments + `/* */` block
// comments before scanning so commented-out fields cannot accidentally
// satisfy the gate.

import { readFile } from 'node:fs/promises';

import { GLOBAL_LOOKUP_MODELS_ALLOWLIST } from './global-lookup-allowlist';

export interface SchemaGuardOptions {
  files: readonly string[];
  allowlist?: readonly string[];
}

export interface SchemaGuardOffence {
  kind: 'missing-organization-id';
  model: string;
  file: string;
  line: number;
  remediation: string;
}

interface ParsedModel {
  name: string;
  startLine: number;
  fields: { name: string; line: number }[];
}

/** Strip line comments and block comments from Prisma SDL. */
function stripComments(src: string): string {
  // Remove block comments first (Prisma forbids nested block comments).
  // Replace with same-length whitespace to preserve line numbers.
  const noBlocks = src.replace(/\/\*[\s\S]*?\*\//g, match => match.replace(/[^\n]/g, ' '));
  // Remove line comments — preserve newlines.
  return noBlocks.replace(/\/\/[^\n]*/g, match => ' '.repeat(match.length));
}

/**
 * Extract a field name from a model-body line, or `null` when the line is not
 * a field declaration. A field is an identifier followed by a type token
 * (capital-letter Prisma scalar/enum/relation); block attributes (`@@…`) and
 * comment lines are skipped.
 */
function extractFieldName(line: string): string | null {
  const trimmed = line.trim();
  if (trimmed.startsWith('@@') || trimmed.startsWith('//')) return null;
  const fieldMatch = line.match(/^\s*([a-zA-Z_][a-zA-Z0-9_]*)\s+[A-Za-z]/);
  return fieldMatch ? (fieldMatch[1] as string) : null;
}

function parseModels(src: string): ParsedModel[] {
  const lines = stripComments(src).split('\n');
  const models: ParsedModel[] = [];
  let current: ParsedModel | null = null;
  let depth = 0;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i] ?? '';
    const modelMatch = line.match(/^\s*model\s+([A-Z][A-Za-z0-9_]*)\s*\{/);
    if (modelMatch && depth === 0) {
      current = { name: modelMatch[1] as string, startLine: i + 1, fields: [] };
      depth = 1;
      continue;
    }
    if (!current) continue;

    const opens = line.match(/\{/g)?.length ?? 0;
    const closes = line.match(/\}/g)?.length ?? 0;
    depth += opens - closes;

    const fieldName = extractFieldName(line);
    if (fieldName) {
      current.fields.push({ name: fieldName, line: i + 1 });
    }
    if (depth === 0) {
      models.push(current);
      current = null;
    }
  }
  return models;
}

const REMEDIATION_ANCHOR = 'docs/lint-remediation/lint-schema.md#missing-organization-id';

export async function runSchemaGuard(opts: SchemaGuardOptions): Promise<SchemaGuardOffence[]> {
  const allowlist = new Set<string>(opts.allowlist ?? GLOBAL_LOOKUP_MODELS_ALLOWLIST);
  const offences: SchemaGuardOffence[] = [];
  for (const file of opts.files) {
    const src = await readFile(file, 'utf-8');
    for (const model of parseModels(src)) {
      if (allowlist.has(model.name)) continue;
      // A model with zero declared fields is malformed Prisma SDL — skip.
      // The parser only enters a model on the model-open token, so this
      // branch should be rare in practice.
      if (model.fields.length === 0) continue;
      const hasOrgId = model.fields.some(f => f.name === 'organizationId');
      if (!hasOrgId) {
        offences.push({
          kind: 'missing-organization-id',
          model: model.name,
          file,
          line: model.startLine,
          remediation: REMEDIATION_ANCHOR,
        });
      }
    }
  }
  return offences;
}
