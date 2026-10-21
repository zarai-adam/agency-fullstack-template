import { describe, expect, it } from "vitest";
import {
  createProjectSchema,
  updateProjectSchema,
} from "../src/projects/project.schemas.js";

describe("createProjectSchema", () => {
  it("accepts a valid project and trims text", () => {
    const result = createProjectSchema.safeParse({
      name: "  Website redesign  ",
      description: "New landing page",
      status: "active",
    });

    expect(result.success).toBe(true);
    expect(result.data).toEqual({
      name: "Website redesign",
      description: "New landing page",
      status: "active",
    });
  });

  it("only requires a name", () => {
    expect(createProjectSchema.safeParse({ name: "Logo" }).success).toBe(true);
  });

  it("rejects a missing or blank name", () => {
    expect(createProjectSchema.safeParse({}).success).toBe(false);
    expect(createProjectSchema.safeParse({ name: "   " }).success).toBe(false);
  });

  it("rejects an unknown status", () => {
    const result = createProjectSchema.safeParse({
      name: "Logo",
      status: "archived",
    });

    expect(result.success).toBe(false);
  });

  it("rejects a name that is too long", () => {
    const result = createProjectSchema.safeParse({ name: "a".repeat(101) });

    expect(result.success).toBe(false);
  });

  it("strips fields the client must not set", () => {
    const result = createProjectSchema.safeParse({
      name: "Logo",
      _id: "123",
      createdAt: "2020-01-01",
    });

    expect(result.data).toEqual({ name: "Logo" });
  });
});

describe("updateProjectSchema", () => {
  it("accepts a single field", () => {
    const result = updateProjectSchema.safeParse({ status: "completed" });

    expect(result.success).toBe(true);
    expect(result.data).toEqual({ status: "completed" });
  });

  it("rejects an empty update", () => {
    expect(updateProjectSchema.safeParse({}).success).toBe(false);
  });

  it("rejects an update with only unknown fields", () => {
    expect(updateProjectSchema.safeParse({ owner: "me" }).success).toBe(false);
  });

  it("keeps the create rules for each field", () => {
    expect(updateProjectSchema.safeParse({ name: "  " }).success).toBe(false);
    expect(updateProjectSchema.safeParse({ status: "archived" }).success).toBe(
      false,
    );
  });
});
