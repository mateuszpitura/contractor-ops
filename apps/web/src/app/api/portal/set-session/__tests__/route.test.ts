/** @vitest-environment node */

import { NextRequest } from "next/server";
import { describe, expect, it } from "vitest";
import { POST } from "../route";

describe("POST /api/portal/set-session", () => {
  it("returns 400 when body fails validation", async () => {
    const req = new NextRequest("http://localhost/api/portal/set-session", {
      method: "POST",
      body: JSON.stringify({}),
      headers: { "content-type": "application/json" },
    });
    const res = await POST(req);
    expect(res.status).toBe(400);
    const json = (await res.json()) as { error: string };
    expect(json.error).toBe("Invalid request body");
  });

  it("returns 200 and sets portal_session cookie on valid input", async () => {
    const expires = new Date("2099-01-01T00:00:00.000Z").toISOString();
    const req = new NextRequest("http://localhost/api/portal/set-session", {
      method: "POST",
      body: JSON.stringify({ token: "sess-token-abc", expiresAt: expires }),
      headers: { "content-type": "application/json" },
    });
    const res = await POST(req);
    expect(res.status).toBe(200);
    const json = (await res.json()) as { success: boolean };
    expect(json.success).toBe(true);

    const setCookie = res.headers.get("set-cookie") ?? "";
    expect(setCookie).toContain("portal_session=sess-token-abc");
    expect(setCookie.toLowerCase()).toContain("httponly");
    expect(setCookie.toLowerCase()).toContain("samesite=strict");
    expect(setCookie.toLowerCase()).toContain("secure");
  });

  it("returns 500 when request body is not valid JSON", async () => {
    const req = new NextRequest("http://localhost/api/portal/set-session", {
      method: "POST",
      body: "{not-valid-json",
      headers: { "content-type": "application/json" },
    });
    const res = await POST(req);
    expect(res.status).toBe(500);
    const json = (await res.json()) as { error: string };
    expect(json.error).toBe("Failed to set session");
  });
});
