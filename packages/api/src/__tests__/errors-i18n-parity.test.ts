import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import * as ApiErrors from '../errors';

/**
 * Every string exported from errors.ts that looks like an API error code
 * must exist under `Errors` in both en and pl message files (string values only).
 */
describe('errors.ts vs i18n Errors namespace', () => {
  const root = join(dirname(fileURLToPath(import.meta.url)), '../../../../');
  const en = JSON.parse(readFileSync(join(root, 'apps/web/messages/en.json'), 'utf8')) as {
    Errors: Record<string, unknown>;
  };
  const pl = JSON.parse(readFileSync(join(root, 'apps/web/messages/pl.json'), 'utf8')) as {
    Errors: Record<string, unknown>;
  };

  const errorCodeExports: string[] = [];
  for (const [, value] of Object.entries(ApiErrors)) {
    if (typeof value !== 'string') continue;
    if (!/^[a-z][a-zA-Z0-9]+$/.test(value)) continue;
    errorCodeExports.push(value);
  }

  /** Page-level error layouts (heading/body/cta) share keys with some API codes. */
  const isPageLayoutEntry = (value: unknown): boolean =>
    typeof value === 'object' && value !== null && 'heading' in value;

  it('has a matching string translation in en.json and pl.json for each code', () => {
    for (const code of errorCodeExports) {
      if (isPageLayoutEntry(en.Errors[code])) continue;
      expect(typeof en.Errors[code], `en.json Errors.${code} missing`).toBe('string');
      expect(typeof pl.Errors[code], `pl.json Errors.${code} missing`).toBe('string');
      expect((en.Errors[code] as string).length).toBeGreaterThan(0);
      expect((pl.Errors[code] as string).length).toBeGreaterThan(0);
    }
  });
});
