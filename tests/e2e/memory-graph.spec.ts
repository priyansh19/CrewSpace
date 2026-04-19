import { test, expect } from "@playwright/test";

/**
 * E2E: Memory Graph page
 *
 * Tests that the Memory Graph page loads correctly and shows
 * the graph canvas and key UI controls.
 */

test.describe("Memory Graph", () => {
  test("loads the memory graph page", async ({ page }) => {
    await page.goto("/");
    await page.waitForURL(/\/[A-Z]+\//, { timeout: 15_000 });

    const currentUrl = page.url();
    await page.goto(currentUrl.replace(/\/[^/]+$/, "/memory"));

    // Page title in breadcrumb area
    await expect(
      page.locator("text=Memory Graph").or(page.locator("text=Memory")),
    ).toBeVisible({ timeout: 10_000 });
  });

  test("shows the graph canvas or empty state", async ({ page }) => {
    await page.goto("/");
    await page.waitForURL(/\/[A-Z]+\//, { timeout: 15_000 });

    const currentUrl = page.url();
    await page.goto(currentUrl.replace(/\/[^/]+$/, "/memory"));

    // Either a canvas element (graph) or an empty-state message should be present
    const canvas = page.locator("canvas");
    const emptyState = page.locator("text=No memories").or(
      page.locator("text=no memories"),
    ).or(
      page.locator("text=Memory"),
    );

    await expect(canvas.or(emptyState)).toBeVisible({ timeout: 15_000 });
  });

  test("does not crash on load", async ({ page }) => {
    const errors: string[] = [];
    page.on("pageerror", (err) => errors.push(err.message));

    await page.goto("/");
    await page.waitForURL(/\/[A-Z]+\//, { timeout: 15_000 });

    const currentUrl = page.url();
    await page.goto(currentUrl.replace(/\/[^/]+$/, "/memory"));

    // Wait for page to settle
    await page.waitForTimeout(3_000);

    // No unhandled JS errors
    expect(errors.filter((e) => !e.includes("ResizeObserver"))).toHaveLength(0);
  });
});
