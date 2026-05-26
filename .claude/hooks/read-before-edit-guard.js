#!/usr/bin/env node
// read-before-edit-guard.js — PreToolUse: enforce Read before Edit/Write (all runtimes)
// Project hook — does NOT skip Claude Code (unlike gsd-read-guard.js).
// Advisory only: runtime still enforces; this prevents retry loops.

const fs = require('fs');
const path = require('path');

let input = '';
const stdinTimeout = setTimeout(() => process.exit(0), 3000);
process.stdin.setEncoding('utf8');
process.stdin.on('data', chunk => (input += chunk));
process.stdin.on('end', () => {
  clearTimeout(stdinTimeout);
  try {
    const data = JSON.parse(input);
    const toolName = data.tool_name;
    if (toolName !== 'Write' && toolName !== 'Edit') {
      process.exit(0);
    }

    const filePath = data.tool_input?.file_path || '';
    if (!filePath) {
      process.exit(0);
    }

    let fileExists = false;
    try {
      fs.accessSync(filePath, fs.constants.F_OK);
      fileExists = true;
    } catch {
      /* new file — no prior Read required */
    }

    if (!fileExists) {
      process.exit(0);
    }

    const fileName = path.basename(filePath);
    const output = {
      hookSpecificOutput: {
        hookEventName: 'PreToolUse',
        additionalContext:
          `MANDATORY READ-BEFORE-EDIT: "${fileName}" already exists. ` +
          'You MUST call the Read tool on this exact path in this session BEFORE Edit/Write. ' +
          'The runtime rejects edits to unread files — do NOT retry Edit without Read; Read first, then Edit.',
      },
    };

    process.stdout.write(JSON.stringify(output));
  } catch {
    process.exit(0);
  }
});
