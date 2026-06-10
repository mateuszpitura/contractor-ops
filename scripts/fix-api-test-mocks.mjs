#!/usr/bin/env node
/**
 * Batch-fix API vitest mocks: prismaRaw on @contractor-ops/db,
 * getIdpAuditLogger on @contractor-ops/logger, getServerEnv on @contractor-ops/validators.
 */
import fs from 'node:fs';
import { execSync } from 'node:child_process';
import path from 'node:path';

const apiSrc = 'packages/api/src';

const testFiles = execSync(`rg --files ${apiSrc} -g '*.test.ts'`, { encoding: 'utf8' })
  .trim()
  .split('\n')
  .filter(Boolean);

const noopLoggerStub =
  'getIdpAuditLogger: vi.fn(() => ({ info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn(), child: vi.fn() })),';

let dbFixed = 0;
let loggerFixed = 0;
let validatorsFixed = 0;

for (const file of testFiles) {
  let text = fs.readFileSync(file, 'utf8');
  let changed = false;

  // --- @contractor-ops/db: prismaRaw ---
  if (text.includes("vi.mock('@contractor-ops/db'") && !text.includes('prismaRaw')) {
    // empty mock
    if (text.includes("vi.mock('@contractor-ops/db', () => ({}));")) {
      text = text.replace(
        "vi.mock('@contractor-ops/db', () => ({}));",
        `vi.mock('@contractor-ops/db', () => ({
  withRlsTransactions: <T>(c: T) => c,
  withRlsReads: <T>(c: T) => c,
  prisma: {},
  prismaRaw: {},
}));`,
      );
      changed = true;
    } else {
      // named prisma client variable (any identifier)
      const named = text.match(/vi\.mock\('@contractor-ops\/db'[\s\S]*?prisma:\s*(\w+),/);
      if (named) {
        const varName = named[1];
        text = text.replace(
          new RegExp(`(prisma:\\s*${varName},)`),
          `$1\n  prismaRaw: ${varName},`,
        );
        changed = true;
      } else if (text.includes("vi.mock('@contractor-ops/db', () => ({")) {
        // inline prisma object — convert to IIFE with shared reference
        const marker = "vi.mock('@contractor-ops/db', () => ({";
        const start = text.indexOf(marker);
        if (start !== -1) {
          let i = start + marker.length;
          let depth = 1;
          while (i < text.length && depth > 0) {
            const ch = text[i];
            if (ch === '{') depth++;
            else if (ch === '}') depth--;
            i++;
          }
          const end = i + 1; // include closing `)`
          const block = text.slice(start, end);
          const innerStart = marker.length;
          const inner = block.slice(innerStart, block.lastIndexOf('})'));

          const prismaMatch = inner.match(/\n(\s*)prisma:\s*(\{[\s\S]*?\n\1\}),/);
          if (prismaMatch) {
            const indent = prismaMatch[1];
            const prismaBody = prismaMatch[2];
            const rest = inner.replace(prismaMatch[0], `\n${indent}prisma: __mockDbPrisma,\n${indent}prismaRaw: __mockDbPrisma,`);
            const newBlock = `vi.mock('@contractor-ops/db', () => {
  const __mockDbPrisma = ${prismaBody};
  return {${rest}
  };
});`;
            text = text.slice(0, start) + newBlock + text.slice(end);
            changed = true;
          }
        }
      }
    }
    if (changed) dbFixed++;
  }

  // --- @contractor-ops/logger: getIdpAuditLogger ---
  if (
    text.includes("vi.mock('@contractor-ops/logger'") &&
    !text.includes('getIdpAuditLogger')
  ) {
    const insertAfter = [
      /(createLogger:\s*vi\.fn\([^)]*\)[^,]*,)/,
      /(createTrpcLogger:\s*vi\.fn\([^)]*\)[^,]*,)/,
      /(logger:\s*\{[^}]+\},)/,
    ];
    for (const re of insertAfter) {
      if (re.test(text)) {
        text = text.replace(re, `$1\n  ${noopLoggerStub}`);
        changed = true;
        loggerFixed++;
        break;
      }
    }
  }

  // --- @contractor-ops/validators: getServerEnv ---
  if (
    text.includes("vi.mock('@contractor-ops/validators'") &&
    !text.includes('getServerEnv')
  ) {
    text = text.replace(
      /vi\.mock\('@contractor-ops\/validators',\s*\(\)\s*=>\s*\(\{/,
      `vi.mock('@contractor-ops/validators', () => ({
  getServerEnv: vi.fn(() => process.env),`,
    );
    if (!text.includes('getServerEnv: vi.fn')) {
      text = text.replace(
        /vi\.mock\('@contractor-ops\/validators',\s*async\s*\([^)]*\)\s*=>\s*\(\{/,
        `vi.mock('@contractor-ops/validators', async (importOriginal) => {
  const actual = await importOriginal();
  return {
    ...actual,
    getServerEnv: vi.fn(() => process.env),`,
      );
    }
    if (text.includes('getServerEnv: vi.fn')) {
      changed = true;
      validatorsFixed++;
    }
  }

  if (changed) fs.writeFileSync(file, text);
}

console.log({ dbFixed, loggerFixed, validatorsFixed, total: testFiles.length });
