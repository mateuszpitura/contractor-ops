// UI workflow — opt-in: [ui] = fix/tweak (advise after edit); [ui-strict] = new UI (block before edit).
const fs = require('fs');
const path = require('path');

const STATE_DIR = path.join(
  process.env.CLAUDE_PROJECT_DIR || process.cwd(),
  '.claude/hooks/.state',
);

const UI_STRICT = /(?:^|\s)(?:\/ui-workflow-strict|\[ui-strict\])/i;
const UI_FIX = /(?:^|\s)(?:\/ui-workflow|\[ui\])/i;
const UI_OPT_OUT = /(?:^|\s)\/ui-workflow-off\b/i;

const FRONTEND_DESIGN_SKILL_RE =
  /frontend-design[/\\].*[/\\]frontend-design[/\\]SKILL\.md$/i;
const FRONTEND_DESIGN_SKILL_NAME_RE = /^frontend-design$/i;

function sessionId(data) {
  if (typeof data?.session_id === 'string' && data.session_id.length > 0) {
    return data.session_id;
  }
  if (process.env.CLAUDE_SESSION_ID) {
    return process.env.CLAUDE_SESSION_ID;
  }
  return 'default';
}

function statePath(id) {
  return path.join(STATE_DIR, `${id}.json`);
}

function loadState(id) {
  try {
    const raw = fs.readFileSync(statePath(id), 'utf8');
    return JSON.parse(raw);
  } catch {
    return {
      active: false,
      mode: null,
      semble: false,
      frontendDesign: false,
      designAdvised: false,
    };
  }
}

function saveState(id, patch) {
  fs.mkdirSync(STATE_DIR, { recursive: true });
  const next = { ...loadState(id), ...patch };
  fs.writeFileSync(statePath(id), JSON.stringify(next));
  return next;
}

/** @returns {'strict'|'fix'|false} */
function uiWorkflowMode(text) {
  if (typeof text !== 'string') return false;
  if (UI_OPT_OUT.test(text)) return false;
  if (UI_STRICT.test(text)) return 'strict';
  if (UI_FIX.test(text)) return 'fix';
  return false;
}

function isUiTargetPath(filePath) {
  const p = filePath.replace(/\\/g, '/');
  const inUiApp =
    p.includes('apps/web-vite/') ||
    p.includes('apps/landing/') ||
    p.includes('packages/ui/');
  return inUiApp && /\.(tsx|css)$/.test(p);
}

function fileExists(filePath) {
  try {
    fs.accessSync(filePath, fs.constants.F_OK);
    return true;
  } catch {
    return false;
  }
}

function isFrontendDesignSkillPath(filePath) {
  const p = String(filePath).replace(/\\/g, '/');
  return (
    FRONTEND_DESIGN_SKILL_RE.test(p) ||
    (/\/frontend-design\//i.test(p) && /SKILL\.md$/i.test(p))
  );
}

/** Read, Skill tool, or plugin invoke — Claude rarely uses Read on cache path. */
function isFrontendDesignSkillEvent(data) {
  const toolName = String(data.tool_name || '').toLowerCase();
  const input = data.tool_input || {};

  for (const raw of [
    input.file_path,
    input.path,
    data.tool_response?.file_path,
  ]) {
    if (raw && isFrontendDesignSkillPath(raw)) return true;
  }

  if (toolName === 'skill' || toolName === 'skills' || toolName === 'invokeskill') {
    for (const key of ['skill', 'name', 'skill_name', 'skillName']) {
      const v = input[key];
      if (typeof v === 'string' && FRONTEND_DESIGN_SKILL_NAME_RE.test(v.trim())) {
        return true;
      }
    }
  }

  try {
    const blob = JSON.stringify(input);
    if (
      FRONTEND_DESIGN_SKILL_NAME_RE.test(
        String(input.skill || input.name || input.skill_name || '').trim(),
      ) ||
      (/\/frontend-design\//i.test(blob) && /SKILL\.md/i.test(blob))
    ) {
      return true;
    }
  } catch {
    /* ignore */
  }

  return false;
}

function isSembleDiscovery(cmd) {
  if (typeof cmd !== 'string') return false;
  return /\bsemble\s+search\b/.test(cmd) || /\buvx\b[^\n]*\bsemble\b[^\n]*\bsearch\b/.test(cmd);
}

function isSembleToolEvent(data) {
  const toolName = String(data.tool_name || '').toLowerCase();
  if (toolName === 'bash') {
    return isSembleDiscovery(data.tool_input?.command || '');
  }
  if (/semble/i.test(toolName)) return true;
  const input = data.tool_input || {};
  if (
    /semble/i.test(String(input.server || '')) &&
    /search/i.test(String(input.toolName || input.tool_name || ''))
  ) {
    return true;
  }
  try {
    const blob = JSON.stringify(input);
    if (/\bsemble\s+search\b/i.test(blob)) return true;
  } catch {
    /* ignore */
  }
  return false;
}

function blockPayload(code, reason) {
  return JSON.stringify({ decision: 'block', code, reason });
}

module.exports = {
  STATE_DIR,
  sessionId,
  loadState,
  saveState,
  uiWorkflowMode,
  isUiTargetPath,
  fileExists,
  isFrontendDesignSkillPath,
  isFrontendDesignSkillEvent,
  isSembleDiscovery,
  isSembleToolEvent,
  blockPayload,
  FRONTEND_DESIGN_SKILL_HINT:
    '~/.claude/plugins/cache/claude-plugins-official/frontend-design/unknown/skills/frontend-design/SKILL.md',
};
