import { expect, test } from "@playwright/test";

/**
 * Public route — no session. Complements dashboard perf when E2E_* are unset.
 */
test.use({ storageState: { cookies: [], origins: [] } });

test.describe("perf — public login page", () => {
  test("login form visible", async ({ page }) => {
    const t0 = Date.now();
    await page.goto("/en/login", { waitUntil: "domcontentloaded" });
    await page.locator("#email").waitFor({ state: "visible", timeout: 15_000 });
    await page.locator("#password").waitFor({ state: "visible" });
    const durationMs = Date.now() - t0;
    console.log(JSON.stringify({ scenario: "login_public", path: "/en/login", durationMs }));
    expect(durationMs).toBeLessThan(60_000);
  });
});
