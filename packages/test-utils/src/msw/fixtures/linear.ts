import { mockId } from "../utils.js";

/** Factory for Linear-like objects with realistic shapes. */
export const linearFixtures = {
  issue: (overrides?: Record<string, unknown>) => ({
    id: mockId(),
    identifier: `ENG-${Math.floor(Math.random() * 9999)}`,
    title: "Test Linear Issue",
    description: "Issue description in markdown",
    state: { id: "state-todo", name: "Todo", type: "unstarted" },
    assignee: {
      id: "user-001",
      name: "Test User",
      email: "test@example.com",
    },
    team: { id: "team-001", name: "Engineering", key: "ENG" },
    project: null,
    labels: { nodes: [] },
    priority: 2,
    estimate: null,
    dueDate: null,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    ...overrides,
  }),

  /** Issue with all nullable fields set to null */
  issueMinimal: (overrides?: Record<string, unknown>) => ({
    id: mockId(),
    identifier: `ENG-${Math.floor(Math.random() * 9999)}`,
    title: "Minimal Issue",
    description: null,
    state: { id: "state-backlog", name: "Backlog", type: "backlog" },
    assignee: null,
    team: { id: "team-001", name: "Engineering", key: "ENG" },
    project: null,
    labels: { nodes: [] },
    priority: 0,
    estimate: null,
    dueDate: null,
    cycle: null,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    ...overrides,
  }),

  team: (overrides?: Record<string, unknown>) => ({
    id: "team-001",
    name: "Engineering",
    key: "ENG",
    states: {
      nodes: [
        { id: "state-backlog", name: "Backlog", type: "backlog", color: "#bec2c8", position: 0 },
        { id: "state-todo", name: "Todo", type: "unstarted", color: "#e2e2e2", position: 1 },
        {
          id: "state-progress",
          name: "In Progress",
          type: "started",
          color: "#f2c94c",
          position: 2,
        },
        { id: "state-done", name: "Done", type: "completed", color: "#5e6ad2", position: 3 },
        {
          id: "state-cancelled",
          name: "Cancelled",
          type: "canceled",
          color: "#95a2b3",
          position: 4,
        },
      ],
    },
    ...overrides,
  }),
};
