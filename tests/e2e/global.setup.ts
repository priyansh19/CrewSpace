import { test as setup } from "@playwright/test";

/**
 * Runs once (as a Playwright "setup" project) before all other test projects.
 *
 * Ensures at least one company exists so that tests which navigate to
 * `/{COMPANY_PREFIX}/...` don't time out waiting for a redirect that will
 * never come on a fresh empty database.
 */
setup("seed e2e database with a company", async ({ request }) => {
  const res = await request.get("/api/companies");
  const companies = (await res.json()) as unknown[];

  if (companies.length > 0) {
    return;
  }

  const createRes = await request.post("/api/companies", {
    data: { name: "E2E Corp" },
  });

  if (!createRes.ok()) {
    const body = await createRes.text().catch(() => "");
    throw new Error(`e2e setup: failed to create company (${createRes.status()}) ${body}`);
  }

  const company = (await createRes.json()) as { name: string; issuePrefix: string };
  console.log(`[e2e setup] Created company: ${company.name} (${company.issuePrefix})`);
});
