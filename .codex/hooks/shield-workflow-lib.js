// Business-logic shield — opt-in: [shield] = skill + scope before logic edits; [shield-strict] = also before Grep/Glob.
const fs = require('fs');
const path = require('path');

const STATE_DIR = path.join(
  process.env.CLAUDE_PROJECT_DIR || process.cwd(),
  '.claude/hooks/.state',
);

const SHIELD_SCOPE_BASENAME = 'shield-scope.json';

const SHIELD_STRICT = /(?:^|\s)(?:\/shield-strict|\[shield-strict\])/i;
const SHIELD_ON = /(?:^|\s)(?:\/shield(?:-workflow)?|\[shield\])/i;
const SHIELD_OPT_OUT = /(?:^|\s)\/shield-workflow-off\b/i;

const SHIELD_SKILL_DIR_RE = /business-logic-shield[/\\]/i;
const SHIELD_SKILL_NAME_RE = /^business-logic-shield$/i;

function sessionId(data) {
  if (typeof data?.session_id === 'string' && data.session_id.length > 0) {
    return data.session_id;
  }
  if (process.env.CLAUDE_SESSION_ID) {
    return process.env.CLAUDE_SESSION_ID;
  }
  return 'default';
}

function shieldStatePath(id) {
  return path.join(STATE_DIR, `shield-${id}.json`);
}

function shieldScopeFilePath() {
  return path.join(STATE_DIR, SHIELD_SCOPE_BASENAME);
}

function loadState(id) {
  try {
    const raw = fs.readFileSync(shieldStatePath(id), 'utf8');
    return JSON.parse(raw);
  } catch {
    return {
      active: false,
      mode: null,
      shieldSkillRead: false,
      shieldScope: false,
    };
  }
}

function saveState(id, patch) {
  fs.mkdirSync(STATE_DIR, { recursive: true });
  const next = { ...loadState(id), ...patch };
  fs.writeFileSync(shieldStatePath(id), JSON.stringify(next));
  return next;
}

/** @returns {'strict'|'shield'|false} */
function shieldWorkflowMode(text) {
  if (typeof text !== 'string') return false;
  if (SHIELD_OPT_OUT.test(text)) return false;
  if (SHIELD_STRICT.test(text)) return 'strict';
  if (SHIELD_ON.test(text)) return 'shield';
  return false;
}

function isShieldTargetPath(filePath) {
  const p = String(filePath).replace(/\\/g, '/');
  if (!p || p.includes('.claude/hooks/.state/')) return false;
  if (p.includes('.planning/brain/wiki/')) return false;

  const logicRoots = [
    'packages/api/',
    'apps/api/',
    'apps/cron-worker/',
    'apps/public-api/',
    'packages/einvoice/',
    'packages/classification/',
    'packages/compliance-policy/',
    'packages/payroll/',
    'packages/validators/',
    'packages/db/scripts/',
  ];

  const inLogic =
    logicRoots.some((root) => p.includes(root)) ||
    (p.includes('apps/web-vite/') &&
      (p.includes('/hooks/use-') ||
        p.includes('/components/') && /use-[a-z0-9-]+\.(ts|tsx)$/.test(p)));

  if (!inLogic) return false;

  return /\.(ts|tsx|js|mjs|cjs|sql|prisma)$/.test(p);
}

function isShieldScopePath(filePath) {
  if (!filePath) return false;
  const normalized = path.resolve(String(filePath));
  const expected = path.resolve(shieldScopeFilePath());
  return normalized === expected;
}

function isShieldSkillPath(filePath) {
  const p = String(filePath).replace(/\\/g, '/');
  return SHIELD_SKILL_DIR_RE.test(p) && /SKILL\.md$|patterns\.md$|seams-registry\.md$/i.test(p);
}

function isShieldSkillEvent(data) {
  const toolName = String(data.tool_name || '').toLowerCase();
  const input = data.tool_input || {};

  for (const raw of [input.file_path, input.path, data.tool_response?.file_path]) {
    if (raw && isShieldSkillPath(raw)) return true;
  }

  if (toolName === 'skill' || toolName === 'skills' || toolName === 'invokeskill') {
    for (const key of ['skill', 'name', 'skill_name', 'skillName']) {
      const v = input[key];
      if (typeof v === 'string' && SHIELD_SKILL_NAME_RE.test(v.trim())) {
        return true;
      }
    }
  }

  try {
    const blob = JSON.stringify(input);
    if (
      SHIELD_SKILL_NAME_RE.test(
        String(input.skill || input.name || input.skill_name || '').trim(),
      ) ||
      (SHIELD_SKILL_DIR_RE.test(blob) && /SKILL\.md/i.test(blob))
    ) {
      return true;
    }
  } catch {
    /* ignore */
  }

  return false;
}

function parseScopePayload(toolInput, toolName) {
  let text = '';
  if (toolName === 'Write') {
    text = toolInput.content || toolInput.contents || '';
  } else if (toolName === 'Edit') {
    text = toolInput.new_string || toolInput.newString || '';
  }
  if (typeof text !== 'string' || text.trim().length === 0) return null;
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}

function isValidScopeObject(obj) {
  if (!obj || typeof obj !== 'object') return false;
  if (typeof obj.flow !== 'string' || obj.flow.trim().length < 3) return false;
  const hasSurfaces =
    typeof obj.surfaces === 'string' ||
    (Array.isArray(obj.surfaces) && obj.surfaces.length > 0);
  const hasPatterns =
    typeof obj.patternsAtRisk === 'string' ||
    (Array.isArray(obj.patternsAtRisk) && obj.patternsAtRisk.length > 0);
  return hasSurfaces && hasPatterns;
}

function isShieldScopeWriteEvent(data) {
  const toolName = data.tool_name;
  if (toolName !== 'Write' && toolName !== 'Edit') return false;
  const filePath = data.tool_input?.file_path || '';
  if (!isShieldScopePath(filePath)) return false;
  const payload = parseScopePayload(data.tool_input || {}, toolName);
  return isValidScopeObject(payload);
}

function blockPayload(code, reason) {
  return JSON.stringify({ decision: 'block', code, reason });
}

module.exports = {
  STATE_DIR,
  SHIELD_SCOPE_BASENAME,
  sessionId,
  loadState,
  saveState,
  shieldWorkflowMode,
  isShieldTargetPath,
  isShieldScopePath,
  isShieldSkillPath,
  isShieldSkillEvent,
  isShieldScopeWriteEvent,
  shieldScopeFilePath,
  SHIELD_SKILL_HINT: '.claude/skills/business-logic-shield/SKILL.md',
  SHIELD_SCOPE_HINT: '.claude/hooks/.state/shield-scope.json',
};
