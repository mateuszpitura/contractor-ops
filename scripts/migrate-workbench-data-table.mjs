#!/usr/bin/env node
/**
 * One-off codemod: migrate web-vite data-table.tsx files to WorkbenchDataTable.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const componentsDir = path.join(root, 'apps/web-vite/src/components');
const workbenchPath = path.join(componentsDir, 'table-kit/workbench-data-table.tsx');

function walk(dir, acc = []) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(full, acc);
    else if (entry.name === 'data-table.tsx') acc.push(full);
  }
  return acc;
}

function relativeImport(fromFile) {
  const fromDir = path.dirname(fromFile);
  let rel = path.relative(fromDir, workbenchPath).replace(/\\/g, '/');
  if (!rel.startsWith('.')) rel = `./${rel}`;
  return rel.replace(/\.tsx$/, '.js');
}

for (const file of walk(componentsDir)) {
  let content = fs.readFileSync(file, 'utf8');
  if (content.includes('WorkbenchDataTable')) {
    console.log(`skip ${path.relative(root, file)} (already migrated)`);
    continue;
  }
  if (!content.includes('DataTable')) {
    console.log(`skip ${path.relative(root, file)} (no DataTable)`);
    continue;
  }

  const importLine = `import { WorkbenchDataTable } from '${relativeImport(file)}';\n`;

  // Strip DataTable from @contractor-ops/ui imports
  content = content.replace(
    /import\s*\{([^}]+)\}\s*from\s*'@contractor-ops\/ui';/g,
    (_match, inner) => {
      const parts = inner
        .split(',')
        .map(s => s.trim())
        .filter(Boolean)
        .filter(p => p !== 'DataTable' && !p.startsWith('type DataTable'));
      if (parts.length === 0) return '';
      return `import { ${parts.join(', ')} } from '@contractor-ops/ui';`;
    },
  );

  content = content.replace(/<DataTable\b/g, '<WorkbenchDataTable');
  content = content.replace(/<\/DataTable>/g, '</WorkbenchDataTable>');

  const firstImport = content.match(/^import .+$/m);
  if (firstImport) {
    const idx = content.indexOf(firstImport[0]) + firstImport[0].length + 1;
    content = `${content.slice(0, idx)}${importLine}${content.slice(idx)}`;
  } else {
    content = importLine + content;
  }

  fs.writeFileSync(file, content);
  console.log(`migrated ${path.relative(root, file)}`);
}
