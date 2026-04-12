import { HttpResponse, http } from 'msw';
import type { HandlerOptions } from '../types.js';
import { applyNetworkConditions, mockId } from '../utils.js';

const API_BASE = 'https://api.autenti.com/api/v2';

export function autentiHandlers(options?: HandlerOptions) {
  const net = options?.network;

  return [
    // --- OAuth Token Exchange ---
    http.post(`${API_BASE}/auth/token`, async () => {
      const err = await applyNetworkConditions(net);
      if (err) return err;
      return HttpResponse.json({
        access_token: `autenti_mock_${mockId()}`,
        refresh_token: `autenti_refresh_${mockId()}`,
        expires_in: 3600,
        token_type: 'Bearer',
      });
    }),

    // --- Create Document Process ---
    http.post(`${API_BASE}/document-processes`, async () => {
      const err = await applyNetworkConditions(net);
      if (err) return err;
      const processId = mockId();
      return HttpResponse.json({
        id: processId,
        title: 'Test Contract',
        status: 'DRAFT',
        createdAt: new Date().toISOString(),
      });
    }),

    // --- Upload Document File ---
    http.post(`${API_BASE}/document-processes/:processId/files`, async () => {
      const err = await applyNetworkConditions(net);
      if (err) return err;
      return HttpResponse.json({
        id: mockId(),
        fileName: 'contract.pdf',
        filePurpose: 'ORIGINAL',
        mimeType: 'application/pdf',
      });
    }),

    // --- Add Participant ---
    http.post(`${API_BASE}/document-processes/:processId/participants`, async () => {
      const err = await applyNetworkConditions(net);
      if (err) return err;
      return HttpResponse.json({
        id: mockId(),
        role: 'signer',
        party: {
          firstName: 'Test',
          lastName: 'Contractor',
          email: 'contractor@example.com',
        },
      });
    }),

    // --- Send Process (action) ---
    http.post(`${API_BASE}/document-processes/:processId/actions`, async () => {
      const err = await applyNetworkConditions(net);
      if (err) return err;
      return new HttpResponse(null, { status: 202 });
    }),

    // --- Get Process Status ---
    http.get(`${API_BASE}/document-processes/:processId`, async ({ params }) => {
      const err = await applyNetworkConditions(net);
      if (err) return err;
      return HttpResponse.json({
        id: params.processId,
        title: 'Test Contract',
        status: 'COMPLETED',
        createdAt: new Date().toISOString(),
        completedAt: new Date().toISOString(),
        participants: [
          {
            id: mockId(),
            role: 'signer',
            party: {
              firstName: 'Test',
              lastName: 'Contractor',
              email: 'contractor@example.com',
            },
            status: 'SIGNED',
          },
        ],
      });
    }),

    // --- Get Signed Files ---
    http.get(`${API_BASE}/document-processes/:processId/files`, async () => {
      const err = await applyNetworkConditions(net);
      if (err) return err;
      return HttpResponse.json([
        {
          id: 'signed-file-001',
          fileName: 'contract-signed.pdf',
          filePurpose: 'SIGNED',
          mimeType: 'application/pdf',
        },
      ]);
    }),

    // --- Download File ---
    http.get(`${API_BASE}/document-processes/:processId/files/:fileId/content`, async () => {
      const err = await applyNetworkConditions(net);
      if (err) return err;
      return new HttpResponse(new Uint8Array([37, 80, 68, 70]), {
        headers: { 'Content-Type': 'application/pdf' },
      });
    }),
  ];
}
