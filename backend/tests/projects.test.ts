import { Types } from "mongoose";
import request from "supertest";
import { describe, expect, it } from "vitest";
import { createApp } from "../src/app.js";
import { ProjectModel } from "../src/projects/project.model.js";
import { defaultProjectRateLimits } from "../src/rateLimit.js";
import { useTestDatabase } from "./helpers/testDb.js";

useTestDatabase();

// These tests send far more than 20 writes, so they use an app with very
// high limits: rate limiting is tested on its own in rateLimit.test.ts.
// Production limits are unchanged.
const app = createApp({
  projectRateLimits: {
    ...defaultProjectRateLimits,
    general: 100_000,
    writes: 100_000,
  },
});

// A well-formed ID that no project in the test database has.
const missingId = () => new Types.ObjectId().toHexString();

// "aaaaaaaaaaaa" is 12 characters. Older Mongoose versions treated any
// 12-character string as a valid ID, so this guards against that coming back.
const malformedIds = ["not-an-id", "123", "aaaaaaaaaaaa"];

async function createProject(body: Record<string, unknown> = {}) {
  const response = await request(app)
    .post("/projects")
    .send({ name: "Website redesign", ...body });

  return response.body as { id: string; createdAt: string; updatedAt: string };
}

describe("POST /projects", () => {
  it("creates a project with default values", async () => {
    const response = await request(app)
      .post("/projects")
      .send({ name: "Website redesign" });

    expect(response.status).toBe(201);
    expect(response.body).toMatchObject({
      name: "Website redesign",
      description: "",
      status: "planning",
    });
    expect(response.body.id).toEqual(expect.any(String));
    expect(response.body.createdAt).toEqual(expect.any(String));
    expect(response.body.updatedAt).toEqual(expect.any(String));
    expect(response.body).not.toHaveProperty("_id");
    expect(response.body).not.toHaveProperty("__v");

    expect(await ProjectModel.countDocuments()).toBe(1);
  });

  it("saves the description and status that were sent", async () => {
    const response = await request(app).post("/projects").send({
      name: "Chatbot",
      description: "Support assistant",
      status: "active",
    });

    expect(response.status).toBe(201);
    expect(response.body).toMatchObject({
      description: "Support assistant",
      status: "active",
    });
  });

  it("rejects invalid data with 400 and saves nothing", async () => {
    const response = await request(app)
      .post("/projects")
      .send({ name: "", status: "archived" });

    expect(response.status).toBe(400);
    expect(response.body.error).toBe("Invalid project data");
    expect(response.body.details).toHaveProperty("name");
    expect(response.body.details).toHaveProperty("status");
    expect(await ProjectModel.countDocuments()).toBe(0);
  });

  it("rejects malformed JSON with 400", async () => {
    const response = await request(app)
      .post("/projects")
      .set("Content-Type", "application/json")
      .send("{ not json");

    expect(response.status).toBe(400);
    expect(response.body).toEqual({ error: "Request body must be valid JSON" });
  });
});

describe("GET /projects", () => {
  it("returns an empty list when there are no projects", async () => {
    const response = await request(app).get("/projects");

    expect(response.status).toBe(200);
    expect(response.body).toEqual([]);
  });

  it("returns projects newest first", async () => {
    await request(app).post("/projects").send({ name: "First" });
    await request(app).post("/projects").send({ name: "Second" });

    const response = await request(app).get("/projects");

    expect(response.status).toBe(200);
    expect(
      response.body.map((project: { name: string }) => project.name),
    ).toEqual(["Second", "First"]);
  });
});

describe("GET /projects/:id", () => {
  it("returns one project", async () => {
    const created = await createProject({ status: "active" });

    const response = await request(app).get(`/projects/${created.id}`);

    expect(response.status).toBe(200);
    expect(response.body).toEqual(created);
  });

  it("returns 404 when the project does not exist", async () => {
    const response = await request(app).get(`/projects/${missingId()}`);

    expect(response.status).toBe(404);
    expect(response.body).toEqual({ error: "Project not found" });
  });

  it.each(malformedIds)("returns 400 for malformed ID %s", async (id) => {
    const response = await request(app).get(`/projects/${id}`);

    expect(response.status).toBe(400);
    expect(response.body).toEqual({ error: "Invalid project ID" });
  });
});

