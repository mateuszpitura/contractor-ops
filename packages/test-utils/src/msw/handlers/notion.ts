import { HttpResponse, http } from 'msw';
import type { HandlerOptions } from '../types.js';
import { applyNetworkConditions, mockId } from '../utils.js';

export function notionHandlers(options?: HandlerOptions) {
  const net = options?.network;

  return [
    // --- OAuth Token Exchange ---
    http.post('https://api.notion.com/v1/oauth/token', async () => {
      const err = await applyNetworkConditions(net);
      if (err) return err;
      return HttpResponse.json({
        access_token: `ntn_mock_${mockId()}`,
        token_type: 'bearer',
        bot_id: mockId(),
        workspace_id: mockId(),
        workspace_name: 'Test Workspace',
        workspace_icon: null,
        duplicated_template_id: null,
        owner: { type: 'workspace', workspace: true },
      });
    }),

    // --- Search Pages ---
    http.post('https://api.notion.com/v1/search', async () => {
      const err = await applyNetworkConditions(net);
      if (err) return err;
      return HttpResponse.json({
        object: 'list',
        results: [
          {
            id: mockId(),
            object: 'page',
            created_time: new Date().toISOString(),
            last_edited_time: new Date().toISOString(),
            icon: { type: 'emoji', emoji: '📄' },
            parent: { type: 'workspace', workspace: true },
            url: 'https://www.notion.so/Test-Page-abc123',
            properties: {
              title: {
                id: 'title',
                type: 'title',
                title: [{ type: 'text', plain_text: 'Test Page' }],
              },
            },
          },
        ],
        has_more: false,
        next_cursor: null,
      });
    }),
  ];
}
