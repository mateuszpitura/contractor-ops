import { HttpResponse, http } from "msw";
import type { HandlerOptions } from "../types.js";
import { applyNetworkConditions, futureDate, mockId } from "../utils.js";

export function docusignHandlers(options?: HandlerOptions) {
  const net = options?.network;

  return [
    // --- OAuth Token Exchange ---
    http.post("https://account-d.docusign.com/oauth/token", async () => {
      const err = await applyNetworkConditions(net);
      if (err) return err;
      return HttpResponse.json({
        access_token: `docusign_mock_${mockId()}`,
        refresh_token: `docusign_refresh_${mockId()}`,
        expires_in: 28800,
        token_type: "Bearer",
      });
    }),

    // --- User Info (for account discovery) ---
    http.get("https://account-d.docusign.com/oauth/userinfo", async () => {
      const err = await applyNetworkConditions(net);
      if (err) return err;
      return HttpResponse.json({
        sub: mockId(),
        accounts: [
          {
            account_id: "acct-mock-001",
            is_default: true,
            account_name: "Test Account",
            base_uri: "https://demo.docusign.net",
          },
        ],
      });
    }),

    // --- Create Envelope ---
    http.post("https://demo.docusign.net/restapi/v2.1/accounts/:accountId/envelopes", async () => {
      const err = await applyNetworkConditions(net);
      if (err) return err;
      const envelopeId = mockId();
      return HttpResponse.json({
        envelopeId,
        uri: `/envelopes/${envelopeId}`,
        statusDateTime: new Date().toISOString(),
        status: "sent",
      });
    }),

    // --- Get Envelope ---
    http.get(
      "https://demo.docusign.net/restapi/v2.1/accounts/:accountId/envelopes/:envelopeId",
      async ({ params }) => {
        const err = await applyNetworkConditions(net);
        if (err) return err;
        return HttpResponse.json({
          envelopeId: params.envelopeId,
          status: "completed",
          emailSubject: "Please sign: Test Contract",
          sentDateTime: new Date().toISOString(),
          completedDateTime: new Date().toISOString(),
          expirationDateTime: futureDate(72),
        });
      },
    ),

    // --- Get Recipient View (signing URL) ---
    http.post(
      "https://demo.docusign.net/restapi/v2.1/accounts/:accountId/envelopes/:envelopeId/views/recipient",
      async () => {
        const err = await applyNetworkConditions(net);
        if (err) return err;
        return HttpResponse.json({
          url: `https://demo.docusign.net/Signing/MTRedeem/?slt=mock_token_${mockId().slice(0, 8)}`,
        });
      },
    ),

    // --- Get Document ---
    http.get(
      "https://demo.docusign.net/restapi/v2.1/accounts/:accountId/envelopes/:envelopeId/documents/:documentId",
      async () => {
        const err = await applyNetworkConditions(net);
        if (err) return err;
        return new HttpResponse(new Uint8Array([37, 80, 68, 70]), {
          headers: { "Content-Type": "application/pdf" },
        });
      },
    ),

    // --- List Recipients ---
    http.get(
      "https://demo.docusign.net/restapi/v2.1/accounts/:accountId/envelopes/:envelopeId/recipients",
      async () => {
        const err = await applyNetworkConditions(net);
        if (err) return err;
        return HttpResponse.json({
          signers: [
            {
              recipientId: "1",
              email: "contractor@example.com",
              name: "Test Contractor",
              status: "completed",
              signedDateTime: new Date().toISOString(),
              clientUserId: "signer-001",
            },
          ],
        });
      },
    ),

    // --- Update Recipients (resend to signer) ---
    http.put(
      "https://demo.docusign.net/restapi/v2.1/accounts/:accountId/envelopes/:envelopeId/recipients",
      async () => {
        const err = await applyNetworkConditions(net);
        if (err) return err;
        return HttpResponse.json({
          recipientUpdateResults: [
            {
              recipientId: "1",
              errorDetails: null,
            },
          ],
        });
      },
    ),

    // --- Void Envelope ---
    http.put(
      "https://demo.docusign.net/restapi/v2.1/accounts/:accountId/envelopes/:envelopeId",
      async ({ params }) => {
        const err = await applyNetworkConditions(net);
        if (err) return err;
        return HttpResponse.json({
          envelopeId: params.envelopeId,
          status: "voided",
        });
      },
    ),
  ];
}
