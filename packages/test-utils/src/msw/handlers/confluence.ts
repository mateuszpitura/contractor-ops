import { HttpResponse, http } from "msw";
import type { HandlerOptions } from "../types.js";
import { applyNetworkConditions, mockId } from "../utils.js";

export function confluenceHandlers(options?: HandlerOptions) {
  const net = options?.network;

  return [
    // --- Atlassian OAuth (shared with Jira, but needed when confluence used standalone) ---
    http.post("https://auth.atlassian.com/oauth/token", async () => {
      const err = await applyNetworkConditions(net);
      if (err) return err;
      return HttpResponse.json({
        access_token: `atlassian_mock_${mockId()}`,
        refresh_token: `atlassian_refresh_${mockId()}`,
        expires_in: 3600,
        token_type: "Bearer",
        scope: "read:confluence-content.summary search:confluence offline_access",
      });
    }),

    // --- Cloud ID Discovery ---
    http.get("https://api.atlassian.com/oauth/token/accessible-resources", async () => {
      const err = await applyNetworkConditions(net);
      if (err) return err;
      return HttpResponse.json([
        {
          id: "cloud-id-mock-001",
          name: "Test Workspace",
          url: "https://test-workspace.atlassian.net",
          scopes: ["read:confluence-content.summary", "search:confluence"],
        },
      ]);
    }),

    // --- Search Pages ---
    http.get("https://api.atlassian.com/ex/confluence/:cloudId/wiki/rest/api/search", async () => {
      const err = await applyNetworkConditions(net);
      if (err) return err;
      return HttpResponse.json({
        results: [
          {
            content: {
              id: mockId(),
              title: "Test Page",
              type: "page",
              _links: { webui: "/wiki/spaces/TEST/pages/12345" },
            },
            resultGlobalContainer: {
              title: "Test Space",
              displayUrl: "/wiki/spaces/TEST",
            },
            excerpt: "This is a test page excerpt",
          },
        ],
        totalSize: 1,
        _links: {
          base: "https://test-workspace.atlassian.net/wiki",
        },
      });
    }),

    // --- Get Page ---
    http.get(
      "https://api.atlassian.com/ex/confluence/:cloudId/wiki/rest/api/content/:pageId",
      async ({ params }) => {
        const err = await applyNetworkConditions(net);
        if (err) return err;
        return HttpResponse.json({
          id: params.pageId,
          title: "Test Page",
          type: "page",
          body: {
            storage: {
              value: "<p>Test content</p>",
              representation: "storage",
            },
          },
          _links: {
            webui: `/wiki/spaces/TEST/pages/${params.pageId}`,
          },
        });
      },
    ),
  ];
}
