#!/usr/bin/env node
// no-bulk-script-guard.js — PreToolUse: advisory against ad-hoc bulk shell edits
// Suggests Task subagent + per-file Edit instead of sed/awk/python -e replace on sources.

const BULK_EDIT_PATTERNS = [
  /\bsed\s+.*\s-i\b/i,
  /\bsed\s+-i\b/i,
  /\bperl\s+-pi\b/i,
  /\bfind\b[^\n]*-exec\s+sed\b/i,
  /\bawk\b[^\n]*(?:>>?)\s*[^\s|]+/i,
  /\bpython3?\s+-(?:c|e)\b[^\n]*(?:\.replace\(|re\.sub|writeFile|open\s*\([^)]*['"]w)/i,
  /\bnode\s+-e\b[^\n]*(?:\.replace\(|writeFileSync|writeFile)/i,
];

const PROJECT_SCRIPT_PREFIX = /^\s*(?:pnpm|npm run|turbo|npx)\s+/i;

const READ_ONLY_GIT =
  /^\s*git\s+(?:status|diff|log|show|rev-parse|branch|symbolic-ref)\b/i;

const SOURCE_PATH =
  /(?:apps|packages|prisma)\/|\.planning\/|\.claude\/|\.cursor\//;

function getCommand(data) {
  const input = data.tool_input || {};
  return (
    input.command ||
    input.cmd ||
    (typeof input === "string" ? input : "") ||
    ""
  );
}

let input = "";
const stdinTimeout = setTimeout(() => process.exit(0), 3000);
process.stdin.setEncoding("utf8");
process.stdin.on("data", (chunk) => {
  input += chunk;
});
process.stdin.on("end", () => {
  clearTimeout(stdinTimeout);
  try {
    const data = JSON.parse(input);
    if (data.tool_name !== "Bash") {
      process.exit(0);
    }

    const command = getCommand(data);
    if (!command.trim()) {
      process.exit(0);
    }

    if (PROJECT_SCRIPT_PREFIX.test(command) || READ_ONLY_GIT.test(command)) {
      process.exit(0);
    }

    const hitsBulk = BULK_EDIT_PATTERNS.some((p) => p.test(command));
    if (!hitsBulk) {
      process.exit(0);
    }

    if (!SOURCE_PATH.test(command)) {
      process.exit(0);
    }

    const output = {
      hookSpecificOutput: {
        hookEventName: "PreToolUse",
        additionalContext:
          "BULK SHELL EDIT DETECTED (advisory): Prefer Task subagent + per-file Edit over sed/awk/perl/python -e/node -e replace on source files. " +
          "Routing: cavecrew-investigator (locate) → cavecrew-builder (≤2 files) or parallel builders per file. " +
          "Allowed: pnpm/npm run/turbo project scripts, read-only git, user-approved repo codemods. See .claude/skills/cavecrew/SKILL.md.",
      },
    };

    process.stdout.write(JSON.stringify(output));
  } catch {
    process.exit(0);
  }
});
