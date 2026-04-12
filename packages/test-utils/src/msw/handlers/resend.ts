import { HttpResponse, http } from "msw";
import type { HandlerOptions } from "../types.js";
import { applyNetworkConditions, mockId } from "../utils.js";

export function resendHandlers(options?: HandlerOptions) {
  const net = options?.network;

  return [
    // --- Send Email ---
    http.post("https://api.resend.com/emails", async () => {
      const err = await applyNetworkConditions(net);
      if (err) return err;
      return HttpResponse.json({
        id: mockId(),
        from: "noreply@contractorhub.io",
        to: ["contractor@example.com"],
        created_at: new Date().toISOString(),
      });
    }),

    // --- Send Batch Emails ---
    http.post("https://api.resend.com/emails/batch", async () => {
      const err = await applyNetworkConditions(net);
      if (err) return err;
      return HttpResponse.json({
        data: [{ id: mockId() }, { id: mockId() }],
      });
    }),

    // --- Get Email ---
    http.get("https://api.resend.com/emails/:id", async ({ params }) => {
      const err = await applyNetworkConditions(net);
      if (err) return err;
      return HttpResponse.json({
        id: params.id,
        from: "noreply@contractorhub.io",
        to: ["contractor@example.com"],
        subject: "Test Email",
        created_at: new Date().toISOString(),
        last_event: "delivered",
      });
    }),
  ];
}
