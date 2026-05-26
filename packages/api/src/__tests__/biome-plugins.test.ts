/**
 * Contract test for the three GritQL plugins under
 * `tools/biome-plugins/`. Each case writes a temporary fixture, runs
 * `biome check --reporter=json` over it, and asserts that the plugin
 * fired (or did not fire) where expected.
 *
 * The fixtures double as the canonical examples in the matching
 * `.fixtures.md` files. Keep them in sync — if you add a new
 * pass/fail example, update the markdown too.
 */

import { execFileSync } from 'node:child_process';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

const REPO_ROOT = resolve(import.meta.dirname, '../../../..');

let workdir: string;

beforeAll(() => {
  workdir = mkdtempSync(join(tmpdir(), 'biome-plugin-fixtures-'));
});

afterAll(() => {
  rmSync(workdir, { recursive: true, force: true });
});

interface BiomeRun {
  stdout: string;
  exitCode: number;
}

function writeFixture(name: string, content: string): string {
  const filePath = join(workdir, name);
  writeFileSync(filePath, content, 'utf8');
  return filePath;
}

function runBiome(filePath: string): BiomeRun {
  try {
    const stdout = execFileSync('pnpm', ['exec', 'biome', 'check', '--reporter=json', filePath], {
      cwd: REPO_ROOT,
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    return { stdout, exitCode: 0 };
  } catch (err) {
    const e = err as { status?: number; stdout?: string };
    return { stdout: e.stdout ?? '', exitCode: e.status ?? 1 };
  }
}

function countPluginDiagnostics(output: string): number {
  const matches = output.match(/"category":\s*"plugin"/g);
  return matches?.length ?? 0;
}

describe('no-untranslated-toast.grit', () => {
  it('flags literal toast.success / error / info / warning arguments', () => {
    const file = writeFixture(
      'reject-toast.tsx',
      `
        declare const toast: {
          success: (m: string) => void;
          error: (m: string) => void;
          info: (m: string) => void;
          warning: (m: string) => void;
        };
        function f() {
          toast.success('Saved');
          toast.error("Failed to save");
          toast.info('Heads up');
          toast.warning('Be careful');
        }
        export {};
      `,
    );
    const { stdout } = runBiome(file);
    expect(countPluginDiagnostics(stdout)).toBeGreaterThanOrEqual(4);
  });

  it('does not flag wrapped / templated values', () => {
    const file = writeFixture(
      'allow-toast.tsx',
      `
        declare const toast: {
          success: (m: string) => void;
          error: (m: string) => void;
          info: (m: string) => void;
          warning: (m: string) => void;
        };
        declare const t: (k: string) => string;
        declare const tKey: (t: (k: string) => string, k: string) => string;
        declare const translatedString: string;
        declare const name: string;
        function f() {
          toast.success(t('Foo.bar'));
          toast.error(tKey(t, 'Errors.contractorNotFound'));
          toast.info(translatedString);
          toast.warning(\`Hello \${name}\`);
        }
        export {};
      `,
    );
    const { stdout } = runBiome(file);
    expect(countPluginDiagnostics(stdout)).toBe(0);
  });
});

describe('no-untranslated-trpc-error.grit', () => {
  it('flags literal `message` on `new TRPCError`', () => {
    const file = writeFixture(
      'reject-trpc.tsx',
      `
        declare class TRPCError {
          constructor(_: { code: string; message?: string });
        }
        function f() {
          throw new TRPCError({ code: 'NOT_FOUND', message: 'Contractor missing' });
        }
        export {};
      `,
    );
    const { stdout } = runBiome(file);
    expect(countPluginDiagnostics(stdout)).toBeGreaterThanOrEqual(1);
  });

  it('does not flag identifier-reference `message`', () => {
    const file = writeFixture(
      'allow-trpc.tsx',
      `
        declare class TRPCError {
          constructor(_: { code: string; message?: string });
        }
        const CONTRACTOR_NOT_FOUND = 'contractorNotFound';
        const E = { CONTRACTOR_NOT_FOUND };
        function f() {
          throw new TRPCError({ code: 'NOT_FOUND', message: CONTRACTOR_NOT_FOUND });
          throw new TRPCError({ code: 'NOT_FOUND', message: E.CONTRACTOR_NOT_FOUND });
        }
        export {};
      `,
    );
    const { stdout } = runBiome(file);
    expect(countPluginDiagnostics(stdout)).toBe(0);
  });
});

describe('no-untranslated-zod-message.grit', () => {
  it('flags literal `message` on Zod chain methods', () => {
    const file = writeFixture(
      'reject-zod.tsx',
      `
        declare const z: {
          string: () => {
            min: (n: number, o?: { message?: string }) => ReturnType<typeof z.string>;
            max: (n: number, o?: { message?: string }) => ReturnType<typeof z.string>;
            email: (o?: { message?: string }) => ReturnType<typeof z.string>;
            refine: (
              fn: (v: string) => boolean,
              o?: { message?: string },
            ) => ReturnType<typeof z.string>;
          };
        };
        function f() {
          z.string().min(1, { message: 'Required' });
          z.string().max(50, { message: "Too long" });
          z.string().email({ message: 'Bad email' });
          z.string().refine(v => v.length > 0, { message: 'Refine failed' });
        }
        export {};
      `,
    );
    const { stdout } = runBiome(file);
    expect(countPluginDiagnostics(stdout)).toBeGreaterThanOrEqual(3);
  });
});
