/**
 * Smart default mapping algorithm for Linear status -> workflow status.
 */

interface LinearStateInput {
  name: string;
  type: string;
}

/**
 * Compute smart default mappings from Linear states to workflow statuses.
 *
 * Pass 1: Match by name keywords (block, done/complete, progress/review, cancel).
 * Pass 2: Fall back to state.type mapping for unmapped statuses.
 *
 * Returns a record of workflowStatus -> linearStateName for matched statuses.
 */
export function computeSmartDefaultMappings(states: LinearStateInput[]): Record<string, string> {
  const result: Record<string, string> = {};
  const used = new Set<string>();

  // Pass 1: match by name keywords
  for (const state of states) {
    const lower = state.name.toLowerCase();
    let workflowStatus: string | null = null;

    if (lower.includes("block")) {
      workflowStatus = "BLOCKED";
    } else if (lower.includes("done") || lower.includes("complete")) {
      workflowStatus = "DONE";
    } else if (lower.includes("progress") || lower.includes("review")) {
      workflowStatus = "IN_PROGRESS";
    } else if (lower.includes("cancel")) {
      workflowStatus = "CANCELLED";
    }

    if (workflowStatus && !used.has(workflowStatus)) {
      used.add(workflowStatus);
      result[workflowStatus] = state.name;
    }
  }

  // Pass 2: fall back to state.type mapping for unmapped workflow statuses
  const typeMapping: Record<string, string> = {
    triage: "TODO",
    backlog: "TODO",
    unstarted: "TODO",
    started: "IN_PROGRESS",
    completed: "DONE",
    cancelled: "CANCELLED",
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
