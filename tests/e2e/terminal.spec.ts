import { test, expect } from "@playwright/test";

/**
 * E2E: CEO Terminal page
 *
 * Tests the full terminal flow:
 *  - Page loads and shows the terminal UI
 *  - Commands can be executed and output appears
 *  - History persists across page refresh (DB-backed)
 */

async function navigateToTerminal(page: Parameters<typeof test>[1] extends (args: { page: infer P }) => unknown ? P : never) {
  await page.goto("/");

  // Wait for redirect to a company-prefixed route
  await page.waitForURL(/\/[A-Z]+\//, { timeout: 15_000 });

  // Navigate to terminal by replacing the last path segment
  const currentUrl = page.url();
  const terminalUrl = currentUrl.replace(/\/[^/]+$/, "/terminal");
  await page.goto(terminalUrl);
}

test.describe("CEO Terminal", () => {
  test("loads the terminal page with correct UI elements", async ({ page }) => {
    await page.goto("/");
    await page.waitForURL(/\/[A-Z]+\//, { timeout: 15_000 });

    const currentUrl = page.url();
    await page.goto(currentUrl.replace(/\/[^/]+$/, "/terminal"));

    // Toolbar should be visible
    await expect(page.locator("text=CEO Terminal")).toBeVisible({ timeout: 10_000 });

    // Input bar should be present and focused
    const input = page.locator('[data-testid="terminal-input"]');
    await expect(input).toBeVisible({ timeout: 5_000 });
  });

  test("executes a command and shows output in a block", async ({ page }) => {
    await page.goto("/");
    await page.waitForURL(/\/[A-Z]+\//, { timeout: 15_000 });

    const currentUrl = page.url();
    await page.goto(currentUrl.replace(/\/[^/]+$/, "/terminal"));

    const input = page.locator('[data-testid="terminal-input"]');
    await expect(input).toBeVisible({ timeout: 10_000 });

    // Type and execute a test command
    await input.fill('echo "crewspace terminal test"');
    await input.press("Enter");

    // Output should appear within the output area
    const output = page.locator('[data-testid="terminal-output"]');
    await expect(output.locator("text=crewspace terminal test")).toBeVisible({ timeout: 10_000 });

    // The command itself should appear in the block header
    await expect(output.locator('text=echo "crewspace terminal test"')).toBeVisible();

    // Input should be cleared after submission
    await expect(input).toHaveValue("");
  });

  test("shows exit code badge for failing commands", async ({ page }) => {
    await page.goto("/");
    await page.waitForURL(/\/[A-Z]+\//, { timeout: 15_000 });

    const currentUrl = page.url();
    await page.goto(currentUrl.replace(/\/[^/]+$/, "/terminal"));

    const input = page.locator('[data-testid="terminal-input"]');
    await expect(input).toBeVisible({ timeout: 10_000 });

    await input.fill("cat /nonexistent-crewspace-file-xyz-abc");
    await input.press("Enter");

    // Should show an exit code badge
    await expect(page.locator("text=exit 1")).toBeVisible({ timeout: 10_000 });
  });

  test("restores history after page refresh", async ({ page }) => {
    await page.goto("/");
    await page.waitForURL(/\/[A-Z]+\//, { timeout: 15_000 });

    const currentUrl = page.url();
    const terminalUrl = currentUrl.replace(/\/[^/]+$/, "/terminal");
    await page.goto(terminalUrl);

    const input = page.locator('[data-testid="terminal-input"]');
    await expect(input).toBeVisible({ timeout: 10_000 });

    // Run a uniquely identifiable command
    const marker = `crewspace-persist-test-${Date.now()}`;
    await input.fill(`echo "${marker}"`);
    await input.press("Enter");

    // Verify it appeared
    await expect(page.locator(`text=${marker}`)).toBeVisible({ timeout: 10_000 });

    // Refresh the page
    await page.reload();

    // History should be restored from the DB
    await expect(page.locator(`text=${marker}`)).toBeVisible({ timeout: 10_000 });
  });

  test("navigates command history with arrow keys", async ({ page }) => {
    await page.goto("/");
    await page.waitForURL(/\/[A-Z]+\//, { timeout: 15_000 });

    const currentUrl = page.url();
    await page.goto(currentUrl.replace(/\/[^/]+$/, "/terminal"));

    const input = page.locator('[data-testid="terminal-input"]');
    await expect(input).toBeVisible({ timeout: 10_000 });

    // Run two commands
    await input.fill("echo first");
    await input.press("Enter");
    await page.waitForTimeout(500);

    await input.fill("echo second");
    await input.press("Enter");
    await page.waitForTimeout(500);

    // Arrow up should bring back "echo second"
    await input.press("ArrowUp");
    await expect(input).toHaveValue("echo second");

    // Arrow up again should bring back "echo first"
    await input.press("ArrowUp");
    await expect(input).toHaveValue("echo first");

    // Arrow down should go back to "echo second"
    await input.press("ArrowDown");
    await expect(input).toHaveValue("echo second");
  });
});
