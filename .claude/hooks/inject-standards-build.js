#!/usr/bin/env node
/**
 * Build hook additionalContext for SessionStart (full) or SubagentStart (floor).
 * Env: INJECT_BODY, INJECT_CLAUDE_MD, INJECT_CAVEMAN_SKILL, INJECT_HOOK_INPUT,
 *      INJECT_PROFILE=full|subagent, INJECT_HOOK_EVENT=SessionStart|SubagentStart
 */
const fs = require("fs");

const profile = process.env.INJECT_PROFILE || "full";
const hookEvent = process.env.INJECT_HOOK_EVENT || "SessionStart";

let source = "startup";
try {
  const input = JSON.parse(process.env.INJECT_HOOK_INPUT || "{}");
  if (input.source) source = input.source;
} catch {
  /* ignore */
}

function stripFrontmatter(text) {
  if (!text.startsWith("---")) return text;
  const end = text.indexOf("\n---", 3);
  if (end === -1) return text;
  return text.slice(end + 4).replace(/^\n/, "");
}

const isSubagent = profile === "subagent";

const loadNotesFull = {
  startup:
    "CLAUDE.md is injected below at session start. It is in your context — you do not need the Read tool for it on this turn.",
  resume:
    "CLAUDE.md is re-injected on resume. It is in your context — no Read tool needed unless this block is missing.",
  clear:
    "CLAUDE.md is re-injected after /clear. It is in your context again — do NOT tell the user to Read CLAUDE.md unless this block is absent.",
  compact:
    "CLAUDE.md is re-injected after context compaction. It is in your context again — do NOT tell the user to Read CLAUDE.md unless this block is absent.",
};

const subagentNote =
  "Subagent floor standards injected. For full rules use Read on ./CLAUDE.md before multi-file implementation. Caveman full mode applies to parent session — stay terse unless code/commit/PR text.";

const preamble = isSubagent
  ? `## BINDING PROJECT STANDARDS (subagent — mandatory)
Violating these rules requires stopping, stating the violation, and correcting before continuing.

SubagentStart. ${subagentNote}

The binding bullets below are a floor.

`
  : `## BINDING PROJECT STANDARDS (mandatory)
Violating these rules requires stopping, stating the violation, and correcting before continuing.
These override default model habits and generic training patterns when they conflict.

${hookEvent} source: ${source}. ${loadNotesFull[source] || loadNotesFull.startup}

The binding bullets below are a floor. The complete project standards follow in the CLAUDE.md section — apply all of it.

`;

let cavemanSection = "";
const cavemanPath = process.env.INJECT_CAVEMAN_SKILL || "";
if (!isSubagent && cavemanPath && fs.existsSync(cavemanPath)) {
  const skillBody = stripFrontmatter(fs.readFileSync(cavemanPath, "utf8"));
  cavemanSection =
    `## CAVEMAN MODE — ACTIVE (mandatory at session start; equals /caveman full)\n` +
    `Your FIRST response this session MUST use caveman style. Stay in caveman every turn until user says "stop caveman" or "normal mode".\n\n` +
    skillBody +
    `\n\n---\n\n`;
} else if (isSubagent) {
  cavemanSection =
    `## CAVEMAN (subagent)\nParent session uses caveman full — keep responses terse; code/commits stay normal.\n\n---\n\n`;
}

const body = process.env.INJECT_BODY || "";
const claudePath = process.env.INJECT_CLAUDE_MD || "";

let claudeSection = "";
if (!isSubagent && claudePath && fs.existsSync(claudePath)) {
  const claudeContent = fs.readFileSync(claudePath, "utf8");
  claudeSection =
    `\n\n---\n\n## PROJECT STANDARDS — CLAUDE.md (injected via ${hookEvent}; source=${source})\n\n` +
    claudeContent;
}

const additionalContext = cavemanSection + preamble + body + claudeSection;

process.stdout.write(
  JSON.stringify({
    hookSpecificOutput: {
      hookEventName: hookEvent,
      additionalContext,
      core_values_present: true,
      claude_md_injected: claudeSection.length > 0,
      caveman_injected: cavemanSection.length > 0,
      inject_profile: profile,
      session_start_source: source,
    },
  }),
);
