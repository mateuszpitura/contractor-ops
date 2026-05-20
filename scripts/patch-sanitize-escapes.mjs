import { readFileSync, writeFileSync } from 'node:fs';

const paths = ['apps/landing/src/lib/sanitize-href.ts'];

for (const p of paths) {
  const s = readFileSync(p, 'utf8');
  const oldChunk = `raw.replace(/[ -]/g, '').trim();`;
  const newChunk = `raw.replace(/[\\u0000-\\u001f\\u007f]/g, '').trim();`;
  if (!s.includes(oldChunk)) {
    console.error(`expected literal not found in ${p}`);
    process.exit(1);
  }
  writeFileSync(p, s.replace(oldChunk, newChunk));
  console.log(`patched ${p}`);
}
