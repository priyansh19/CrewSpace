import { describe, expect, it } from "vitest";
import {
  createRoutineSchema,
  createRoutineTriggerSchema,
  runRoutineSchema,
  rotateRoutineTriggerSecretSchema,
  updateRoutineSchema,
  updateRoutineTriggerSchema,
} from "./routine.js";

const VALID_UUID = "550e8400-e29b-41d4-a716-446655440000";

describe("createRoutineSchema", () => {
  it("accepts a valid routine", () => {
    const result = createRoutineSchema.safeParse({
      projectId: VALID_UUID,
      title: "Daily sync",
      assigneeAgentId: VALID_UUID,
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.status).toBe("active");
      expect(result.data.concurrencyPolicy).toBe("coalesce_if_active");
      expect(result.data.catchUpPolicy).toBe("skip_missed");
    }
  });

  it("rejects empty title", () => {
    expect(createRoutineSchema.safeParse({ projectId: VALID_UUID, title: "", assigneeAgentId: VALID_UUID }).success).toBe(false);
  });

  it("rejects title longer than 200 chars", () => {
    expect(createRoutineSchema.safeParse({
      projectId: VALID_UUID, title: "x".repeat(201), assigneeAgentId: VALID_UUID,
    }).success).toBe(false);
  });

  it("rejects non-UUID projectId", () => {
    expect(createRoutineSchema.safeParse({ projectId: "bad", title: "T", assigneeAgentId: VALID_UUID }).success).toBe(false);
  });

  it("rejects non-UUID assigneeAgentId", () => {
    expect(createRoutineSchema.safeParse({ projectId: VALID_UUID, title: "T", assigneeAgentId: "bad" }).success).toBe(false);
  });

  it("accepts valid concurrencyPolicy", () => {
    expect(createRoutineSchema.safeParse({
      projectId: VALID_UUID, title: "T", assigneeAgentId: VALID_UUID, concurrencyPolicy: "allow_concurrent",
    }).success).toBe(true);
  });

  it("rejects invalid concurrencyPolicy", () => {
    expect(createRoutineSchema.safeParse({
      projectId: VALID_UUID, title: "T", assigneeAgentId: VALID_UUID, concurrencyPolicy: "block",
    }).success).toBe(false);
  });
});

describe("updateRoutineSchema", () => {
  it("accepts empty update", () => {
    expect(updateRoutineSchema.safeParse({}).success).toBe(true);
  });

  it("accepts partial status update", () => {
    expect(updateRoutineSchema.safeParse({ status: "paused" }).success).toBe(true);
  });
});

describe("createRoutineTriggerSchema (discriminated union)", () => {
  it("accepts a schedule trigger", () => {
    const result = createRoutineTriggerSchema.safeParse({
      kind: "schedule",
      cronExpression: "0 9 * * 1-5",
      timezone: "America/New_York",
    });
    expect(result.success).toBe(true);
  });

  it("rejects schedule trigger with empty cronExpression", () => {
    expect(createRoutineTriggerSchema.safeParse({ kind: "schedule", cronExpression: "" }).success).toBe(false);
  });

  it("accepts a webhook trigger with defaults", () => {
    const result = createRoutineTriggerSchema.safeParse({ kind: "webhook" });
    expect(result.success).toBe(true);
    if (result.success && result.data.kind === "webhook") {
      expect(result.data.signingMode).toBe("bearer");
      expect(result.data.replayWindowSec).toBe(300);
    }
  });

  it("rejects webhook replayWindowSec below minimum (29)", () => {
    expect(createRoutineTriggerSchema.safeParse({ kind: "webhook", replayWindowSec: 29 }).success).toBe(false);
  });

  it("rejects webhook replayWindowSec above maximum (86401)", () => {
    expect(createRoutineTriggerSchema.safeParse({ kind: "webhook", replayWindowSec: 86401 }).success).toBe(false);
  });

  it("accepts an api trigger", () => {
    expect(createRoutineTriggerSchema.safeParse({ kind: "api" }).success).toBe(true);
  });

  it("rejects unknown kind", () => {
    expect(createRoutineTriggerSchema.safeParse({ kind: "cron" }).success).toBe(false);
  });
});

describe("updateRoutineTriggerSchema", () => {
  it("accepts empty update", () => {
    expect(updateRoutineTriggerSchema.safeParse({}).success).toBe(true);
  });

  it("accepts updating label and enabled", () => {
    expect(updateRoutineTriggerSchema.safeParse({ label: "My trigger", enabled: false }).success).toBe(true);
  });

  it("rejects replayWindowSec below minimum", () => {
    expect(updateRoutineTriggerSchema.safeParse({ replayWindowSec: 29 }).success).toBe(false);
  });
});

describe("runRoutineSchema", () => {
  it("accepts empty payload", () => {
    const result = runRoutineSchema.safeParse({});
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.source).toBe("manual");
    }
  });

  it("accepts with idempotencyKey", () => {
    expect(runRoutineSchema.safeParse({ idempotencyKey: "run-123" }).success).toBe(true);
  });

  it("rejects idempotencyKey longer than 255 chars", () => {
    expect(runRoutineSchema.safeParse({ idempotencyKey: "x".repeat(256) }).success).toBe(false);
  });

  it("accepts source api", () => {
    expect(runRoutineSchema.safeParse({ source: "api" }).success).toBe(true);
  });

  it("rejects invalid source", () => {
    expect(runRoutineSchema.safeParse({ source: "cron" }).success).toBe(false);
  });
});

describe("rotateRoutineTriggerSecretSchema", () => {
  it("accepts empty object", () => {
    expect(rotateRoutineTriggerSecretSchema.safeParse({}).success).toBe(true);
  });
});
