/**
 * Linear status → workflow status smart-default mapping. Lifted from
 * apps/web/src/lib/linear-status-mapping.ts unchanged.
 */

interface LinearStateInput {
  name: string;
  type: string;
}

export function computeSmartDefaultMappings(states: LinearStateInput[]): Record<string, string> {
  const result: Record<string, string> = {};
  const used = new Set<string>();

  const nameKeywordMapping: Array<{ keywords: string[]; status: string }> = [
    { keywords: ['block'], status: 'BLOCKED' },
    { keywords: ['done', 'complete'], status: 'DONE' },
    { keywords: ['progress', 'review'], status: 'IN_PROGRESS' },
    { keywords: ['cancel'], status: 'CANCELLED' },
  ];

  for (const state of states) {
    const lower = state.name.toLowerCase();
    const match = nameKeywordMapping.find(m => m.keywords.some(kw => lower.includes(kw)));
    if (match && !used.has(match.status)) {
      used.add(match.status);
      result[match.status] = state.name;
    }
  }

  const typeMapping: Record<string, string> = {
    triage: 'TODO',
    backlog: 'TODO',
    unstarted: 'TODO',
    started: 'IN_PROGRESS',
    completed: 'DONE',
    cancelled: 'CANCELLED',
  };

  for (const state of states) {
    const workflowStatus = typeMapping[state.type];
    if (workflowStatus && !used.has(workflowStatus)) {
      used.add(workflowStatus);
      result[workflowStatus] = state.name;
    }
  }

  return result;
}
