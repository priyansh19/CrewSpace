import { test, expect } from "@playwright/test";

/**
 * E2E: Agent Chat page
 *
 * Tests that the Agent Chat page loads, shows the session list,
 * and allows starting a new chat session.
 */

test.describe("Agent Chat", () => {
  test("loads the agent chat page", async ({ page }) => {
    await page.goto("/");
    await page.waitForURL(/\/[A-Z]+\//, { timeout: 15_000 });

    const currentUrl = page.url();
    await page.goto(currentUrl.replace(/\/[^/]+$/, "/agent-chat"));

    await expect(
      page.locator("text=Agent Chat").or(page.locator("text=Chat")),
    ).toBeVisible({ timeout: 10_000 });
  });

  test("shows new chat button or session list", async ({ page }) => {
    await page.goto("/");
    await page.waitForURL(/\/[A-Z]+\//, { timeout: 15_000 });

    const currentUrl = page.url();
    await page.goto(currentUrl.replace(/\/[^/]+$/, "/agent-chat"));

    // Should show either a new chat button or existing sessions
    const newChatBtn = page.getByRole("button", { name: /new chat/i }).or(
      page.getByRole("button", { name: /new/i }),
    );
    const sessionList = page.locator("[data-testid='chat-sessions']").or(
      page.locator("text=No active sessions").or(
        page.locator("text=Start a conversation"),
      ),
    );

    await expect(newChatBtn.or(sessionList)).toBeVisible({ timeout: 10_000 });
  });

  test("shows agent selector when starting a new chat", async ({ page }) => {
    await page.goto("/");
    await page.waitForURL(/\/[A-Z]+\//, { timeout: 15_000 });

    const currentUrl = page.url();
    await page.goto(currentUrl.replace(/\/[^/]+$/, "/agent-chat"));

    // Try to click new chat button if present
    const newChatBtn = page.getByRole("button", { name: /new chat/i });
    const isVisible = await newChatBtn.isVisible().catch(() => false);

    if (isVisible) {
      await newChatBtn.click();
      // Agent selection UI should appear
      await expect(
        page.locator("text=Select").or(
          page.locator("[placeholder*='Search']").or(
            page.locator("text=agent"),
          ),
        ),
      ).toBeVisible({ timeout: 5_000 });
    } else {
      // No agents yet — just verify page is stable
      await expect(page.locator("text=Chat").or(page.locator("text=Agent"))).toBeVisible();
    }
  });

  test("does not crash on load", async ({ page }) => {
    const errors: string[] = [];
    page.on("pageerror", (err) => errors.push(err.message));

    await page.goto("/");
    await page.waitForURL(/\/[A-Z]+\//, { timeout: 15_000 });

    const currentUrl = page.url();
    await page.goto(currentUrl.replace(/\/[^/]+$/, "/agent-chat"));

    await page.waitForTimeout(3_000);

    expect(errors.filter((e) => !e.includes("ResizeObserver"))).toHaveLength(0);
  });
});
