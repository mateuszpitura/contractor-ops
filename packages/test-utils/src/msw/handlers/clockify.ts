import { HttpResponse, http } from "msw";
import type { HandlerOptions } from "../types.js";
import { applyNetworkConditions, mockId, pastDate } from "../utils.js";

const REGIONS = [
  "https://api.clockify.me/api/v1",
  "https://euc1.clockify.me/api/v1",
  "https://use2.clockify.me/api/v1",
  "https://euw2.clockify.me/api/v1",
  "https://apse2.clockify.me/api/v1",
];

function forAllRegions(
  method: "get" | "post",
  path: string,
  handler: Parameters<typeof http.get>[1],
) {
  return REGIONS.map((base) => http[method](`${base}${path}`, handler));
}

export function clockifyHandlers(options?: HandlerOptions) {
  const net = options?.network;

  return [
    // --- Get User ---
    ...forAllRegions("get", "/user", async () => {
      const err = await applyNetworkConditions(net);
      if (err) return err;
      return HttpResponse.json({
        id: "user-001",
        email: "contractor@example.com",
        name: "Test Contractor",
        activeWorkspace: "ws-001",
      });
    }),

    // --- Get Time Entries ---
    ...forAllRegions("get", "/workspaces/:workspaceId/user/:userId/time-entries", async () => {
      const err = await applyNetworkConditions(net);
      if (err) return err;
      return HttpResponse.json([
        {
          id: mockId(),
          description: "Development work",
          timeInterval: {
            start: pastDate(8),
            end: pastDate(4),
            duration: "PT4H0M0S",
          },
          projectId: "proj-001",
          project: { name: "Test Project" },
          taskId: null,
          billable: true,
          userId: "user-001",
          workspaceId: "ws-001",
        },
        {
          id: mockId(),
          description: "Code review",
          timeInterval: {
            start: pastDate(3),
            end: pastDate(2),
            duration: "PT1H0M0S",
          },
          projectId: "proj-001",
          project: { name: "Test Project" },
          taskId: null,
          billable: true,
          userId: "user-001",
          workspaceId: "ws-001",
        },
      ]);
    }),

    // --- Get Projects ---
    ...forAllRegions("get", "/workspaces/:workspaceId/projects", async () => {
      const err = await applyNetworkConditions(net);
      if (err) return err;
      return HttpResponse.json([
        {
          id: "proj-001",
          name: "Test Project",
          clientId: "client-001",
          billable: true,
          color: "#2196F3",
        },
      ]);
    }),
  ];
}
