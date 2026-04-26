#!/usr/bin/env node
/**
 * Converts top-level `const mockXxx = vi.fn()` declarations that are used
 * inside `vi.mock` factories into `vi.hoisted(() => {...})` blocks.
 *
 * vi.mock factories are hoisted above variable declarations, so referencing
 * a `const` mock inside a vi.mock factory causes "Cannot access before
 * initialization" errors. vi.hoisted() runs before vi.mock hoisting.
 */

import { readFileSync, writeFileSync } from 'node:fs';

const files = process.argv.slice(2);
if (files.length === 0) {
  console.error('Usage: node fix-hoisted-mocks.mjs <file1> <file2> ...');
  process.exit(1);
}

let _totalFixed = 0;

for (const file of files) {
  const content = readFileSync(file, 'utf-8');
  const lines = content.split('\n');

  // Step 1: Find all top-level const mockXxx = vi.fn() lines
  // Also handle: const mockXxx = vi.fn().mockResolvedValue(...) etc.
  // Also handle: const normalizeXxx = vi.fn()
  const mockDeclRegex = /^const\s+(\w+)\s*=\s*(vi\.fn\(.*)/;
  const mockDecls = [];
  const mockDeclLines = new Set();

  for (let i = 0; i < lines.length; i++) {
    const match = lines[i].match(mockDeclRegex);
    if (match) {
      const varName = match[1];
      const initializer = match[2];
      // Only process if this variable is actually used inside a vi.mock factory
      // Check if the name appears in the file after a vi.mock( line
      mockDecls.push({ line: i, name: varName, initializer });
      mockDeclLines.add(i);
    }
  }

  if (mockDecls.length === 0) continue;

  // Step 2: Check if file already has vi.hoisted
  if (content.includes('vi.hoisted')) {
    // Already converted, skip
    continue;
  }

  // Step 3: Check if any mocks are used inside vi.mock factories
  // Find vi.mock blocks and check for references to mock variables
  const usedMocks = new Set();
  let insideMockFactory = false;
  let braceDepth = 0;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    if (line.match(/^vi\.mock\(/)) {
      insideMockFactory = true;
      braceDepth = 0;
    }

    if (insideMockFactory) {
      for (const ch of line) {
        if (ch === '(') braceDepth++;
        if (ch === ')') {
          braceDepth--;
          if (braceDepth <= 0) {
            insideMockFactory = false;
          }
        }
      }

      for (const decl of mockDecls) {
        if (line.includes(decl.name) && !mockDeclLines.has(i)) {
          usedMocks.add(decl.name);
        }
      }
    }
  }

  if (usedMocks.size === 0) continue;

  // Step 4: Build the vi.hoisted block
  const mocksToHoist = mockDecls.filter(d => usedMocks.has(d.name));

  if (mocksToHoist.length === 0) continue;

  // Build destructured hoisted block
  const hoistedEntries = mocksToHoist.map(d => {
    // Remove trailing semicolon from initializer
    const init = d.initializer.replace(/;?\s*$/, '');
    return `  ${d.name}: ${init},`;
  });

  const hoistedBlock = [
    `const {`,
    ...mocksToHoist.map(d => `  ${d.name},`),
    `} = vi.hoisted(() => ({`,
    ...hoistedEntries,
    `}));`,
  ].join('\n');

  // Step 5: Remove original declarations and insert hoisted block
  const newLines = [];
  let insertedHoisted = false;
  const linesToRemove = new Set(mocksToHoist.map(d => d.line));

  for (let i = 0; i < lines.length; i++) {
    if (linesToRemove.has(i)) {
      // If this is the first mock decl, insert hoisted block here
      if (!insertedHoisted) {
        newLines.push(hoistedBlock);
        insertedHoisted = true;
      }
      // Skip the original line
      // Also skip empty lines immediately after removed declarations
      continue;
    }
    newLines.push(lines[i]);
  }

  // Clean up: remove consecutive blank lines (more than 2)
  const cleanedLines = [];
  let consecutiveBlank = 0;
  for (const line of newLines) {
    if (line.trim() === '') {
      consecutiveBlank++;
      if (consecutiveBlank <= 2) {
        cleanedLines.push(line);
      }
    } else {
      consecutiveBlank = 0;
      cleanedLines.push(line);
    }
  }

  writeFileSync(file, cleanedLines.join('\n'));
  _totalFixed++;
}
