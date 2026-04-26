import { cpSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const Dirname = dirname(fileURLToPath(import.meta.url));
const pkgRoot = join(Dirname, '..');
const srcDir = join(pkgRoot, 'src/profiles/zugferd-de/assets');
const destDir = join(pkgRoot, 'dist/profiles/zugferd-de/assets');

mkdirSync(dirname(destDir), { recursive: true });
cpSync(srcDir, destDir, { recursive: true });
