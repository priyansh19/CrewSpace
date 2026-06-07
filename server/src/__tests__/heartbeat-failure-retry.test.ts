import { randomUUID } from "node:crypto";
import { eq, and } from "drizzle-orm";
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import { sql } from "drizzle-orm";
import {
  agents,
  agentRuntimeState,
  agentTaskSessions,
  agentWakeupRequests,
  companies,
  createDb,
  heartbeatRunEvents,
  heartbeatRuns,
  issues,
} from "@crewspaceai/db";
import {
  getEmbeddedPostgresTestSupport,
  startEmbeddedPostgresTestDatabase,
} from "./helpers/embedded-postgres.js";
import { heartbeatService } from "../services/heartbeat.ts";

const embeddedPostgresSupport = await getEmbeddedPostgresTestSupport();
const describeEmbeddedPostgres = embeddedPostgresSupport.supported ? describe : describe.skip;

if (!embeddedPostgresSupport.supported) {
  console.warn(
    `Skipping embedded Postgres heartbeat failure-retry tests on this host: ${embeddedPostgresSupport.reason ?? "unsupported environment"}`,
  );
}

vi.mock("../adapters/index.js", () => ({
  getServerAdapter: vi.fn(() => ({
    type: "mock_adapter",
    execute: vi.fn(async () => ({
      exitCode: 1,
      errorMessage: "Simulated adapter failure",
      timedOut: false,
    })),
    supportsLocalAgentJwt: false,
    sessionCodec: {
      deserialize: () => null,
      serialize: () => null,
      getDisplayId: () => null,
    },
  })),
  runningProcesses: new Map(),
}));

