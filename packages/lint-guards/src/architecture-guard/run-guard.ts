import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative, resolve } from 'node:path';

export interface ArchitectureGuardOffence {
  file: string;
  line: number;
  rule: 'inline-entity-id' | 'local-format-amount' | 'web-vite-db-import';
  detail: string;
}

export interface ArchitectureGuardOptions {
  rootDir?: string;
}

function walk(dir: string, acc: string[] = []): string[] {
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    const st = statSync(full);
    if (st.isDirectory()) {
      if (entry === 'node_modules' || entry === 'dist') continue;
      walk(full, acc);
    } else if (/\.(ts|tsx)$/.test(entry)) {
      acc.push(full);
    }
  }
  return acc;
}

export function runArchitectureGuard(opts: ArchitectureGuardOptions = {}): ArchitectureGuardOffence[] {
  const root = opts.rootDir ?? process.cwd();
  const offences: ArchitectureGuardOffence[] = [];

  const apiRouterDir = resolve(root, 'packages/api/src/routers');
  if (statSync(apiRouterDir).isDirectory()) {
    for (const file of walk(apiRouterDir)) {
      const rel = relative(root, file);
      const lines = readFileSync(file, 'utf8').split(/\r?\n/);
      lines.forEach((line, idx) => {
        if (
          /\.input\(.*z\.object\(\{\s*id:\s*z\.string\(\)/.test(line) ||
          /\bid:\s*z\.string\(\)\.min\(1\)/.test(line)
        ) {
          offences.push({
            file: rel,
            line: idx + 1,
            rule: 'inline-entity-id',
            detail: 'Use entityIdSchema from @contractor-ops/validators',
          });
        }
      });
    }
  }

  const webViteDir = resolve(root, 'apps/web-vite/src');
  if (statSync(webViteDir).isDirectory()) {
    for (const file of walk(webViteDir)) {
      const rel = relative(root, file);
      if (rel.endsWith('lib/money.ts')) continue;
      if (rel.includes('/__tests__/') || rel.includes('/__fixtures__/')) continue;
      const content = readFileSync(file, 'utf8');
      const lines = content.split(/\r?\n/);
      lines.forEach((line, idx) => {
        if (/function formatAmount\s*\(/.test(line)) {
          offences.push({
            file: rel,
            line: idx + 1,
            rule: 'local-format-amount',
            detail: 'Use formatMoneyAmount from apps/web-vite/src/lib/money.ts',
          });
        }
        if (/@contractor-ops\/db/.test(line) && !rel.includes('.test.')) {
          offences.push({
            file: rel,
            line: idx + 1,
            rule: 'web-vite-db-import',
            detail: 'Import DTOs from @contractor-ops/validators instead of @contractor-ops/db',
          });
        }
      });
    }
  }

  return offences;
}
