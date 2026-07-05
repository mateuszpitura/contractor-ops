import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

import { SymfoniaProfile } from '../profiles/symfonia/index.js';
import { plFeed } from './fixtures/feeds.js';

const BOM = Buffer.from([0xef, 0xbb, 0xbf]);
const golden = (name: string) =>
  readFileSync(new URL(`./fixtures/${name}`, import.meta.url), 'utf8');

describe('SymfoniaProfile', () => {
  it('registers under profileId "symfonia" gated by payroll.symfonia', () => {
    expect(SymfoniaProfile.profileId).toBe('symfonia');
    expect(SymfoniaProfile.country).toBe('PL');
    expect(SymfoniaProfile.flagKey).toBe('payroll.symfonia');
  });

  it('generate({ format: csv }) == golden CSV with a UTF-8 BOM', async () => {
    const result = await SymfoniaProfile.generate(plFeed, { format: 'csv' });
    expect(result.ext).toBe('csv');
    expect(result.mime).toBe('text/csv');
    expect(result.buffer.subarray(0, 3)).toEqual(BOM);
    expect(result.buffer.subarray(3).toString('utf8')).toBe(golden('symfonia.golden.csv'));
  });

  it('generate({ format: xml }) == golden XML (escapeXml-safe)', async () => {
    const result = await SymfoniaProfile.generate(plFeed, { format: 'xml' });
    expect(result.ext).toBe('xml');
    expect(result.mime).toBe('application/xml');
    expect(result.buffer.toString('utf8')).toBe(golden('symfonia.golden.xml'));
  });
});
