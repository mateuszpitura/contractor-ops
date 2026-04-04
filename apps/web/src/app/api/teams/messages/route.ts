// ---------------------------------------------------------------------------
// Bot Framework Messaging Endpoint
// ---------------------------------------------------------------------------
// POST /api/teams/messages
//
// Receives incoming Teams activities from the Bot Framework Service.
// Adapts Next.js Request/Response to the format CloudAdapter.process() expects.
//
// Per research Pitfall 1: The shim must provide req.body as parsed JSON
// (already buffered) and req.headers as a plain object. Response shim must
// support res.status(n).send(body) chain.
// ---------------------------------------------------------------------------

import {
  CloudAdapter,
  ConfigurationBotFrameworkAuthentication,
} from "botbuilder";
import { TeamsBotHandler } from "@contractor-ops/api/services/teams/teams-bot-handler";

// ---------------------------------------------------------------------------
// CloudAdapter singleton (shared across requests)
// ---------------------------------------------------------------------------

let adapter: CloudAdapter | null = null;

function getAdapter(): CloudAdapter {
  if (adapter) return adapter;

  const auth = new ConfigurationBotFrameworkAuthentication({
    MicrosoftAppId: process.env.AZURE_BOT_APP_ID ?? "",
    MicrosoftAppPassword: process.env.AZURE_BOT_APP_SECRET ?? "",
    MicrosoftAppType: "MultiTenant",
  });

  adapter = new CloudAdapter(auth);
  return adapter;
}

const bot = new TeamsBotHandler();

// ---------------------------------------------------------------------------
// Request / Response Shim
// ---------------------------------------------------------------------------

interface ShimRequest {
  body: unknown;
  headers: Record<string, string>;
  method: string;
}

interface ShimResponse {
  statusCode: number;
  responseBody: unknown;
  status(code: number): ShimResponse;
  send(body: unknown): void;
  end(): void;
  setHeader(name: string, value: string): void;
}

function createResponseShim(): ShimResponse {
  const shim: ShimResponse = {
    statusCode: 200,
    responseBody: undefined,
    status(code: number) {
      shim.statusCode = code;
      return shim;
    },
    send(body: unknown) {
      shim.responseBody = body;
    },
    end() {
      // No-op for shim
    },
    setHeader(_name: string, _value: string) {
      // No-op for shim — headers set in final Response
    },
  };
  return shim;
}

// ---------------------------------------------------------------------------
// POST Handler
// ---------------------------------------------------------------------------

export async function POST(request: Request): Promise<Response> {
  try {
    // Buffer the request body and parse as JSON
    const body = await request.json();

    // Build request shim with plain headers object
    const headers: Record<string, string> = {};
    request.headers.forEach((value, key) => {
      headers[key] = value;
    });

    const req: ShimRequest = {
      body,
      headers,
      method: "POST",
    };

    const res = createResponseShim();

    // Process the activity through the adapter and bot handler
    await getAdapter().process(
      req as unknown as import("http").IncomingMessage,
      res as unknown as import("http").ServerResponse,
      async (context) => {
        await bot.run(context);
      },
    );

    // Return the response
    const responseBody =
      res.responseBody !== undefined
        ? JSON.stringify(res.responseBody)
        : undefined;

    return new Response(responseBody, {
      status: res.statusCode,
      headers: responseBody
        ? { "Content-Type": "application/json" }
        : undefined,
    });
  } catch (error) {
    console.error("[Teams] Bot Framework endpoint error:", error);
    return new Response(
      JSON.stringify({ error: "Internal server error" }),
      {
        status: 500,
        headers: { "Content-Type": "application/json" },
      },
    );
  }
}