describe("PATCH /projects/:id", () => {
  it("updates only the fields that were sent", async () => {
    const created = await createProject({ description: "Original" });

    const response = await request(app)
      .patch(`/projects/${created.id}`)
      .send({ status: "completed" });

    expect(response.status).toBe(200);
    expect(response.body).toMatchObject({
      id: created.id,
      name: "Website redesign",
      description: "Original",
      status: "completed",
    });

    // The change is really saved, not just echoed back.
    const saved = await ProjectModel.findById(created.id);
    expect(saved?.status).toBe("completed");
  });

  it("updates name and description, trimming text", async () => {
    const created = await createProject();

    const response = await request(app)
      .patch(`/projects/${created.id}`)
      .send({ name: "  New name  ", description: "  New text  " });

    expect(response.status).toBe(200);
    expect(response.body).toMatchObject({
      name: "New name",
      description: "New text",
    });
  });

  it("changes updatedAt but not createdAt", async () => {
    // Insert with fixed old dates, skipping Mongoose's automatic timestamps,
    // so the test does not depend on how fast it runs.
    const oldDate = new Date("2020-01-01T00:00:00.000Z");
    const { insertedId } = await ProjectModel.collection.insertOne({
      name: "Old project",
      description: "",
      status: "planning",
      createdAt: oldDate,
      updatedAt: oldDate,
    });

    const response = await request(app)
      .patch(`/projects/${insertedId.toHexString()}`)
      .send({ status: "active" });

    expect(response.status).toBe(200);
    expect(response.body.createdAt).toBe(oldDate.toISOString());
    expect(new Date(response.body.updatedAt).getTime()).toBeGreaterThan(
      oldDate.getTime(),
    );
  });

  it("rejects an empty update with 400", async () => {
    const created = await createProject();

    const response = await request(app)
      .patch(`/projects/${created.id}`)
      .send({});

    expect(response.status).toBe(400);
    expect(response.body).toEqual({
      error:
        "Provide at least one field to update: name, description, or status",
      details: {},
    });
  });

  it("rejects an update with only unknown fields with 400", async () => {
    const created = await createProject();

    const response = await request(app)
      .patch(`/projects/${created.id}`)
      .send({ _id: missingId(), createdAt: "2000-01-01" });

    expect(response.status).toBe(400);
  });

  it.each([
    ["an invalid status", { status: "archived" }, "status"],
    ["a blank name", { name: "   " }, "name"],
    ["a name that is too long", { name: "a".repeat(101) }, "name"],
    ["a null description", { description: null }, "description"],
  ])("rejects %s with 400 and changes nothing", async (_label, body, field) => {
    const created = await createProject();

    const response = await request(app)
      .patch(`/projects/${created.id}`)
      .send(body);

    expect(response.status).toBe(400);
    expect(response.body.error).toBe("Invalid project data");
    expect(response.body.details).toHaveProperty(field);

    // Round-trip through JSON so dates compare as strings, like the API sends.
    const saved = await ProjectModel.findById(created.id);
    expect(JSON.parse(JSON.stringify(saved))).toEqual(created);
  });

  it("returns 404 when the project does not exist", async () => {
    const response = await request(app)
      .patch(`/projects/${missingId()}`)
      .send({ status: "active" });

    expect(response.status).toBe(404);
    expect(response.body).toEqual({ error: "Project not found" });
  });

  it.each(malformedIds)("returns 400 for malformed ID %s", async (id) => {
    const response = await request(app)
      .patch(`/projects/${id}`)
      .send({ status: "active" });

    expect(response.status).toBe(400);
    expect(response.body).toEqual({ error: "Invalid project ID" });
  });
});

describe("DELETE /projects/:id", () => {
  it("deletes the project", async () => {
    const created = await createProject();

    const response = await request(app).delete(`/projects/${created.id}`);

    expect(response.status).toBe(200);
    expect(response.body).toEqual({ message: "Project deleted", id: created.id });
    expect(await ProjectModel.countDocuments()).toBe(0);

    const followUp = await request(app).get(`/projects/${created.id}`);
    expect(followUp.status).toBe(404);
  });

  it("only deletes the requested project", async () => {
    const keep = await createProject({ name: "Keep" });
    const remove = await createProject({ name: "Remove" });

    await request(app).delete(`/projects/${remove.id}`);

    expect(await ProjectModel.countDocuments()).toBe(1);
    expect(await ProjectModel.findById(keep.id)).not.toBeNull();
  });

  it("returns 404 when the project does not exist", async () => {
    const response = await request(app).delete(`/projects/${missingId()}`);

    expect(response.status).toBe(404);
    expect(response.body).toEqual({ error: "Project not found" });
  });

  it.each(malformedIds)("returns 400 for malformed ID %s", async (id) => {
    const response = await request(app).delete(`/projects/${id}`);

    expect(response.status).toBe(400);
    expect(response.body).toEqual({ error: "Invalid project ID" });
  });
});

describe("Project model", () => {
  it("rejects an invalid status even if route validation is skipped", async () => {
    const project = new ProjectModel({ name: "Logo", status: "archived" });

    await expect(project.validate()).rejects.toThrow(/status/);
  });
});
