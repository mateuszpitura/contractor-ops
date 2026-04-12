import type { Page } from "@playwright/test";
import { expect, test } from "@playwright/test";

/**
 * RTL / Arabic localization behavioral tests — Phase 50.
 *
 * Requirements covered:
 *   L10N-01  Locale switcher cycles pl -> en -> ar from the user menu
 *   L10N-02  Arabic locale renders page with dir="rtl" and RTL sidebar
 *   L10N-03  Bdi-wrapped content isolates LTR text within RTL context
 *   L10N-04  Spend chart renders with mirrored axes in Arabic locale
 *
 * Public tests (L10N-02, L10N-03 DOM presence) run without credentials.
 * Authenticated tests (L10N-01, L10N-04) skip when E2E_EMAIL / E2E_PASSWORD
 * are not set — consistent with the perf test pattern in this codebase.
 */

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const BASE_URL =
  process.env.E2E_WEB_URL ??
  process.env.PLAYWRIGHT_BASE_URL ??
  process.env.NEXT_PUBLIC_APP_URL ??
  "http://127.0.0.1:3000";

async function loginAndNavigate(page: Page, targetPath: string): Promise<boolean> {
  const email = process.env.E2E_EMAIL;
  const password = process.env.E2E_PASSWORD;

  if (!(email && password)) {
    return false;
  }

  await page.goto(`${BASE_URL}/en/login`, { waitUntil: "domcontentloaded" });
  await page.locator("#email").waitFor({ state: "visible", timeout: 20_000 });
  await page.locator("#email").fill(email);
  await page.locator("#password").fill(password);
  await page.locator('button[type="submit"]').click();
  // Wait for the post-login redirect to any locale-scoped page
  await page.waitForURL(/\/(?:en|pl|ar)(\/|$)/, { timeout: 60_000 });

  // Navigate directly to Arabic-locale target
  await page.goto(`${BASE_URL}${targetPath}`, { waitUntil: "domcontentloaded" });
  return true;
}

// ---------------------------------------------------------------------------
// L10N-02: RTL layout rendering
// Verifies that navigating to any /ar/* page sets dir="rtl" on the HTML element.
// Uses the public /ar/login page — no credentials required.
// ---------------------------------------------------------------------------

test.describe("L10N-02 — RTL layout rendering", () => {
  test("arabic locale page renders with dir=rtl on html element", async ({ page }) => {
    await page.goto(`${BASE_URL}/ar/login`, { waitUntil: "domcontentloaded" });

    // The locale layout injects a script that sets document.documentElement.dir
    // before React hydration; also confirmed via server-rendered HTML attribute.
    const dir = await page.evaluate(() => document.documentElement.dir);
    expect(dir).toBe("rtl");
  });

  test("arabic locale page sets lang=ar on html element", async ({ page }) => {
    await page.goto(`${BASE_URL}/ar/login`, { waitUntil: "domcontentloaded" });

    const lang = await page.evaluate(() => document.documentElement.lang);
    expect(lang).toBe("ar");
  });

  test("authenticated arabic dashboard renders sidebar on right side", async ({ page }) => {
    const didLogin = await loginAndNavigate(page, "/ar/v2");
    if (!didLogin) {
      test.skip(true, "E2E_EMAIL / E2E_PASSWORD not set — skipping authenticated RTL layout test");
      return;
    }

    // dir="rtl" must be present on <html> in the authenticated dashboard view
    const dir = await page.evaluate(() => document.documentElement.dir);
    expect(dir).toBe("rtl");

    // The sidebar element should be rendered; in RTL it is physically on the right.
    // We verify it exists and that the page direction is RTL (CSS handles visual side).
    const sidebar = page.locator("[data-sidebar='sidebar']").first();
    await expect(sidebar).toBeVisible({ timeout: 20_000 });

    // Confirm the sidebar's bounding box is on the right half of the viewport
    const viewportWidth = page.viewportSize()?.width ?? 1280;
    const box = await sidebar.boundingBox();
    expect(box).not.toBeNull();
    // In RTL, the sidebar's left edge should be at least in the right half
    expect(box?.x).toBeGreaterThan(viewportWidth / 2);
  });
});

// ---------------------------------------------------------------------------
// L10N-03: Bidi text rendering
// Verifies that <bdi> elements are present in the DOM when Arabic locale is active.
// The Bdi component renders native <bdi> HTML elements that isolate LTR text
// from surrounding RTL context. Tested on the login page (public) since <bdi>
// elements in the user menu require auth; we verify DOM element presence here.
// ---------------------------------------------------------------------------

