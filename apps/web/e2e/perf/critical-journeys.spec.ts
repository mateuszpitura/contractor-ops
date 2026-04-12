import type { Page } from "@playwright/test";
import { expect, test } from "@playwright/test";
import { skipIfUnauthenticated } from "./helpers";

async function measureShell(page: Page, path: string, scenario: string) {
  const t0 = Date.now();
  await page.goto(path, { waitUntil: "domcontentloaded" });
  skipIfUnauthenticated(page);
  await page.locator("#main-content").waitFor({ state: "visible", timeout: 60_000 });
  const durationMs = Date.now() - t0;
  console.log(JSON.stringify({ scenario, path, durationMs }));
  expect(durationMs).toBeLessThan(120_000);
}

test.describe("perf — authenticated shell", () => {
  test("dashboard home", async ({ page }) => {
    await measureShell(page, "/en/", "dashboard");
  });

  test("contractors list", async ({ page }) => {
    await measureShell(page, "/en/contractors", "contractors");
  });

  test("invoices list", async ({ page }) => {
    await measureShell(page, "/en/invoices", "invoices");
  });

  test("approvals queue", async ({ page }) => {
    await measureShell(page, "/en/approvals", "approvals");
  });
});