describeEmbeddedPostgres("heartbeat failure retry", () => {
  let db!: ReturnType<typeof createDb>;
  let tempDb: Awaited<ReturnType<typeof startEmbeddedPostgresTestDatabase>> | null = null;

  beforeAll(async () => {
    tempDb = await startEmbeddedPostgresTestDatabase("crewspace-heartbeat-failure-retry-");
    db = createDb(tempDb.connectionString);
  }, 20_000);

  afterEach(async () => {
    await db.execute(sql`TRUNCATE TABLE heartbeat_run_events, agent_task_sessions, agent_runtime_state, issues, heartbeat_runs, agent_wakeup_requests, agents, company_skills, companies CASCADE`);
  });

  afterAll(async () => {
    await tempDb?.cleanup();
  });

  async function seedFixture(input?: {
    runStatus?: "queued" | "running" | "failed";
    retryCount?: number;
    nextRetryAt?: Date | null;
  }) {
    const companyId = randomUUID();
    const agentId = randomUUID();
    const runId = randomUUID();
    const wakeupRequestId = randomUUID();
    const issueId = randomUUID();
    const now = new Date("2026-03-19T00:00:00.000Z");
    const issuePrefix = `T${companyId.replace(/-/g, "").slice(0, 6).toUpperCase()}`;

    await db.insert(companies).values({
      id: companyId,
      name: "CrewSpace",
      issuePrefix,
      requireBoardApprovalForNewAgents: false,
    });

    await db.insert(agents).values({
      id: agentId,
      companyId,
      name: "MockCoder",
      role: "engineer",
      status: "running",
      adapterType: "mock_adapter",
      adapterConfig: {},
      runtimeConfig: {},
      permissions: {},
    });

    await db.insert(agentWakeupRequests).values({
      id: wakeupRequestId,
      companyId,
      agentId,
      source: "assignment",
      triggerDetail: "system",
      reason: "issue_assigned",
      payload: { issueId },
      status: input?.runStatus === "queued" ? "queued" : "claimed",
      runId: input?.runStatus === "queued" ? null : runId,
      claimedAt: input?.runStatus === "queued" ? null : now,
    });

    await db.insert(heartbeatRuns).values({
      id: runId,
      companyId,
      agentId,
      invocationSource: "assignment",
      triggerDetail: "system",
      status: input?.runStatus ?? "queued",
      wakeupRequestId,
      contextSnapshot: { issueId },
      retryCount: input?.retryCount ?? 0,
      nextRetryAt: input?.nextRetryAt ?? null,
      startedAt: input?.runStatus === "queued" ? null : now,
      updatedAt: now,
    });

    await db.insert(issues).values({
      id: issueId,
      companyId,
      title: "Test issue for retry",
      status: "in_progress",
      priority: "medium",
      assigneeAgentId: agentId,
      checkoutRunId: runId,
      executionRunId: runId,
      issueNumber: 1,
      identifier: `${issuePrefix}-1`,
    });

    return { companyId, agentId, runId, wakeupRequestId, issueId, now };
  }

  it("queues a retry with exponential backoff after adapter failure", async () => {
    const { agentId, runId, issueId, now } = await seedFixture({ runStatus: "queued" });
    const heartbeat = heartbeatService(db);

    // Trigger execution of the queued run
    await heartbeat.resumeQueuedRuns();

    // Wait for async execution to settle
    await new Promise((resolve) => setTimeout(resolve, 500));

    const runs = await db
      .select()
      .from(heartbeatRuns)
      .where(eq(heartbeatRuns.agentId, agentId));

    expect(runs).toHaveLength(2);

    const failedRun = runs.find((r) => r.id === runId);
    const retryRun = runs.find((r) => r.id !== runId);

    expect(failedRun?.status).toBe("failed");
    expect(failedRun?.errorCode).toBe("adapter_failed");

    expect(retryRun?.status).toBe("queued");
    expect(retryRun?.retryOfRunId).toBe(runId);
    expect(retryRun?.retryCount).toBe(1);
    expect(retryRun?.nextRetryAt).not.toBeNull();

    // First backoff is 30 seconds from when enqueueFailureRetry was called (roughly now)
    const actualRetryAt = new Date(retryRun?.nextRetryAt ?? 0);
    const testStartTime = Date.now();
    expect(actualRetryAt.getTime()).toBeGreaterThanOrEqual(testStartTime - 5000);
    expect(actualRetryAt.getTime()).toBeLessThanOrEqual(testStartTime + 60_000);

    // Issue execution should be transferred to retry run
    const issue = await db
      .select()
      .from(issues)
      .where(eq(issues.id, issueId))
      .then((rows) => rows[0] ?? null);
    expect(issue?.executionRunId).toBe(retryRun?.id ?? null);
    expect(issue?.checkoutRunId).toBe(runId);
  });

  it("increments retryCount and doubles backoff on each successive failure", async () => {
    const { agentId, runId, issueId } = await seedFixture({
      runStatus: "queued",
      retryCount: 2,
      nextRetryAt: null,
    });
    const heartbeat = heartbeatService(db);

    await heartbeat.resumeQueuedRuns();
    await new Promise((resolve) => setTimeout(resolve, 500));

    const runs = await db
      .select()
      .from(heartbeatRuns)
      .where(eq(heartbeatRuns.agentId, agentId));

    expect(runs).toHaveLength(2);

    const retryRun = runs.find((r) => r.id !== runId);
    expect(retryRun?.retryCount).toBe(3);

    // Third backoff is 240 seconds (index 2 of [30s, 120s, 240s, 480s, 960s])
    expect(retryRun?.nextRetryAt).not.toBeNull();
  });

  it("does not queue a retry after max retries (5) are exhausted", async () => {
    const { agentId, runId, issueId } = await seedFixture({
      runStatus: "queued",
      retryCount: 5,
      nextRetryAt: null,
    });
    const heartbeat = heartbeatService(db);

    await heartbeat.resumeQueuedRuns();
    await new Promise((resolve) => setTimeout(resolve, 500));

    const runs = await db
      .select()
      .from(heartbeatRuns)
      .where(eq(heartbeatRuns.agentId, agentId));

    // Only the original failed run, no retry created
    expect(runs).toHaveLength(1);
    expect(runs[0]?.status).toBe("failed");

    // Issue execution should be released
    const issue = await db
      .select()
      .from(issues)
      .where(eq(issues.id, issueId))
      .then((rows) => rows[0] ?? null);
    expect(issue?.executionRunId).toBeNull();
  });

  it("respects nextRetryAt delay before scheduling a retry", async () => {
    const future = new Date(Date.now() + 60_000);
    const { agentId, runId } = await seedFixture({
      runStatus: "queued",
      retryCount: 1,
      nextRetryAt: future,
    });
    const heartbeat = heartbeatService(db);

    await heartbeat.resumeQueuedRuns();
    await new Promise((resolve) => setTimeout(resolve, 500));

    // The run should still be queued because nextRetryAt is in the future
    const runs = await db
      .select()
      .from(heartbeatRuns)
      .where(eq(heartbeatRuns.agentId, agentId));

    expect(runs).toHaveLength(1);
    expect(runs[0]?.status).toBe("queued");
    expect(runs[0]?.retryCount).toBe(1);
  });
});
