import { describe, expect, it } from "vitest";
import {
  createSecretSchema,
  envBindingPlainSchema,
  envBindingSchema,
  envBindingSecretRefSchema,
  envConfigSchema,
  rotateSecretSchema,
  updateSecretSchema,
} from "./secret.js";

const VALID_UUID = "550e8400-e29b-41d4-a716-446655440000";

describe("envBindingPlainSchema", () => {
  it("accepts a plain binding", () => {
    const result = envBindingPlainSchema.safeParse({ type: "plain", value: "myvalue" });
    expect(result.success).toBe(true);
  });

  it("rejects wrong type literal", () => {
    expect(envBindingPlainSchema.safeParse({ type: "secret_ref", value: "x" }).success).toBe(false);
  });
});

describe("envBindingSecretRefSchema", () => {
  it("accepts a valid secret ref with latest version", () => {
    const result = envBindingSecretRefSchema.safeParse({
      type: "secret_ref",
      secretId: VALID_UUID,
      version: "latest",
    });
    expect(result.success).toBe(true);
  });

  it("accepts a valid secret ref with numeric version", () => {
    const result = envBindingSecretRefSchema.safeParse({
      type: "secret_ref",
      secretId: VALID_UUID,
      version: 3,
    });
    expect(result.success).toBe(true);
  });

  it("rejects non-UUID secretId", () => {
    expect(envBindingSecretRefSchema.safeParse({ type: "secret_ref", secretId: "not-uuid" }).success).toBe(false);
  });

  it("rejects version 0 (must be positive)", () => {
    expect(envBindingSecretRefSchema.safeParse({ type: "secret_ref", secretId: VALID_UUID, version: 0 }).success).toBe(false);
  });

  it("rejects negative version", () => {
    expect(envBindingSecretRefSchema.safeParse({ type: "secret_ref", secretId: VALID_UUID, version: -1 }).success).toBe(false);
  });
});

describe("envBindingSchema (backward-compat union)", () => {
  it("accepts plain string (legacy)", () => {
    expect(envBindingSchema.safeParse("plainvalue").success).toBe(true);
  });

  it("accepts plain object binding", () => {
    expect(envBindingSchema.safeParse({ type: "plain", value: "val" }).success).toBe(true);
  });

  it("accepts secret_ref binding", () => {
    expect(envBindingSchema.safeParse({ type: "secret_ref", secretId: VALID_UUID }).success).toBe(true);
  });

  it("rejects object with unknown type", () => {
    expect(envBindingSchema.safeParse({ type: "unknown" }).success).toBe(false);
  });
});

describe("envConfigSchema", () => {
  it("accepts a map of string bindings", () => {
    const result = envConfigSchema.safeParse({ KEY: "value", OTHER: "value2" });
    expect(result.success).toBe(true);
  });

  it("accepts mixed bindings", () => {
    const result = envConfigSchema.safeParse({
      PLAIN: { type: "plain", value: "val" },
      SECRET: { type: "secret_ref", secretId: VALID_UUID },
      LEGACY: "plainstr",
    });
    expect(result.success).toBe(true);
  });

  it("rejects invalid binding in the map", () => {
    expect(envConfigSchema.safeParse({ KEY: { type: "bad" } }).success).toBe(false);
  });
});

describe("createSecretSchema", () => {
  it("accepts a valid secret", () => {
    const result = createSecretSchema.safeParse({ name: "MY_SECRET", value: "s3cr3t" });
    expect(result.success).toBe(true);
  });

  it("rejects empty name", () => {
    expect(createSecretSchema.safeParse({ name: "", value: "x" }).success).toBe(false);
  });

  it("rejects empty value", () => {
    expect(createSecretSchema.safeParse({ name: "KEY", value: "" }).success).toBe(false);
  });

  it("accepts optional description", () => {
    const result = createSecretSchema.safeParse({ name: "K", value: "v", description: "My secret" });
    expect(result.success).toBe(true);
  });

  it("accepts null description", () => {
    expect(createSecretSchema.safeParse({ name: "K", value: "v", description: null }).success).toBe(true);
  });
});

describe("rotateSecretSchema", () => {
  it("accepts a new value", () => {
    expect(rotateSecretSchema.safeParse({ value: "new-secret" }).success).toBe(true);
  });

  it("rejects empty value", () => {
    expect(rotateSecretSchema.safeParse({ value: "" }).success).toBe(false);
  });
});

describe("updateSecretSchema", () => {
  it("accepts empty update", () => {
    expect(updateSecretSchema.safeParse({}).success).toBe(true);
  });

  it("accepts name update", () => {
    expect(updateSecretSchema.safeParse({ name: "NEW_NAME" }).success).toBe(true);
  });

  it("rejects empty name", () => {
    expect(updateSecretSchema.safeParse({ name: "" }).success).toBe(false);
  });

  it("accepts null description", () => {
    expect(updateSecretSchema.safeParse({ description: null }).success).toBe(true);
  });
});