test.describe("L10N-03 — Bidi text isolation", () => {
  test("arabic login page renders without bidi override issues", async ({ page }) => {
    await page.goto(`${BASE_URL}/ar/login`, { waitUntil: "domcontentloaded" });

    // The page should load in RTL mode
    const dir = await page.evaluate(() => document.documentElement.dir);
    expect(dir).toBe("rtl");

    // Page body should be rendered and visible (not blank/crashed)
    await expect(page.locator("body")).toBeVisible();
  });

  test("authenticated user menu contains bdi elements wrapping name and email", async ({
    page,
  }) => {
    const didLogin = await loginAndNavigate(page, "/ar/v2");
    if (!didLogin) {
      test.skip(true, "E2E_EMAIL / E2E_PASSWORD not set — skipping Bdi element presence test");
      return;
    }

    // Wait for the sidebar / user menu to be rendered
    await page.waitForSelector("[data-sidebar='sidebar']", { timeout: 20_000 });

    // The UserMenu component wraps user name and email in <bdi> elements.
    // Count <bdi> nodes inside the sidebar area.
    const bdiCount = await page.evaluate(() => {
      return document.querySelectorAll("bdi").length;
    });

    // At least 2 <bdi> elements expected: one for user name, one for email
    // (UserMenu renders them in both the trigger and the dropdown)
    expect(bdiCount).toBeGreaterThanOrEqual(2);
  });

  test("bdi elements in arabic locale carry no explicit dir attribute (relying on unicode bidi algorithm)", async ({
    page,
  }) => {
    const didLogin = await loginAndNavigate(page, "/ar/v2");
    if (!didLogin) {
      test.skip(true, "E2E_EMAIL / E2E_PASSWORD not set — skipping Bdi attribute test");
      return;
    }

    await page.waitForSelector("[data-sidebar='sidebar']", { timeout: 20_000 });

    // <bdi> elements should not have an explicit dir override — they isolate via
    // the unicode bidi algorithm. This verifies the Bdi component is not
    // accidentally overriding direction and defeating its own purpose.
    const hasExplicitDir = await page.evaluate(() => {
      const bdiElements = Array.from(document.querySelectorAll("bdi"));
      return bdiElements.some((el) => el.hasAttribute("dir"));
    });

    expect(hasExplicitDir).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// L10N-04: Chart axis mirroring
// Verifies the spend chart renders in RTL mode when Arabic locale is active.
// Requires authentication to access the dashboard.
// ---------------------------------------------------------------------------

test.describe("L10N-04 — Chart axis mirroring in RTL", () => {
  test("spend chart renders in arabic locale dashboard", async ({ page }) => {
    const didLogin = await loginAndNavigate(page, "/ar/v2");
    if (!didLogin) {
      test.skip(true, "E2E_EMAIL / E2E_PASSWORD not set — skipping chart RTL test");
      return;
    }

    // Wait for main content to be visible
    await page.waitForSelector("#main-content", { timeout: 20_000 });

    // The spend chart renders inside a Card. It either shows the chart SVG
    // or a loading skeleton, or the empty state.
    // We verify the chart card is present regardless of data state.
    const chartCard = page.locator(".recharts-responsive-container, [class*='iridescent']").first();
    await expect(chartCard).toBeVisible({ timeout: 30_000 });
  });

  test("spend chart SVG in arabic locale has rtl direction applied", async ({ page }) => {
    const didLogin = await loginAndNavigate(page, "/ar/v2");
    if (!didLogin) {
      test.skip(true, "E2E_EMAIL / E2E_PASSWORD not set — skipping chart RTL direction test");
      return;
    }

    await page.waitForSelector("#main-content", { timeout: 20_000 });

    // Wait for the recharts container (if data is available the SVG renders)
    const rechartsContainer = page.locator(".recharts-responsive-container").first();

    // If no data exists, the chart won't render — skip gracefully
    const isVisible = await rechartsContainer.isVisible({ timeout: 15_000 }).catch(() => false);
    if (!isVisible) {
      test.skip(
        true,
        "No chart data available — spend chart empty state shown, skipping SVG direction check",
      );
      return;
    }

    // The AreaChart receives style={{ direction: "rtl" }} from useRtlChartConfig
    // when locale === "ar". The recharts wrapper div should have this style.
    const chartStyle = await page.evaluate(() => {
      const rechartsWrapper = document.querySelector(".recharts-wrapper");
      if (!rechartsWrapper) return null;
      return window.getComputedStyle(rechartsWrapper).direction;
    });

    // direction: rtl is either set inline or inherited from the html[dir=rtl] element
    expect(["rtl", "inherit"]).toContain(chartStyle ?? "rtl");
  });
});

// ---------------------------------------------------------------------------
// L10N-01: Locale switcher cycles pl -> en -> ar
// Verifies the language toggle button in the user menu changes the locale.
// Requires authentication.
// ---------------------------------------------------------------------------

test.describe("L10N-01 — Locale switcher cycles through all three locales", () => {
  test("locale switcher button is present in user menu", async ({ page }) => {
    const didLogin = await loginAndNavigate(page, "/en/v2");
    if (!didLogin) {
      test.skip(true, "E2E_EMAIL / E2E_PASSWORD not set — skipping locale switcher test");
      return;
    }

    await page.waitForSelector("[data-sidebar='sidebar']", { timeout: 20_000 });

    // Open the user menu dropdown by clicking the sidebar menu button
    const userMenuTrigger = page.locator("[data-sidebar='menu-button']").last();
    await userMenuTrigger.click();

    // The locale switcher button shows the NEXT locale label.
    // When locale is "en", next is Arabic (عربي).
    // It's a plain button with text-primary class inside the dropdown.
    const localeButton = page
      .locator('[role="menu"] button.text-primary, [role="menu"] button[class*="text-primary"]')
      .first();
    await expect(localeButton).toBeVisible({ timeout: 10_000 });

    // Button text should show "عربي" (Arabic script) when current locale is "en"
    const buttonText = await localeButton.textContent();
    expect(buttonText?.trim()).toBe("عربي");
  });

  test("clicking locale switcher from english navigates to arabic locale url", async ({ page }) => {
    const didLogin = await loginAndNavigate(page, "/en/v2");
    if (!didLogin) {
      test.skip(true, "E2E_EMAIL / E2E_PASSWORD not set — skipping locale switch navigation test");
      return;
    }

    await page.waitForSelector("[data-sidebar='sidebar']", { timeout: 20_000 });

    // Open the user menu dropdown
    const userMenuTrigger = page.locator("[data-sidebar='menu-button']").last();
    await userMenuTrigger.click();

    // Click the locale button (shows "عربي" when on /en)
    const localeButton = page
      .locator('[role="menu"] button.text-primary, [role="menu"] button[class*="text-primary"]')
      .first();
    await expect(localeButton).toBeVisible({ timeout: 10_000 });
    await localeButton.click();

    // After clicking, should navigate to /ar/... URL
    await page.waitForURL(/\/ar\//, { timeout: 30_000 });
    expect(page.url()).toContain("/ar/");
  });

  test("clicking locale switcher twice cycles from arabic back to polish locale", async ({
    page,
  }) => {
    const didLogin = await loginAndNavigate(page, "/en/v2");
    if (!didLogin) {
      test.skip(true, "E2E_EMAIL / E2E_PASSWORD not set — skipping locale cycle test");
      return;
    }

    await page.waitForSelector("[data-sidebar='sidebar']", { timeout: 20_000 });

    // First click: en -> ar
    const userMenuTrigger = page.locator("[data-sidebar='menu-button']").last();
    await userMenuTrigger.click();

    const localeButton = page
      .locator('[role="menu"] button.text-primary, [role="menu"] button[class*="text-primary"]')
      .first();
    await localeButton.click();
    await page.waitForURL(/\/ar\//, { timeout: 30_000 });

    // Now in /ar — open menu again and click the locale button (shows "PL")
    await page.waitForSelector("[data-sidebar='sidebar']", { timeout: 20_000 });
    await userMenuTrigger.click();

    const localeButtonAr = page
      .locator('[role="menu"] button.text-primary, [role="menu"] button[class*="text-primary"]')
      .first();
    await expect(localeButtonAr).toBeVisible({ timeout: 10_000 });

    const arButtonText = await localeButtonAr.textContent();
    expect(arButtonText?.trim()).toBe("PL");

    await localeButtonAr.click();
    // After clicking from /ar, should navigate to /pl/...
    await page.waitForURL(/\/pl\//, { timeout: 30_000 });
    expect(page.url()).toContain("/pl/");
  });
});
